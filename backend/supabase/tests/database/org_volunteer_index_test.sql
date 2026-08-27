begin;
set constraints all deferred;
select plan(4);

select has_table('public', 'org_volunteer_index', 'org_volunteer_index exists');
select col_is_pk('public', 'org_volunteer_index', array['organization_id', 'volunteer_id'], 'composite pk');

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Index Test', 'index-test@example.com', '0300-1111111', '1999-01-01', 'male', 'Karachi', 'Sindh', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

select touch_org_volunteer_index('11111111-1111-1111-1111-111111111111', :'vol_id');
select is((select count(*) from org_volunteer_index where volunteer_id = :'vol_id'), 1::bigint, 'first touch inserts one row');

select touch_org_volunteer_index('11111111-1111-1111-1111-111111111111', :'vol_id');
select is((select count(*) from org_volunteer_index where volunteer_id = :'vol_id'), 1::bigint, 'second touch updates, does not duplicate');

select * from finish();
rollback;
