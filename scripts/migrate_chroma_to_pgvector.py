"""
One-shot migration: read embeddings from ChromaDB and write to pgvector.

NO re-embedding — the existing 3072-dim text-embedding-3-large vectors are
copied verbatim. This is *the* path that avoids the OpenAI re-cost.

The chroma/ directory itself is preserved on disk after this runs (per
the user's instruction: it's irreplaceable, gitignored, not on a remote).

Usage:
    python scripts/migrate_chroma_to_pgvector.py
    python scripts/migrate_chroma_to_pgvector.py --collection bhante_epub_search
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import asyncpg
import chromadb
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")

CHROMA_PATH = PROJECT_ROOT / "chroma"

COLLECTIONS = ["bhante_epub_search", "bhante_seminar_search"]

PAGE_SIZE = 500


def vec_to_pg(values) -> str:
    """Format a numeric vector for pgvector — '[1.2,3.4,...]' literal."""
    return "[" + ",".join(repr(float(x)) for x in values) + "]"


async def migrate_collection(conn: asyncpg.Connection, name: str) -> int:
    print(f"\n=== {name} ===")
    chroma = chromadb.PersistentClient(path=str(CHROMA_PATH))
    try:
        coll = chroma.get_collection(name)
    except Exception as e:
        print(f"  collection not found in chroma ({e}); skipping")
        return 0

    total_in_chroma = coll.count()
    print(f"  chroma count: {total_in_chroma}")

    already_in_pg = await conn.fetchval(
        "select count(*) from chunks where collection = $1", name
    )
    if already_in_pg >= total_in_chroma:
        print(f"  pgvector already has {already_in_pg} rows; skipping")
        return 0

    inserted = 0
    offset = 0
    while True:
        page = coll.get(
            include=["embeddings", "metadatas", "documents"],
            limit=PAGE_SIZE,
            offset=offset,
        )
        ids = page["ids"]
        if not ids:
            break

        rows = []
        for i, _id in enumerate(ids):
            embedding = page["embeddings"][i]
            document = page["documents"][i] or ""
            metadata = page["metadatas"][i] or {}
            rows.append((_id, name, vec_to_pg(embedding), document, json.dumps(metadata)))

        await conn.executemany(
            """insert into chunks (id, collection, embedding, document, metadata)
                values ($1, $2, $3::vector, $4, $5::jsonb)
                on conflict (id) do nothing""",
            rows,
        )
        inserted += len(rows)
        offset += PAGE_SIZE
        print(f"  inserted {inserted}/{total_in_chroma}", flush=True)

        if len(ids) < PAGE_SIZE:
            break

    return inserted


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--collection", help="Migrate a single collection only")
    args = parser.parse_args()

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)

    conn = await asyncpg.connect(url)
    try:
        targets = [args.collection] if args.collection else COLLECTIONS
        total = 0
        for name in targets:
            total += await migrate_collection(conn, name)

        print(f"\nDone. Inserted {total} new rows total.")
        for name in targets:
            n = await conn.fetchval(
                "select count(*) from chunks where collection = $1", name
            )
            print(f"  {name}: {n} chunks in pgvector")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
