begin;
set constraints all deferred;
select plan(4);

select has_table('public', 'admin_action_log', 'admin_action_log exists');
select has_table('public', 'profile_field_changes', 'profile_field_changes exists');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Log Test', 'log-test@example.com', '0300-6666666', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

select throws_ok(
  format($$ insert into profile_field_changes (volunteer_id, field_name, old_value, new_value) values ('%s', 'full_name', 'a', 'b') $$, :'vol_id'),
  '23514',
  null,
  'field_name is restricted to the safeguarding-relevant field list'
);

insert into profile_field_changes (volunteer_id, field_name, old_value, new_value)
values (:'vol_id', 'dob', '1999-01-01', '1998-01-01');

select is((select count(*) from profile_field_changes where volunteer_id = :'vol_id'), 1::bigint, 'allowed field_name is accepted');

select * from finish();
rollback;
