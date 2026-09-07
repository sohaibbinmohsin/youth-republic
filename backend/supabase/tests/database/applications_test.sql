begin;
set constraints all deferred;
select plan(5);

-- fixture orgs (opportunities.organization_id -> organizations FK, migration 0022)
insert into organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'pgTAP Org 1', 'pgtap-org-1'),
  ('22222222-2222-2222-2222-222222222222', 'pgTAP Org 2', 'pgtap-org-2')
on conflict (id) do nothing;

select has_table('public', 'applications', 'applications exists');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'App Test', 'app-test@example.com', '0300-2222222', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

insert into opportunities (organization_id, name, type)
values ('11111111-1111-1111-1111-111111111111', 'Tutoring', 'ongoing')
returning id as opp_id \gset

insert into applications (volunteer_id, opportunity_id, organization_id)
values (:'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111');

select is((select status from applications where volunteer_id = :'vol_id'), 'pending_review', 'defaults to pending_review');

select throws_ok(
  format($$ insert into applications (volunteer_id, opportunity_id, organization_id) values ('%s', '%s', '11111111-1111-1111-1111-111111111111') $$, :'vol_id', :'opp_id'),
  '23505',
  null,
  'duplicate application for the same volunteer+opportunity is rejected'
);

select throws_ok(
  format($$ update applications set status = 'bogus' where volunteer_id = '%s' $$, :'vol_id'),
  '23514',
  null,
  'invalid status is rejected'
);

update applications set status = 'waitlisted' where volunteer_id = :'vol_id';
select is((select status from applications where volunteer_id = :'vol_id'), 'waitlisted', 'waitlisted is a valid status for manual admin promotion later');

select * from finish();
rollback;
