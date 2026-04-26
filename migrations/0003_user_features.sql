create type bookmark_kind as enum ('seminar', 'book_chunk', 'seminar_chunk');

create table bookmarks (
  id         bigserial primary key,
  user_id    text not null references "user"(id) on delete cascade,
  kind       bookmark_kind not null,
  ref        jsonb not null,
  note       text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);

create type search_scope as enum ('all', 'books', 'seminars');

create table search_history (
  id           bigserial primary key,
  user_id      text not null references "user"(id) on delete cascade,
  query        text not null,
  scope        search_scope not null,
  filters      jsonb,
  result_count int,
  created_at   timestamptz not null default now()
);

create index search_history_user_created on search_history(user_id, created_at desc);

create table saved_queries (
  id         bigserial primary key,
  user_id    text not null references "user"(id) on delete cascade,
  name       text not null,
  query      text not null,
  scope      search_scope not null,
  filters    jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
