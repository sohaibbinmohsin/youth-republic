-- Periodic hygiene: purge synthetic test-created rows from this hosted
-- project.
--
-- This repo's Deno test suite runs as integration tests against a real
-- hosted Supabase project (README: "no local Docker stack"), not an
-- ephemeral local one. pgTAP tests (supabase/tests/database/*.sql) already
-- leave zero residue -- every file wraps its work in `begin ... rollback`.
-- Deno handler tests do not: several of them call
-- `supabase.auth.admin.createUser()` to get a real auth_user_id to register
-- a volunteer against, with no teardown, so every full test-suite run
-- leaves real (synthetic-but-real-shaped) rows behind permanently.
--
-- The pattern is exhaustive and narrow: every `auth.admin.createUser()`
-- call site across the whole suite (grepped, not assumed) uses the exact
-- literal email shape `auth-${crypto.randomUUID()}@example.com`. As of
-- 2026-08-29, every single row in this project's `auth.users` matched that
-- pattern (599 of 599) -- this project has no real volunteer signups yet
-- (vms/frontend isn't live), so there is currently nothing else in this
-- table to accidentally catch. Re-verify the counts below still make sense
-- for your situation before running the delete if this project ever starts
-- holding real volunteer accounts.
--
-- `volunteers.auth_user_id` and every table with a `volunteer_id` foreign
-- key (applications, participation, activity_hours, org_volunteer_index,
-- volunteer_chapter_link, profile_field_changes) are declared
-- `on delete cascade` from `volunteers`/`auth.users`, so deleting the
-- matching auth.users rows is sufficient to clean up everything those rows
-- created -- no separate deletes needed for those tables.
--
-- Deliberately NOT touched: admin_action_log. It is this project's one
-- explicitly append-only log (see 0014_drop_orphaned_delete_policies.sql
-- and the vms-backend plan's own "no hard deletes outside append-only
-- logs" constraint) -- rows a deleted test volunteer's actions wrote to it
-- become inert (their target_id no longer resolves) but are not deleted,
-- consistent with how this codebase treats that table everywhere else.
-- Also not touched: opportunities/chapters/organizations test rows, which
-- carry synthetic org/event names, not personal data -- out of scope for a
-- PII cleanup pass.
--
-- Usage: review the count this prints, then run for real:
--   psql "$SUPABASE_DB_URL" -f backend/supabase/scripts/cleanup-synthetic-test-data.sql

select count(*) as auth_users_matching_synthetic_pattern
from auth.users
where email like 'auth-%@example.com';

delete from auth.users where email like 'auth-%@example.com';
