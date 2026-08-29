begin;
set constraints all deferred;
select plan(10);

insert into opportunities (organization_id, name, type)
values ('22222222-2222-2222-2222-222222222222', 'Public Op', 'event')
returning id as opp_id \gset

select set_config('request.jwt.claims', '{}', true);
select set_config('role', 'authenticated', true);
select is((select count(*) from opportunities where id = :'opp_id'), 1::bigint, 'anyone can read a non-deactivated opportunity');

select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "33333333-3333-3333-3333-333333333333"}]}', true);
update opportunities set name = 'hijacked' where id = :'opp_id';
select is(
  (select name from opportunities where id = :'opp_id'),
  'Public Op',
  'staff from a different org cannot write to this opportunity — RLS silently matches zero rows for UPDATE (does not raise), same as Task 10''s volunteers_self_update precedent, not throws_ok'
);

select set_config(
  'request.jwt.claims',
  '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222"}], "module_access": [{"organization_id": "22222222-2222-2222-2222-222222222222", "module": "vms", "permissions": ["opportunities:read"]}]}',
  true
);
update opportunities set name = 'read-only hijack' where id = :'opp_id';
select is(
  (select name from opportunities where id = :'opp_id'),
  'Public Op',
  'staff from the owning org with only opportunities:read cannot write to this opportunity — org membership alone is not enough'
);

select set_config(
  'request.jwt.claims',
  '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222"}], "module_access": [{"organization_id": "22222222-2222-2222-2222-222222222222", "module": "vms", "permissions": ["opportunities:update"]}]}',
  true
);
update opportunities set name = 'updated by owning org staff' where id = :'opp_id';
select is((select name from opportunities where id = :'opp_id'), 'updated by owning org staff', 'staff from the owning org with opportunities:update can write');

select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from applications), 0::bigint, 'no applications visible with no volunteer session and no staff claim');

select set_config('role', 'service_role', true);
insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'OVI Fixture', 'ovi-fixture-test@example.com', '0300-9999999', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as ovi_vol_id \gset

select touch_org_volunteer_index('22222222-2222-2222-2222-222222222222', :'ovi_vol_id');
select set_config('role', 'authenticated', true);

select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from org_volunteer_index), 0::bigint, 'org_volunteer_index is not readable with no staff claim — regression test for the table having no RLS at all');

select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222"}]}', true);
select is((select count(*) from org_volunteer_index where organization_id = '22222222-2222-2222-2222-222222222222'), 1::bigint, 'staff affiliated with the org can read its org_volunteer_index rows');

select throws_ok(
  $$ insert into org_volunteer_index (organization_id, volunteer_id) values ('22222222-2222-2222-2222-222222222222', gen_random_uuid()) $$,
  null,
  null,
  'no insert policy exists for org_volunteer_index — even an owning-org staff member cannot write it directly, only touch_org_volunteer_index() via the service-role client can'
);

select set_config('role', 'service_role', true);
insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Direct Insert Test', 'direct-insert-test@example.com', '0300-8888888', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id, auth_user_id \gset direct_insert_

insert into participation (volunteer_id, opportunity_id, organization_id)
values (:'direct_insert_id', :'opp_id', '22222222-2222-2222-2222-222222222222')
returning id as direct_insert_participation_id \gset
select set_config('role', 'authenticated', true);

select set_config('request.jwt.claims', format('{"sub": "%s"}', :'direct_insert_auth_user_id'), true);
select set_config('role', 'authenticated', true);

-- Unlike UPDATE (Task 10's volunteers_self_update test), a missing INSERT
-- policy makes Postgres evaluate an implicit `with check (false)` — the insert
-- itself raises an RLS violation rather than silently affecting zero rows.
select throws_ok(
  format($$ insert into applications (volunteer_id, opportunity_id, organization_id) values ('%s', '%s', '22222222-2222-2222-2222-222222222222') $$, :'direct_insert_id', :'opp_id'),
  null,
  null,
  'a volunteer cannot insert into applications directly via RLS — no self-insert policy exists; only apply-to-opportunity() (service-role, enforces cnic_required) may write it'
);

select throws_ok(
  format(
    $$ insert into activity_hours (participation_id, volunteer_id, opportunity_id, organization_id, activity_date, hours_submitted) values ('%s', '%s', '%s', '22222222-2222-2222-2222-222222222222', current_date, 3) $$,
    :'direct_insert_participation_id', :'direct_insert_id', :'opp_id'
  ),
  null,
  null,
  'a volunteer cannot insert into activity_hours directly via RLS — no self-insert policy exists; only submit-hours() (service-role) may write it'
);

select * from finish();
rollback;
