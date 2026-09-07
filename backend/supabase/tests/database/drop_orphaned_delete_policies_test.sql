begin;
set constraints all deferred;
select plan(3);

-- fixture orgs (opportunities.organization_id -> organizations FK, migration 0022)
insert into organizations (id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'pgTAP Org 1', 'pgtap-org-1'),
  ('22222222-2222-2222-2222-222222222222', 'pgTAP Org 2', 'pgtap-org-2')
on conflict (id) do nothing;

-- Fixtures: one row in each of the three tables whose orphaned delete
-- policies (from 0010_rls_org_scoped.sql) this migration removes.
insert into opportunities (organization_id, name, type)
values ('22222222-2222-2222-2222-222222222222', 'Delete Target Op', 'event')
returning id as opp_id \gset

insert into chapters (organization_id, name, institution, city, province)
values ('22222222-2222-2222-2222-222222222222', 'Delete Target Chapter', 'Test Uni', 'Lahore', 'Punjab')
returning id as chapter_id \gset

-- A separate chapter for the volunteer_chapter_link fixture, distinct from
-- chapter_id above: chapter_id gets directly DELETEd by the assertion below,
-- and volunteer_chapter_link.chapter_id is `on delete cascade` — sharing one
-- chapter row would let that delete silently remove the link row first,
-- making the link assertion pass/fail for the wrong reason.
insert into chapters (organization_id, name, institution, city, province)
values ('22222222-2222-2222-2222-222222222222', 'Link Fixture Chapter', 'Test Uni', 'Lahore', 'Punjab')
returning id as link_chapter_fixture_id \gset

select set_config('role', 'service_role', true);
insert into volunteers (auth_user_id, full_name, email, phone, dob, gender, city, province, country, institution, degree_program)
values (gen_random_uuid(), 'Delete Target Volunteer', 'delete-target-vol@example.com', '0300-5555555', '1999-01-01', 'male', 'Lahore', 'Punjab', 'Pakistan', 'Test Uni', 'BSCS')
returning id as vol_id \gset

insert into volunteer_chapter_link (volunteer_id, chapter_id, organization_id)
values (:'vol_id', :'link_chapter_fixture_id', '22222222-2222-2222-2222-222222222222')
returning volunteer_id, chapter_id \gset link_
select set_config('role', 'authenticated', true);

-- Even the maximally-permissioned staff claim (platform_owner, which
-- short-circuits every staff_has_permission()/staff_has_org_role() check)
-- must not be able to hard-delete these rows directly via RLS: no Edge
-- Function was ever built to pair with these delete policies (they were
-- orphaned from Task 10 — see this migration's header comment), so hard
-- delete was never a supported path for these tables; deactivated_at is.
select set_config('request.jwt.claims', '{"platform_owner": true}', true);

delete from opportunities where id = :'opp_id';
select is(
  (select count(*) from opportunities where id = :'opp_id'),
  1::bigint,
  'a platform_owner staff claim cannot delete an opportunity directly via RLS — no delete policy exists; hard deletes are not a supported path (deactivated_at is)'
);

delete from chapters where id = :'chapter_id';
select is(
  (select count(*) from chapters where id = :'chapter_id'),
  1::bigint,
  'a platform_owner staff claim cannot delete a chapter directly via RLS — no delete policy exists'
);

delete from volunteer_chapter_link where volunteer_id = :'link_volunteer_id' and chapter_id = :'link_chapter_id';
select is(
  (select count(*) from volunteer_chapter_link where volunteer_id = :'link_volunteer_id' and chapter_id = :'link_chapter_id'),
  1::bigint,
  'a platform_owner staff claim cannot delete a volunteer_chapter_link row directly via RLS — no delete policy exists'
);

select * from finish();
rollback;
