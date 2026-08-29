begin;
set constraints all deferred;
select plan(5);

select has_table('public', 'applications', 'applications exists');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'App Test', 'app-test@example.com', '0300-2222222', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

insert into opportunities (organization_id, name, type)
values ('11111111-1111-1111-1111-111111111111', 'Tutoring', 'ongoing')
returning id as opp_id \gset

insert into applications (volunteer_id, opportunity_id, organization_id)
values (:'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111');

select is((select status from applications where volunteer_id = :'vol_id'), 'submitted', 'defaults to submitted');

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
