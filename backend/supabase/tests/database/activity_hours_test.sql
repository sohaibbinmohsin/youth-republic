begin;
set constraints all deferred;
select plan(5);

select has_table('public', 'activity_hours', 'activity_hours exists');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Hours Test', 'hours-test@example.com', '0300-4444444', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

insert into opportunities (organization_id, name, type)
values ('11111111-1111-1111-1111-111111111111', 'Tutoring', 'ongoing')
returning id as opp_id \gset

insert into participation (volunteer_id, opportunity_id, organization_id)
values (:'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111')
returning id as part_id \gset

insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted, hours_verified, verification_status)
values (:'part_id', :'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111', current_date, 4, 4, 'verified');

insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted, verification_status, rejection_reason)
values (:'part_id', :'vol_id', :'opp_id', '11111111-1111-1111-1111-111111111111', current_date, 2, 'rejected', 'No sign-in sheet provided');

select is(volunteer_total_verified_hours(:'vol_id'), 4::numeric, 'only verified hours count toward total');
select is((select count(*) from activity_hours where verification_status = 'rejected'), 1::bigint, 'rejected rows are retained, not deleted');

select throws_ok(
  format($$ insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted) values ('%s', '%s', '%s', '11111111-1111-1111-1111-111111111111', current_date, -1) $$, :'part_id', :'vol_id', :'opp_id'),
  '23514',
  null,
  'non-positive hours_submitted is rejected'
);

select * from finish();
rollback;
