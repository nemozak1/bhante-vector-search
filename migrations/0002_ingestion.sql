create type ingest_entity_kind as enum ('book', 'seminar');

create table ingestion_log (
  id              bigserial primary key,
  entity_kind     ingest_entity_kind not null,
  entity_id       text not null,                  -- book slug or seminar code (no FK; catalog is on disk)
  collection_name text not null,                  -- pgvector collection identifier
  embedding_model text not null,
  chunk_count     int not null,
  source_sha      text,                            -- git SHA of the cleaned/{code}.json that was ingested
  ingested_by     text references "user"(id),
  ingested_at     timestamptz not null default now()
);

create index ingestion_log_entity on ingestion_log(entity_kind, entity_id, ingested_at desc);
