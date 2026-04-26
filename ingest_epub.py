#!/usr/bin/env python3
"""
Ingest an EPUB into pgvector.

Each EPUB is identified by `--book-slug` (e.g. "complete_works_vol1"); chunks
get unique IDs of the form "<slug>::<work_title>::p<page>::<i>" so re-ingesting
the same volume idempotently overwrites without duplicating.

Writes:
  - chunks (pgvector)
  - ingestion_log (entity_kind='book', entity_id=<slug>)

Usage:
  python ingest_epub.py --epub-path ./data/your_file.epub
  python ingest_epub.py --epub-path ./data/your_file.epub --book-slug complete_works_vol2 --work-index complete_works_vol2
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import asyncpg
import openai
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))
load_dotenv(PROJECT_ROOT / ".env")

from src.epub_processor import process_epub_to_langchain  # noqa: E402

DEFAULT_COLLECTION = "bhante_epub_search"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_BATCH = 100
INSERT_BATCH = 200

WORK_INDEXES = {
    "complete_works_vol1": {
        "A Survey of Buddhism": (35, 611),
        "The Buddha's Noble Eightfold Path": (629, 792),
    },
}


def _vec_to_pg(values) -> str:
    return "[" + ",".join(repr(float(x)) for x in values) + "]"


def _slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def _file_sha(path: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "hash-object", str(path)],
            capture_output=True, text=True, check=True, cwd=str(PROJECT_ROOT),
        )
        return out.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return hashlib.sha256(path.read_bytes()).hexdigest()


async def main_async(args):
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY not set", file=sys.stderr); sys.exit(1)
    if not os.environ.get("DATABASE_URL"):
        print("DATABASE_URL not set", file=sys.stderr); sys.exit(1)

    epub_file = Path(args.epub_path)
    if not epub_file.exists():
        print(f"file not found: {epub_file}", file=sys.stderr); sys.exit(1)

    if args.work_index not in WORK_INDEXES:
        print(f"unknown --work-index: {args.work_index}", file=sys.stderr); sys.exit(1)

    work_index = WORK_INDEXES[args.work_index]
    print(f"chunking {epub_file.name} ({args.work_index})...")
    documents = process_epub_to_langchain(
        epub_path=str(epub_file),
        work_index=work_index,
        max_chunk_size=args.chunk_size,
    )
    print(f"  {len(documents)} chunks")

    sha = _file_sha(epub_file)
    print(f"  source sha={sha[:12]}")

    openai_client = openai.OpenAI()
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    try:
        # Wipe prior chunks for this slug, then re-insert (avoids duplicates / orphans).
        deleted = await conn.fetchval(
            "with d as (delete from chunks where collection = $1 and metadata->>'book_slug' = $2 returning 1) select count(*) from d",
            args.collection, args.book_slug,
        )
        if deleted:
            print(f"  cleared {deleted} existing chunks for {args.book_slug}")

        inserted = 0
        for i in range(0, len(documents), EMBEDDING_BATCH):
            batch = documents[i:i + EMBEDDING_BATCH]
            resp = openai_client.embeddings.create(model=args.embedding_model, input=[d.page_content for d in batch])

            rows = []
            for j, (doc, emb_obj) in enumerate(zip(batch, resp.data)):
                meta = dict(doc.metadata)
                meta["book_slug"] = args.book_slug
                meta["content_type"] = "epub"
                page_part = f"p{meta.get('page', 'na')}"
                _id = f"{args.book_slug}::{_slugify(meta.get('work', 'unk'))}::{page_part}::{i + j:05d}"
                rows.append((_id, args.collection, _vec_to_pg(emb_obj.embedding), doc.page_content, json.dumps(meta)))

            for k in range(0, len(rows), INSERT_BATCH):
                await conn.executemany(
                    """insert into chunks (id, collection, embedding, document, metadata)
                        values ($1, $2, $3::vector, $4, $5::jsonb)
                        on conflict (id) do update
                          set embedding = excluded.embedding,
                              document = excluded.document,
                              metadata = excluded.metadata""",
                    rows[k:k + INSERT_BATCH],
                )
            inserted += len(rows)
            print(f"  {inserted}/{len(documents)} embedded+inserted", flush=True)

        await conn.execute(
            """insert into ingestion_log
                  (entity_kind, entity_id, collection_name, embedding_model, chunk_count, source_sha)
                values ('book', $1, $2, $3, $4, $5)""",
            args.book_slug, args.collection, args.embedding_model, len(documents), sha,
        )
    finally:
        await conn.close()

    print(f"\ndone. Inserted {len(documents)} chunks under collection={args.collection}")


def main():
    parser = argparse.ArgumentParser(description="Ingest an EPUB into pgvector")
    parser.add_argument("--epub-path", required=True)
    parser.add_argument("--book-slug", default="complete_works_vol1",
                        help="Stable identifier used in chunk IDs and ingestion_log.entity_id")
    parser.add_argument("--work-index", default="complete_works_vol1", choices=list(WORK_INDEXES.keys()))
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument("--embedding-model", default=DEFAULT_EMBEDDING_MODEL)
    parser.add_argument("--chunk-size", type=int, default=500)
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
