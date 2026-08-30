-- backend/supabase/seed/reset.sql  — Youth Republic backend project (YR)
--
-- Wipes every tenant-data table so `seed.ts` can rebuild a known fixture set.
-- Run this against the YR backend Supabase project BEFORE running seed.ts.
-- `restart identity cascade` also resets identity columns (e.g. rate_limit_hits.id)
-- and follows FK cascades, so listing order does not matter.

truncate table
  activity_hours,
  participation,
  applications,
  attachments,
  volunteer_chapter_link,
  chapters,
  opportunities,
  volunteers,
  org_volunteer_index,
  rate_limit_hits,
  admin_action_log,
  profile_field_changes,
  organizations
restart identity cascade;

-- volunteer_code default is `generate_volunteer_code()` which pulls from this
-- sequence (migration 0001). Reset it so re-seeded volunteers start at VOL-YYYY-000001.
alter sequence volunteer_code_seq restart with 1;

-- `truncate volunteers ... cascade` does not reach `auth.users` (the FK cascades
-- the other way). Clear it unconditionally so the seed's `auth.admin.createUser`
-- is repeatable: the YR project has no kept staff auth rows (staff auth lives on
-- the admin project), so per spec §"Reset & seed" every auth user is disposable.
delete from auth.users;

-- Storage objects (buckets `identity-docs`, `application-files`, `session-photos`)
-- are NOT deleted here: SQL cannot portably remove rows from `storage.objects`
-- across managed Supabase projects. The seed / deploy step empties the buckets
-- separately (seed.ts re-uploads its placeholder objects with `upsert: true`).
