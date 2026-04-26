-- Seminar catalog. One row per seminar code, populated by
-- scripts/seed_seminars.ts (one-shot, idempotent) which walks
-- data/seminars/cleaned/{code}.json (preferred) and raw/{code}.json
-- (fallback) for the title/date/location.
--
-- The migration also seeds placeholder rows for every code already
-- referenced by seminar_contents (so the FK we add at the end of this
-- migration is satisfied immediately). Run `npm run seed:catalog`
-- afterwards to fill in real titles.

create table seminars (
  code        text primary key,
  title       text not null default '',
  date        text,
  location    text,
  source      text not null default 'placeholder',     -- 'cleaned' | 'raw' | 'placeholder'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Backfill placeholders so existing seminar_contents.seminar_code values
-- have a parent row before we tighten the constraint.
insert into seminars (code, source)
  select distinct seminar_code, 'placeholder' from seminar_contents
on conflict (code) do nothing;

alter table seminar_contents
  add constraint seminar_contents_seminar_code_fkey
  foreign key (seminar_code) references seminars(code) on delete cascade;
