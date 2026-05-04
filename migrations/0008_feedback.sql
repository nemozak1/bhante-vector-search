create type feedback_category as enum (
  'bug',
  'seminar_misformatting',
  'seminar_correction',
  'search_quality',
  'feature',
  'question',
  'other'
);

create type feedback_status as enum ('new', 'triaged', 'resolved', 'dismissed');

create table feedback (
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

create index feedback_status_created on feedback (status, created_at desc);
create index feedback_category_created on feedback (category, created_at desc);
