-- backend/supabase/tests/database/activity_hours_sessions_test.sql
begin;
select plan(4);

-- fixture orgs (opportunities.organization_id -> organizations FK, migration 0022)
insert into organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'pgTAP Org 1', 'pgtap-org-1'),
  ('22222222-2222-2222-2222-222222222222', 'pgTAP Org 2', 'pgtap-org-2'),
  ('00000000-0000-0000-0000-0000000000aa', 'pgTAP Org aa', 'pgtap-org-aa')
on conflict (id) do nothing;

select has_column('activity_hours', 'note', 'activity_hours.note exists');

-- seed a participation to hang hours off
insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
  values (gen_random_uuid(), 'S', 's@x.com', '111', '1990-01-01', 'other', 'C', 'P', 'PK', 'I', 'D');
insert into opportunities (id, organization_id, name, type)
  values ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa', 'O', 'community');
insert into participation (id, volunteer_id, opportunity_id, organization_id)
  select '00000000-0000-0000-0000-0000000000dd', id, '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa'
  from volunteers where email = 's@x.com';

with ins as (
  insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted)
  select '00000000-0000-0000-0000-0000000000dd', v.id, '00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000aa', '2024-01-01', 4
  from volunteers v where v.email = 's@x.com'
  returning verification_status
)
select is(
  (select verification_status from ins),
  'pending', 'new session defaults to pending');

select throws_ok(
  $$ update activity_hours set verification_status = 'recorded' $$,
  null, null, 'recorded is no longer an allowed status');

select lives_ok(
  $$ update activity_hours set verification_status = 'verified', hours_verified = 4 $$,
  'verified still allowed');

select * from finish();
rollback;
