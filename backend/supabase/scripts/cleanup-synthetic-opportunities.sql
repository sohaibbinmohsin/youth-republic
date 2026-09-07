-- Periodic hygiene: purge synthetic test-created `opportunities` rows from
-- this hosted project.
--
-- Companion to cleanup-synthetic-test-data.sql (which handles auth.users).
-- That file deliberately left opportunities/orgs/chapters alone. This one
-- clears the opportunity backlog that the Deno handler suite leaves behind:
-- create-opportunity/update-opportunity/list-* tests each insert rows via
-- `createOpportunity(supabase, claims, { organizationId, name, type })` with
-- NO teardown, so every full run adds a dozen-plus bare rows ("Verify Test
-- Opp", "Form Target", "Guard Target", "Draft Opp", "Opp <uuid>", ...). As
-- of 2026-09-07 the volunteer noticeboard was showing 200+ of them.
--
-- Discriminator: a real, admin-authored drive comes from the partner-admin
-- CreateOpportunityForm, where every Step 1 field is now mandatory, so it
-- always has description + about + capacity + all four schedule timestamps
-- populated AND non-empty duties / eligibility / what_to_bring arrays. The
-- test fixtures set none of those -- they pass name + type only (a couple
-- set about/duties but still no description, capacity, location or dates).
-- Everything that fails the "fully specified" test below is synthetic.
--
-- applications, participation and activity_hours all declare
-- `opportunity_id ... on delete cascade` (0004/0005/0006), so deleting the
-- synthetic opportunity rows also clears their child rows -- no separate
-- deletes needed. admin_action_log is append-only (same as the companion
-- script): its now-dangling `opportunity_created` rows are left in place.
--
-- Usage -- ALWAYS run the preview first and eyeball the keeper list:
--   psql "$SUPABASE_DB_URL" -f supabase/scripts/cleanup-synthetic-opportunities.sql
-- then, once the keeper count matches what you expect, run for real:
--   psql "$SUPABASE_DB_URL" -v run=1 -f supabase/scripts/cleanup-synthetic-opportunities.sql
--
-- The real delete aborts (whole transaction rolls back) unless exactly
-- :keep_expected drives survive the filter, so a mis-tuned discriminator
-- can never nuke real data. Override with  -v keep_expected=NN  if the
-- preview's "keep" count is a number you have verified is correct.

\if :{?run}
\else
  \set run 0
\endif

\if :{?keep_expected}
\else
  \set keep_expected 14
\endif

-- Genuine, fully-specified drives. Everything else in `opportunities` is
-- treated as synthetic test residue.
create or replace temporary view _keeper_ids as
select o.id
from opportunities o
where o.description is not null
  and o.about is not null
  and o.capacity is not null
  and o.application_open_at is not null
  and o.application_deadline is not null
  and o.activity_start_at is not null
  and o.activity_end_at is not null
  and array_length(o.duties, 1) is not null
  and array_length(o.eligibility, 1) is not null
  and array_length(o.what_to_bring, 1) is not null;

-- ---------------------------------------------------------------------------
-- Preview
-- ---------------------------------------------------------------------------

\echo '== Drives that will be KEPT =='
select o.id,
       o.name,
       org.name as organization,
       opportunity_status(o.*) as status
from opportunities o
join organizations org on org.id = o.organization_id
where o.id in (select id from _keeper_ids)
order by org.name, o.name;

\echo '== Count summary =='
select (select count(*) from _keeper_ids)                                         as keep,
       (select count(*) from opportunities) - (select count(*) from _keeper_ids)  as delete_synthetic,
       (select count(*) from opportunities)                                       as total;

\echo '== Synthetic rows to be deleted, by organization =='
select org.name as organization, count(*) as synthetic_opportunities
from opportunities o
join organizations org on org.id = o.organization_id
where o.id not in (select id from _keeper_ids)
group by org.name
order by synthetic_opportunities desc, organization;

-- ---------------------------------------------------------------------------
-- Delete (only with -v run=1)
-- ---------------------------------------------------------------------------

\if :run
begin;

-- Hand the expected count to the guard block. psql does NOT interpolate
-- :vars inside a dollar-quoted body, so it goes via a temp table instead.
drop table if exists _expected;
create temp table _expected as select :keep_expected::int as n;

do $$
declare
  keep_count int;
  expected   int;
begin
  select n into expected from _expected;
  select count(*) into keep_count from _keeper_ids;

  if keep_count <> expected then
    raise exception
      'Aborting: % drives match the keeper filter, expected % (re-run with  -v keep_expected=%  once you have verified that count).',
      keep_count, expected, keep_count;
  end if;
end $$;

delete from opportunities
where id not in (select id from _keeper_ids);

select count(*) as opportunities_remaining from opportunities;

drop table if exists _expected;
commit;
\echo 'Synthetic opportunities deleted.'
\else
\echo 'Preview only. Re-run with  -v run=1  to delete the synthetic rows.'
\endif
