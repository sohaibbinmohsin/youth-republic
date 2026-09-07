begin;
select plan(10);

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


-- --- RLS backstop (needs 0027 applied): chapter-scoped read visibility -------
reset role;
insert into organizations (id, name, slug)
  values ('44444444-4444-4444-4444-444444444444', 'RLS 0027 Org', 'rls-0027-org')
  on conflict (id) do nothing;
insert into opportunities (id, organization_id, name, type, chapter_id)
  values ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
          'RLS 0027 Opp', 'community', '66666666-6666-6666-6666-666666666666')
  on conflict (id) do nothing;
set role authenticated;

select set_config('request.jwt.claims', json_build_object(
  'module_access', json_build_array(json_build_object(
    'organization_id', '44444444-4444-4444-4444-444444444444',
    'module', 'youth-republic',
    'permissions', json_build_array('opportunities:read'),
    'chapter_scopes', json_build_object('opportunities:read', json_build_array('66666666-6666-6666-6666-666666666666'))
  ))
)::text, true);
select is((select count(*) from opportunities where id = '55555555-5555-5555-5555-555555555555'),
  1::bigint, 'RLS: in-scope opportunity is visible to a chapter-scoped reader');

select set_config('request.jwt.claims', json_build_object(
  'module_access', json_build_array(json_build_object(
    'organization_id', '44444444-4444-4444-4444-444444444444',
    'module', 'youth-republic',
    'permissions', json_build_array('opportunities:read'),
    'chapter_scopes', json_build_object('opportunities:read', json_build_array('77777777-7777-7777-7777-777777777777'))
  ))
)::text, true);
select is((select count(*) from opportunities where id = '55555555-5555-5555-5555-555555555555'),
  0::bigint, 'RLS: out-of-scope opportunity is hidden from a chapter-scoped reader');

reset role;

select * from finish();
rollback;
