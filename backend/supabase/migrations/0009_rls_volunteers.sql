create or replace function is_platform_owner() returns boolean as $$
  select coalesce((auth.jwt() ->> 'platform_owner')::boolean, false);
$$ language sql stable;

create or replace function staff_org_ids() returns uuid[] as $$
  select coalesce(array_agg((r ->> 'organization_id')::uuid), '{}')
  from jsonb_array_elements(coalesce(auth.jwt() -> 'org_roles', '[]'::jsonb)) r;
$$ language sql stable;

create or replace function staff_has_org_role(p_org_id uuid) returns boolean as $$
  select is_platform_owner() or exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'org_roles', '[]'::jsonb)) r
    where (r ->> 'organization_id')::uuid = p_org_id
  );
$$ language sql stable;

create or replace function staff_has_permission(p_org_id uuid, p_module text, p_permission text) returns boolean as $$
  select is_platform_owner() or exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'module_access', '[]'::jsonb)) m
    where (m ->> 'organization_id')::uuid = p_org_id
      and (m ->> 'module') = p_module
      and (m -> 'permissions') ? p_permission
  );
$$ language sql stable;

alter table volunteers enable row level security;

create policy volunteers_self_select on volunteers
  for select using (auth_user_id = auth.uid());

-- Deliberately no self-update policy: a volunteer's own row is written only by
-- registerVolunteer() and updateSensitiveField() (both service-role Edge
-- Functions). RLS update policies filter which rows an UPDATE can touch, not
-- which columns, so there is no safe narrower policy here that still lets a
-- volunteer bypass updateSensitiveField()'s profile_field_changes audit log.

create policy volunteers_staff_select on volunteers
  for select using (
    is_platform_owner()
    or exists (
      select 1 from org_volunteer_index ovi
      where ovi.volunteer_id = volunteers.id
        and ovi.organization_id = any(staff_org_ids())
    )
  );
