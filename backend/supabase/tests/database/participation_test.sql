begin;
set constraints all deferred;
select plan(4);

-- fixture orgs (opportunities.organization_id -> organizations FK, migration 0022)
insert into organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'pgTAP Org 1', 'pgtap-org-1'),
  ('22222222-2222-2222-2222-222222222222', 'pgTAP Org 2', 'pgtap-org-2')
on conflict (id) do nothing;

select has_table('public', 'participation', 'participation exists');
select has_column('public', 'participation', 'application_id', 'application_id present');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Part Test', 'part-test@example.com', '0300-3333333', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

insert into opportunities (organization_id, name, type)
values ('11111111-1111-1111-1111-111111111111', 'Tutoring', 'ongoing')
returning id as opp_id \gset

insert into participation (volunteer_id, opportunity_id, organization_id)
values (:'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111');

select is((select status from participation where volunteer_id = :'vol_id'), 'selected', 'defaults to selected, admin-enrolled without an application');

insert into applications (volunteer_id, opportunity_id, organization_id)
values (:'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111')
returning id as app_id \gset

insert into participation (application_id, volunteer_id, opportunity_id, organization_id)
values (:'app_id', :'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111');

select throws_ok(
  format($$ insert into participation (application_id, volunteer_id, opportunity_id, organization_id) values ('%s', '%s', '%s', '11111111-1111-1111-1111-111111111111') $$, :'app_id', :'vol_id', :'opp_id'),
  '23505',
  null,
  'a second participation row for the same application_id is rejected — regression test for decideApplication double-selection creating duplicates'
);

select * from finish();
rollback;
