-- Activity / event log. Ported from iris (cloudlobsters); the iris policy/quote
-- FK columns are dropped here in favour of bhante-domain references (feedback,
-- seminar). General-purpose references continue to live in metadata.entities.

create table system_events (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  type            text not null,
  level           text not null default 'info',         -- debug | info | warning | error
  source          text not null default 'user',         -- user | webhook | cron | system | api
  message         text not null,
  metadata        jsonb,                                 -- { messageTemplate, entities }
  actor_id        text references "user"(id) on delete set null,
  ip_address      text,
  user_agent      text,
  feedback_id     bigint references feedback(id) on delete set null,
  seminar_code    text
);

create index system_events_created_at on system_events (created_at desc);
create index system_events_type_created on system_events (type, created_at desc);
create index system_events_actor_created on system_events (actor_id, created_at desc) where actor_id is not null;
create index system_events_feedback on system_events (feedback_id) where feedback_id is not null;
create index system_events_seminar on system_events (seminar_code) where seminar_code is not null;
