begin;
set constraints all deferred;
select plan(10);

insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'RLS Test', 'rls-test@example.com', '0300-7777777', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

select touch_org_volunteer_index('22222222-2222-2222-2222-222222222222', :'vol_id');

select set_config('request.jwt.claims', format('{"sub": "%s"}', (select auth_user_id from volunteers where id = :'vol_id')), true);
select set_config('role', 'authenticated', true);
update volunteers set id_doc_number = '00000000000' where id = :'vol_id';
select is(
  (select id_doc_number from volunteers where id = :'vol_id'),
  null,
  'a volunteer cannot update their own row directly via RLS — with no self-update policy, the UPDATE silently matches zero rows (RLS filters rows for UPDATE, it does not raise); only updateSensitiveField() and registerVolunteer() (service-role Edge Functions) may write volunteers'
);

-- Unlike UPDATE above, a missing INSERT policy makes Postgres evaluate an
-- implicit `with check (false)` — the insert itself raises an RLS violation
-- rather than silently affecting zero rows (same distinction already drawn
-- for applications/activity_hours in rls_org_scoped_test.sql).
select set_config('request.jwt.claims', format('{"sub": "%s"}', gen_random_uuid()), true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$ insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
     values (gen_random_uuid(), 'Self-Registered Bypass', 'self-register-bypass@example.com', '0300-6666666', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS') $$,
  null,
  null,
  'a volunteer-side client cannot insert into volunteers directly via RLS — no self-insert policy exists; only registerVolunteer() (service-role, enforcing minor-consent and near-duplicate flagging) may create a volunteer row'
);

select set_config('request.jwt.claims', '{"platform_owner": true}', true);
select is(is_platform_owner(), true, 'platform_owner claim recognized');

select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "22222222-2222-2222-2222-222222222222"}]}', true);
select ok('22222222-2222-2222-2222-222222222222'::uuid = any(staff_org_ids()), 'staff_org_ids extracts org uuids from claim');
select is(staff_has_org_role('22222222-2222-2222-2222-222222222222'::uuid), true, 'staff_has_org_role true for a matching org');
select is(staff_has_org_role('33333333-3333-3333-3333-333333333333'::uuid), false, 'staff_has_org_role false for a non-matching org');

select set_config('request.jwt.claims', '{}', true);
select is(staff_has_org_role('22222222-2222-2222-2222-222222222222'::uuid), false, 'no claim means no access');

select set_config('request.jwt.claims', '{"module_access": [{"organization_id": "22222222-2222-2222-2222-222222222222", "module": "vms", "permissions": ["applications:update"]}]}', true);
select is(staff_has_permission('22222222-2222-2222-2222-222222222222'::uuid, 'vms', 'applications:update'), true, 'staff_has_permission true for a granted permission');
select is(staff_has_permission('22222222-2222-2222-2222-222222222222'::uuid, 'vms', 'applications:write'), false, 'staff_has_permission false for an ungranted permission');

select set_config('request.jwt.claims', '{"platform_owner": true}', true);
select is(staff_has_permission('44444444-4444-4444-4444-444444444444'::uuid, 'vms', 'applications:write'), true, 'platform_owner bypasses permission checks entirely');

select * from finish();
rollback;
