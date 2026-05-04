-- Add the actual transcript content as a JSONB column on seminars so
-- the deployed app doesn't need access to the filesystem `data/seminars/cleaned/`.
-- The cleaned JSON files in git remain the source of truth for the remote-agent
-- PR review workflow; seed_seminars.ts copies their content into this column.
--
-- Shape: { turns: [{ speaker, paragraphs[] }, ...] } — same shape as the
-- service's SeminarTranscript type minus the metadata fields (code/title/date
-- /location stay in their existing columns).

alter table seminars add column if not exists transcript jsonb;
