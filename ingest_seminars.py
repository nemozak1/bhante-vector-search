#!/usr/bin/env python3
"""
Ingest seminar transcripts into pgvector (seminar_chunks).

Each seminar is chunked into exchange windows (src/seminar_chunker.py): runs of
consecutive speaker turns, so a question is embedded together with its answer.
Turns come from data/seminars/cleaned/{code}.json, falling back to
data/seminars/raw/{code}.json parsed by SeminarProcessor.process_for_display.

Embeddings are text-embedding-3-large shortened to 1536 dims (truncate +
L2-normalise); src/lib/server/embed.ts shortens query embeddings the same way.

Writes, per seminar in one transaction:
  - seminar_chunks (the seminar's rows are replaced)
  - ingestion_log (entity_kind='seminar', collection_name='seminar_chunks', source_sha)

Skips a seminar if its latest ingestion_log row for seminar_chunks matches the
current source SHA. Use --reprocess to force re-ingestion.

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
import math
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

import asyncpg
import openai
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))
load_dotenv(PROJECT_ROOT / ".env")

from src.seminar_chunker import ExchangeChunk, chunk_exchanges  # noqa: E402
from src.seminar_processor import SeminarProcessor  # noqa: E402

INDEX_NAME = "seminar_chunks"  # ingestion_log.collection_name for this index
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large"
DIMS = 1536
EMBEDDING_BATCH = 100
SEMINARS_DIR = PROJECT_ROOT / "data" / "seminars"


def _vec_to_pg(values) -> str:
    # 8 significant digits is below float4 storage precision anyway and keeps
    # each 1536-dim literal ~15KB instead of ~32KB.
    return "[" + ",".join(f"{x:.8g}" for x in values) + "]"


def _shorten(values: list[float]) -> list[float]:
    v = values[:DIMS]
    norm = math.sqrt(sum(x * x for x in v))
    return [x / norm for x in v]


def _source_sha(path: Path) -> str:
    """Git blob SHA of the file's current content, or sha256 if git isn't available."""
    try:
        out = subprocess.run(
            ["git", "hash-object", str(path)],
            capture_output=True, text=True, check=True,
            cwd=str(PROJECT_ROOT),
        )
        return out.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return hashlib.sha256(path.read_bytes()).hexdigest()


def _build_chunks_for(code: str, raw_only: bool) -> tuple[list[ExchangeChunk], str, str]:
    """Return (chunks, source ('cleaned'|'raw'), source_sha)."""
    cleaned_path = SEMINARS_DIR / "cleaned" / f"{code}.json"
    if not raw_only and cleaned_path.exists():
        d = json.loads(cleaned_path.read_text())
        turns = [(t.get("speaker"), t.get("paragraphs", []), i) for i, t in enumerate(d.get("turns", []))]
        chunks = chunk_exchanges(turns, d.get("title", ""), d.get("date"), d.get("location"))
        return chunks, "cleaned", _source_sha(cleaned_path)

    raw_path = SEMINARS_DIR / "raw" / f"{code}.json"
    if not raw_path.exists():
        raise FileNotFoundError(f"Neither cleaned nor raw exists for {code}")
    d = SeminarProcessor().process_for_display(raw_path)
    turns = [(t.speaker, t.paragraphs, t.turn_index) for t in d["turns"]]
    chunks = chunk_exchanges(turns, d["title"], d["date"], d["location"])
    return chunks, "raw", _source_sha(raw_path)


async def _last_ingest_sha(conn: asyncpg.Connection, code: str) -> Optional[str]:
    return await conn.fetchval(
        """select source_sha from ingestion_log
            where entity_kind = 'seminar' and entity_id = $1 and collection_name = $2
            order by ingested_at desc limit 1""",
        code, INDEX_NAME,
    )


def _embed(client: openai.OpenAI, model: str, texts: list[str]) -> list[list[float]]:
    vectors = []
    for i in range(0, len(texts), EMBEDDING_BATCH):
        resp = client.embeddings.create(model=model, input=texts[i:i + EMBEDDING_BATCH])
        vectors += [_shorten(d.embedding) for d in resp.data]
    return vectors


async def _replace_chunks(
    conn: asyncpg.Connection,
    code: str,
    chunks: list[ExchangeChunk],
    vectors: list[list[float]],
    embedding_model: str,
    source_sha: str,
):
    rows = [
        (f"{code}::{c.index:05d}", code, c.turn_start, c.turn_end, c.speakers, c.document, _vec_to_pg(v))
        for c, v in zip(chunks, vectors)
    ]
    async with conn.transaction():
        await conn.execute("delete from seminar_chunks where seminar_code = $1", code)
        await conn.executemany(
            """insert into seminar_chunks (id, seminar_code, turn_start, turn_end, speakers, document, embedding)
                values ($1, $2, $3, $4, $5, $6, $7::vector)""",
            rows,
        )
        await conn.execute(
            """insert into ingestion_log
                  (entity_kind, entity_id, collection_name, embedding_model, chunk_count, source_sha)
                values ('seminar', $1, $2, $3, $4, $5)""",
            code, INDEX_NAME, f"{embedding_model}@{DIMS}", len(chunks), source_sha,
        )


def _consolidated_parts() -> set[str]:
    """Codes that have been merged into a parent seminar (per consolidated.json).
    These are excluded from default ingest so the parent is the single source of truth."""
    path = SEMINARS_DIR / "consolidated.json"
    if not path.exists():
        return set()
    reg = json.loads(path.read_text())
    skip: set[str] = set()
    for entry in reg.values():
        skip.update(entry.get("parts", []))
    return skip


def _list_targets(codes: Optional[list[str]]) -> list[str]:
    cleaned_dir = SEMINARS_DIR / "cleaned"
    raw_dir = SEMINARS_DIR / "raw"

    available = set()
    if cleaned_dir.exists():
        available.update(p.stem for p in cleaned_dir.glob("*.json"))
    if raw_dir.exists():
        available.update(p.stem for p in raw_dir.glob("*.json") if not p.stem.endswith("C"))

    if codes:
        targets = [c for c in codes if c in available]
        missing = set(codes) - available
        if missing:
            print(f"warning: codes not found: {sorted(missing)}", file=sys.stderr)
        return targets
    return sorted(available - _consolidated_parts())


async def main_async(args):
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY not set", file=sys.stderr); sys.exit(1)
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set", file=sys.stderr); sys.exit(1)

    targets = _list_targets(args.codes.split(",") if args.codes else None)
    if not targets:
        print("nothing to ingest"); return

    openai_client = openai.OpenAI(max_retries=8)
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        if not await conn.fetchval("select to_regclass('seminar_chunks') is not null"):
            print("seminar_chunks table missing: apply migrations first "
                  "(npm run migrate, or make any request to the deployed app)", file=sys.stderr)
            sys.exit(1)

        for code in targets:
            try:
                chunks, source, sha = _build_chunks_for(code, args.raw_only)
            except FileNotFoundError as e:
                print(f"  {code}: SKIP ({e})"); continue
            except Exception as e:
                print(f"  {code}: FAILED to chunk - {e}"); continue

            if not chunks:
                print(f"  {code}: SKIP (no transcript text in {source})"); continue

            if not args.reprocess and await _last_ingest_sha(conn, code) == sha:
                print(f"  {code}: skip ({source}, sha={sha[:8]}, already ingested)")
                continue

            print(f"  {code}: {len(chunks)} windows from {source} (sha={sha[:8]})", flush=True)
            vectors = _embed(openai_client, args.embedding_model, [c.embed_text for c in chunks])
            await _replace_chunks(conn, code, chunks, vectors, args.embedding_model, sha)
            print(f"  {code}: done", flush=True)
    finally:
        await conn.close()

    print("\ningestion complete")


def main():
    parser = argparse.ArgumentParser(description="Ingest seminar transcripts into pgvector (seminar_chunks)")
    parser.add_argument("--codes", help="Comma-separated seminar codes")
    parser.add_argument("--reprocess", action="store_true", help="Re-ingest even if source SHA matches the last log row")
    parser.add_argument("--raw-only", action="store_true", help="Ignore cleaned/, use raw via processor")
    parser.add_argument("--embedding-model", default=DEFAULT_EMBEDDING_MODEL)
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
