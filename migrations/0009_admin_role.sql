-- Add is_admin flag to the Better Auth user table. The boot-time backfill in
-- src/lib/server/db/seed-admins.ts promotes anyone in ADMIN_EMAILS to admin
-- so the env var keeps working through the transition (see GH #11).

alter table "user" add column "is_admin" boolean not null default false;

create index "user_is_admin_idx" on "user" ("is_admin") where "is_admin" = true;
