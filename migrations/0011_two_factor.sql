-- Tables required by Better Auth's twoFactor plugin. Adds an enrollment flag
-- on user plus a twoFactor table holding the TOTP secret and backup codes.

alter table "user" add column if not exists "twoFactorEnabled" boolean default false;

create table if not exists "twoFactor" (
  id            text primary key,
  "userId"      text not null references "user"(id) on delete cascade,
  secret        text not null,
  "backupCodes" text not null
);

create index if not exists "twoFactor_userId_idx" on "twoFactor" ("userId");
