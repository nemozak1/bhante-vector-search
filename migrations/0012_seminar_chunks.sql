-- Seminar search index: one row per exchange window (a run of consecutive
-- speaker turns, ~1,800 chars, usually a question with its answer) instead of
-- one row per speaker turn in `chunks`. Populated by ingest_seminars.py.
--
-- Embeddings are text-embedding-3-large shortened to 1536 dims (truncate +
-- L2-normalise), which fits pgvector's 2000-dim HNSW limit on plain `vector`.
-- Book chunks stay in `chunks` at 3072 dims.
--
-- turn_start/turn_end index into seminars.transcript.turns, so a result can
-- link to its place in the transcript. No FK to seminars: ingestion runs
-- before the catalog seed in the sync workflow, same as `chunks`.

create table seminar_chunks (
  id            text primary key,                  -- '{seminar_code}::{window index}'
  seminar_code  text not null,
  turn_start    int not null,
  turn_end      int not null,
  speakers      text[] not null default '{}',
  document      text not null,                     -- 'Speaker: text' lines, one per turn
  embedding     vector(1536) not null
);

create index seminar_chunks_code on seminar_chunks(seminar_code);

create index seminar_chunks_hnsw on seminar_chunks using hnsw (embedding vector_cosine_ops);
