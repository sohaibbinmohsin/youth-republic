begin;
select plan(8);

select has_column('public', 'opportunities', 'chapter_id', 'opportunities.chapter_id exists');
select has_function('public', 'staff_has_permission', ARRAY['uuid','text','text','uuid'], '4-arg staff_has_permission exists');

-- Drive the function via a fake JWT claims blob.
select set_config('role', 'authenticated', true);

-- Case A: unrestricted key (not in chapter_scopes) -> true for any target, incl. null.
select set_config('request.jwt.claims', json_build_object(
  'module_access', json_build_array(json_build_object(
    'organization_id', '11111111-1111-1111-1111-111111111111',
    'module', 'youth-republic',
    'permissions', json_build_array('opportunities:read'),
    'chapter_scopes', json_build_object()
  ))
)::text, true);
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:read', null),
  true, 'unrestricted key: true even for a null target');
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:read',
  '22222222-2222-2222-2222-222222222222'::uuid), true, 'unrestricted key: true for any chapter');

-- Case B: scoped key -> true only for a listed chapter, false for others and for null.
select set_config('request.jwt.claims', json_build_object(
  'module_access', json_build_array(json_build_object(
    'organization_id', '11111111-1111-1111-1111-111111111111',
    'module', 'youth-republic',
    'permissions', json_build_array('opportunities:write'),
    'chapter_scopes', json_build_object('opportunities:write', json_build_array('22222222-2222-2222-2222-222222222222'))
  ))
)::text, true);
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:write',
  '22222222-2222-2222-2222-222222222222'::uuid), true, 'scoped key: true for the listed chapter');
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:write',
  '33333333-3333-3333-3333-333333333333'::uuid), false, 'scoped key: false for a different chapter');
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'opportunities:write', null),
  false, 'scoped key: false for a null (org-wide) target');

-- Case C: key absent from permissions entirely -> false.
select is(staff_has_permission('11111111-1111-1111-1111-111111111111'::uuid, 'youth-republic', 'hours:update', null),
  false, 'key not granted at all: false');

select * from finish();
rollback;
