#!/usr/bin/env python3
"""
Ingest seminar transcripts into pgvector.

Default behaviour: for each seminar code, prefer data/seminars/cleaned/{code}.json
(human-/agent-edited) and fall back to data/seminars/raw/{code}.json processed
through SeminarProcessor when no cleaned version exists. The previous script
ingested only raw/, which meant search results reflected the unparsed scrape
rather than the reviewed transcripts.

Writes:
  - chunks (pgvector)
  - ingestion_log (one row per (entity_id, ingestion run) with source_sha)

Skips a seminar if its latest ingestion_log row matches the current source SHA.
Use --reprocess to force re-ingestion.

Usage:
  python ingest_seminars.py
  python ingest_seminars.py --codes SEM050,SEM051
  python ingest_seminars.py --reprocess
  python ingest_seminars.py --raw-only            # ignore cleaned/, use raw via processor
"""
import argparse
import asyncio
import hashlib
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import asyncpg
import openai
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))
load_dotenv(PROJECT_ROOT / ".env")

from src.seminar_processor import SeminarProcessor, process_seminar_to_langchain  # noqa: E402

DEFAULT_COLLECTION = "bhante_seminar_search"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_BATCH = 100
INSERT_BATCH = 200
SOURCE_OF_TRUTH_PATH = lambda c: f"data/seminars/cleaned/{c}.json"


@dataclass
class Chunk:
    id: str
    text: str
    speaker: Optional[str]
    section_heading: Optional[str]
    seminar_title: str
    seminar_code: str


def _vec_to_pg(values) -> str:
    return "[" + ",".join(repr(float(x)) for x in values) + "]"


def _git_sha_of(path: Path) -> Optional[str]:
    """Return the git blob SHA of a tracked file's current content. None if not tracked."""
    try:
        out = subprocess.run(
            ["git", "hash-object", str(path)],
            capture_output=True, text=True, check=True,
            cwd=str(PROJECT_ROOT),
        )
        return out.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def _chunk_cleaned(cleaned: dict, max_chunk_size: int) -> list[Chunk]:
    """Chunk a cleaned/{code}.json (already-parsed turn structure) for embedding."""
    code = cleaned.get("code", "")
    title = cleaned.get("title", "")
    proc = SeminarProcessor(max_chunk_size=max_chunk_size)

    # Cleaned format: list of {speaker, paragraphs[]}. SeminarProcessor's
    # _create_chunks expects [(speaker, joined_text), ...].
    pairs = []
    for turn in cleaned.get("turns", []):
        text = " ".join(turn.get("paragraphs", []))
        if text.strip():
            pairs.append((turn.get("speaker"), text))

    # No section_headings for cleaned format (those were a raw-side concern).
    seminar_chunks = proc._create_chunks(pairs, title, code, section_headings=[])

    chunks = []
    for i, sc in enumerate(seminar_chunks):
        chunks.append(Chunk(
            id=f"{code}::cleaned::{i:05d}",
            text=sc.text,
            speaker=sc.speaker,
            section_heading=sc.section_heading,
            seminar_title=sc.seminar_title,
            seminar_code=sc.seminar_code,
        ))
    return chunks


def _chunk_raw(code: str, max_chunk_size: int) -> list[Chunk]:
    """Fall back to raw/{code}.json via SeminarProcessor.process_seminar."""
    raw_path = PROJECT_ROOT / "data" / "seminars" / "raw" / f"{code}.json"
    contents_path = PROJECT_ROOT / "data" / "seminars" / "raw" / f"{code}C.json"
    docs = process_seminar_to_langchain(
        str(raw_path),
        str(contents_path) if contents_path.exists() else None,
        max_chunk_size=max_chunk_size,
    )
    chunks = []
    for i, d in enumerate(docs):
        chunks.append(Chunk(
            id=f"{code}::raw::{i:05d}",
            text=d.page_content,
            speaker=d.metadata.get("speaker"),
            section_heading=d.metadata.get("section_heading"),
            seminar_title=d.metadata.get("seminar_title", ""),
            seminar_code=d.metadata.get("seminar_code", code),
        ))
    return chunks


def _build_chunks_for(code: str, raw_only: bool, max_chunk_size: int) -> tuple[list[Chunk], str, Optional[str]]:
    """Return (chunks, source ('cleaned'|'raw'), source_sha)."""
    cleaned_path = PROJECT_ROOT / "data" / "seminars" / "cleaned" / f"{code}.json"
    if not raw_only and cleaned_path.exists():
        cleaned = json.loads(cleaned_path.read_text())
        sha = _git_sha_of(cleaned_path) or hashlib.sha256(cleaned_path.read_bytes()).hexdigest()
        return _chunk_cleaned(cleaned, max_chunk_size), "cleaned", sha

    raw_path = PROJECT_ROOT / "data" / "seminars" / "raw" / f"{code}.json"
    if not raw_path.exists():
        raise FileNotFoundError(f"Neither cleaned nor raw exists for {code}")
    sha = _git_sha_of(raw_path) or hashlib.sha256(raw_path.read_bytes()).hexdigest()
    return _chunk_raw(code, max_chunk_size), "raw", sha


async def _last_ingest_sha(conn: asyncpg.Connection, code: str, collection: str) -> Optional[str]:
    return await conn.fetchval(
        """select source_sha from ingestion_log
            where entity_kind = 'seminar' and entity_id = $1 and collection_name = $2
            order by ingested_at desc limit 1""",
        code, collection,
    )


async def _embed_and_insert(
    conn: asyncpg.Connection,
    code: str,
    chunks: list[Chunk],
    collection: str,
    embedding_model: str,
    openai_client: openai.OpenAI,
):
    # Drop any prior chunks for this seminar in this collection (we're re-ingesting).
    deleted = await conn.fetchval(
        "with d as (delete from chunks where collection = $1 and metadata->>'seminar_code' = $2 returning 1) select count(*) from d",
        collection, code,
    )
    if deleted:
        print(f"    cleared {deleted} existing chunks", flush=True)

    inserted = 0
    for i in range(0, len(chunks), EMBEDDING_BATCH):
        batch = chunks[i:i + EMBEDDING_BATCH]
        resp = openai_client.embeddings.create(model=embedding_model, input=[c.text for c in batch])
        rows = []
        for c, emb_obj in zip(batch, resp.data):
            metadata = {
                "seminar_code": c.seminar_code,
                "seminar_title": c.seminar_title,
                "content_type": "seminar",
            }
            if c.speaker:
                metadata["speaker"] = c.speaker
            if c.section_heading:
                metadata["section_heading"] = c.section_heading
            rows.append((c.id, collection, _vec_to_pg(emb_obj.embedding), c.text, json.dumps(metadata)))

        for j in range(0, len(rows), INSERT_BATCH):
            await conn.executemany(
                """insert into chunks (id, collection, embedding, document, metadata)
                    values ($1, $2, $3::vector, $4, $5::jsonb)
                    on conflict (id) do update
                      set embedding = excluded.embedding,
                          document = excluded.document,
                          metadata = excluded.metadata""",
                rows[j:j + INSERT_BATCH],
            )
        inserted += len(rows)
        print(f"    {inserted}/{len(chunks)} embedded+inserted", flush=True)


async def _log_ingestion(
    conn: asyncpg.Connection,
    code: str, collection: str, embedding_model: str,
    chunk_count: int, source_sha: Optional[str],
):
    await conn.execute(
        """insert into ingestion_log
              (entity_kind, entity_id, collection_name, embedding_model, chunk_count, source_sha)
            values ('seminar', $1, $2, $3, $4, $5)""",
        code, collection, embedding_model, chunk_count, source_sha,
    )


def _consolidated_parts() -> set[str]:
    """Codes that have been merged into a parent seminar (per consolidated.json).
    These are excluded from default ingest so the parent is the single source of truth."""
    path = PROJECT_ROOT / "data" / "seminars" / "consolidated.json"
    if not path.exists():
        return set()
    reg = json.loads(path.read_text())
    skip: set[str] = set()
    for entry in reg.values():
        skip.update(entry.get("parts", []))
    return skip


async def _list_targets(codes: Optional[list[str]]) -> list[str]:
    cleaned_dir = PROJECT_ROOT / "data" / "seminars" / "cleaned"
    raw_dir = PROJECT_ROOT / "data" / "seminars" / "raw"

    available = set()
    if cleaned_dir.exists():
        available.update(p.stem for p in cleaned_dir.glob("*.json"))
    if raw_dir.exists():
        available.update(p.stem for p in raw_dir.glob("*.json") if not p.stem.endswith("C"))

    skip_parts = _consolidated_parts()
    if codes:
        targets = [c for c in codes if c in available]
        missing = set(codes) - available
        if missing:
            print(f"warning: codes not found: {sorted(missing)}", file=sys.stderr)
    else:
        targets = sorted(available - skip_parts)
    return targets


async def main_async(args):
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY not set", file=sys.stderr); sys.exit(1)
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set", file=sys.stderr); sys.exit(1)

    targets = await _list_targets(args.codes.split(",") if args.codes else None)
    if not targets:
        print("nothing to ingest"); return

    openai_client = openai.OpenAI()
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        for code in targets:
            try:
                chunks, source, sha = _build_chunks_for(code, args.raw_only, args.chunk_size)
            except FileNotFoundError as e:
                print(f"  {code}: SKIP ({e})"); continue
            except Exception as e:
                print(f"  {code}: FAILED to chunk - {e}"); continue

            if not args.reprocess:
                last = await _last_ingest_sha(conn, code, args.collection)
                if last == sha:
                    print(f"  {code}: skip ({source}, sha={sha[:8]}, already ingested)")
                    continue

            print(f"  {code}: {len(chunks)} chunks from {source} (sha={sha[:8] if sha else 'none'})")
            await _embed_and_insert(conn, code, chunks, args.collection, args.embedding_model, openai_client)
            await _log_ingestion(conn, code, args.collection, args.embedding_model, len(chunks), sha)
            print(f"  {code}: done")
    finally:
        await conn.close()

    print("\ningestion complete")


def main():
    parser = argparse.ArgumentParser(description="Ingest seminar transcripts into pgvector")
    parser.add_argument("--codes", help="Comma-separated seminar codes")
    parser.add_argument("--reprocess", action="store_true", help="Re-ingest even if source SHA matches the last log row")
    parser.add_argument("--raw-only", action="store_true", help="Ignore cleaned/, use raw via processor")
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument("--embedding-model", default=DEFAULT_EMBEDDING_MODEL)
    parser.add_argument("--chunk-size", type=int, default=1000)
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
