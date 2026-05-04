-- Idempotent: this migration was originally numbered 0007_feedback and applied
-- to some dev databases under that name; renumbered to 0008 after merge with
-- main introduced its own 0007. Guards let it re-run safely.

do $$ begin
  create type feedback_category as enum (
    'bug',
    'seminar_misformatting',
    'seminar_correction',
    'search_quality',
    'feature',
    'question',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type feedback_status as enum ('new', 'triaged', 'resolved', 'dismissed');
exception when duplicate_object then null;
end $$;

create table if not exists feedback (
  id               bigserial primary key,
  user_id          text references "user"(id) on delete set null,
  email_snapshot   text not null,
  category         feedback_category not null,
  message          text not null,
  url              text,
  user_agent       text,
  viewport         jsonb,
  app_version      text,
  console_errors   jsonb,
  screenshot_key   text,
  status           feedback_status not null default 'new',
  admin_notes      text,
  github_issue_url text,
  created_at       timestamptz not null default now(),
  triaged_at       timestamptz
);

create index if not exists feedback_status_created on feedback (status, created_at desc);
create index if not exists feedback_category_created on feedback (category, created_at desc);
