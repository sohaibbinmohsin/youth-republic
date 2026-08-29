begin;
set constraints all deferred;
select plan(3);

-- Seed one null-organization_id audit row (the shape register-volunteer writes
-- for duplicate_flagged) and one org-scoped row, as service_role.
select set_config('role', 'service_role', true);

insert into admin_action_log (staff_id, actor_type, action, target_type, target_id, organization_id, metadata)
values (null, 'system', 'duplicate_flagged', 'volunteer', gen_random_uuid(), null, '{"matches": ["11111111-1111-1111-1111-111111111111"]}'::jsonb)
returning id as null_org_log_id \gset

insert into admin_action_log (staff_id, actor_type, action, target_type, target_id, organization_id, metadata)
values (gen_random_uuid(), 'staff', 'opportunity_updated', 'opportunity', gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '{}'::jsonb)
returning id as org_log_id \gset

-- (a) A plain authenticated caller with no staff claims at all must not see the
-- null-organization_id row. This is the regression that matters: 0010's
-- `organization_id is null` disjunct made it unconditionally visible.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', '{}', true);
select is(
  (select count(*) from admin_action_log where id = :'null_org_log_id'),
  0::bigint,
  'an authenticated caller with no staff claims cannot read an admin_action_log row with a null organization_id'
);

-- (b) A platform owner still sees null-org rows — these audit entries have no
-- owning org, so platform_owner is the only correct audience.
select set_config('request.jwt.claims', '{"platform_owner": true}', true);
select is(
  (select count(*) from admin_action_log where id = :'null_org_log_id'),
  1::bigint,
  'a platform owner can still read an admin_action_log row with a null organization_id'
);

-- (c) Regression check that the normal org-scoped path is untouched.
select set_config('request.jwt.claims', '{"org_roles": [{"organization_id": "44444444-4444-4444-4444-444444444444"}]}', true);
select is(
  (select count(*) from admin_action_log where id = :'org_log_id'),
  1::bigint,
  'staff affiliated with the owning org can still read that org''s admin_action_log rows'
);

select * from finish();
rollback;
