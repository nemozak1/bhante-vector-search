-- Contents-page entries scraped from data/seminars/raw/{code}C.json files.
-- Populated by scripts/seed_seminar_contents.ts (one-shot, idempotent).
-- seminar_code is the natural key linking back to the on-disk transcript;
-- no FK to a seminars catalog because that catalog stays on disk in v1.

create table seminar_contents (
  id            bigserial primary key,
  seminar_code  text not null,
  ord           int not null,
  page          int not null,
  label         text not null,
  unique (seminar_code, ord)
);

create index seminar_contents_code_ord on seminar_contents(seminar_code, ord);
