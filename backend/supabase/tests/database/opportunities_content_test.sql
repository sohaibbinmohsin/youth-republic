-- backend/supabase/tests/database/opportunities_content_test.sql
begin;
select plan(7);

-- fixture orgs (opportunities.organization_id -> organizations FK, migration 0022)
insert into organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'pgTAP Org 1', 'pgtap-org-1'),
  ('22222222-2222-2222-2222-222222222222', 'pgTAP Org 2', 'pgtap-org-2'),
  ('00000000-0000-0000-0000-0000000000aa', 'pgTAP Org aa', 'pgtap-org-aa')
on conflict (id) do nothing;

select has_column('opportunities', 'about', 'opportunities.about exists');
select has_column('opportunities', 'duties', 'opportunities.duties exists');
select has_column('opportunities', 'eligibility', 'opportunities.eligibility exists');
select has_column('opportunities', 'what_to_bring', 'opportunities.what_to_bring exists');
select has_column('opportunities', 'application_form', 'opportunities.application_form exists');
select hasnt_column('opportunities', 'eligibility_criteria', 'old eligibility_criteria dropped');

-- brief's Step 1 used `insert ... returning id` as a scalar subquery, which is not
-- valid PostgreSQL; hoisted into a CTE so the same assertion can run.
with inserted as (
  insert into opportunities (organization_id, name, type)
  values ('00000000-0000-0000-0000-0000000000aa','O','community')
  returning application_form
)
select is(
  (select application_form from inserted),
  '{"version": 1, "fields": []}'::jsonb,
  'application_form defaults to an empty form');

select * from finish();
rollback;
