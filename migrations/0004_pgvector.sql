create extension if not exists vector;

create table chunks (
  id         text primary key,
  collection text not null,                          -- 'bhante_epub_search' | 'bhante_seminar_search'
  embedding  vector(3072) not null,
  document   text not null,
  metadata   jsonb not null default '{}'::jsonb
);

create index chunks_collection on chunks(collection);

-- 3072 dims is over pgvector's 2000-dim HNSW limit on `vector`; halfvec
-- supports up to 4000 dims. Queries cast to halfvec at the seam too.
create index chunks_hnsw_halfvec
  on chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
