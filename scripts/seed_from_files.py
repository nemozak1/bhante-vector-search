"""
One-shot backfill: read JSON state files into Postgres.

V1 scope: only ingest_log.json → ingestion_log table. Cleaned transcripts
and review status stay file-based (see project memory: the remote Claude
agent and PR workflow own those).

Idempotent: safe to re-run. Uses ON CONFLICT DO NOTHING semantics.

Usage:
    python scripts/seed_from_files.py
    DATABASE_URL=postgres://... python scripts/seed_from_files.py
"""
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / ".env")

DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large"
SEMINAR_COLLECTION = "bhante_seminar_search"

INGEST_LOG_PATH = PROJECT_ROOT / "data" / "seminars" / "ingest_log.json"


async def seed_ingestion_log(conn: asyncpg.Connection) -> int:
    if not INGEST_LOG_PATH.exists():
        print(f"  no ingest_log.json at {INGEST_LOG_PATH}, skipping")
        return 0

    with INGEST_LOG_PATH.open() as f:
        log = json.load(f)

    inserted = 0
    for code, entry in log.items():
        ts = datetime.fromisoformat(entry["timestamp"])

        existing = await conn.fetchval(
            """select 1 from ingestion_log
                where entity_kind = 'seminar' and entity_id = $1 and ingested_at = $2""",
            code,
            ts,
        )
        if existing:
            continue

        await conn.execute(
            """insert into ingestion_log
                  (entity_kind, entity_id, collection_name, embedding_model,
                   chunk_count, source_sha, ingested_by, ingested_at)
                values ('seminar', $1, $2, $3, $4, NULL, NULL, $5)""",
            code,
            SEMINAR_COLLECTION,
            DEFAULT_EMBEDDING_MODEL,
            entry["chunks"],
            ts,
        )
        inserted += 1

    return inserted


async def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set", file=sys.stderr)
        sys.exit(1)

    conn = await asyncpg.connect(url)
    try:
        print("seeding ingestion_log from data/seminars/ingest_log.json")
        n = await seed_ingestion_log(conn)
        print(f"  inserted {n} new rows")

        total = await conn.fetchval("select count(*) from ingestion_log")
        print(f"  ingestion_log total: {total}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
