begin;
set constraints all deferred;
select plan(9);

select has_table('public', 'volunteers', 'volunteers table exists');
select has_column('public', 'volunteers', 'email', 'has email column');
select col_is_unique('public', 'volunteers', 'email', 'email is unique');
select col_is_unique('public', 'volunteers', 'phone', 'phone is unique');
select col_is_unique('public', 'volunteers', 'id_doc_number', 'id_doc_number is unique');
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'volunteers' and column_name = 'organization_id'
  ),
  'volunteers must not carry organization_id'
);

select is(volunteer_is_minor('2015-01-01'::date), true, 'a 2015-born registrant is a minor');
select is(volunteer_is_minor('1990-01-01'::date), false, 'a 1990-born registrant is not a minor');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Guardian Test', 'guardian-test@example.com', '0300-0000000', '2015-01-01', 'female', 'Lahore', 'Punjab', 'Pakistan', 'Test School', 'O-Level');

select throws_ok(
  $$ update volunteers set guardian_name = 'Only Name' where email = 'guardian-test@example.com' $$,
  '23514',
  null,
  'guardian_name alone without guardian_contact violates the paired-fields constraint'
);

select * from finish();
rollback;
