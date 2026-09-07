-- 0026_opportunity_chapter_and_4arg_perm.sql
-- Chapter scoping: opportunities carry a platform chapter UUID; a 4-arg
-- permission check consults the token's per-key chapter_scopes.
-- See docs (platform repo): 2026-09-06-chapter-scoped-access-design.md §3, §4, §6.3.
-- (Renumbered from the plan's 0025 — 0025 is taken by yr_volunteer_code_prefix.)

alter table opportunities add column chapter_id uuid;  -- nullable, no FK (platform-owned id)

-- 4-arg permission check. The 3-arg staff_has_permission (0009) is unchanged
-- and still used by non-chapter-partitioned tables.
create or replace function staff_has_permission(
  p_org_id uuid, p_module text, p_permission text, p_target_chapter_id uuid
) returns boolean as $$
  select is_platform_owner() or exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'module_access', '[]'::jsonb)) m
    where (m ->> 'organization_id')::uuid = p_org_id
      and (m ->> 'module') = p_module
      and (m -> 'permissions') ? p_permission
      and (
        not (coalesce(m -> 'chapter_scopes', '{}'::jsonb) ? p_permission)
        or (
          p_target_chapter_id is not null
          and (m -> 'chapter_scopes' -> p_permission) ? p_target_chapter_id::text
        )
      )
  );
$$ language sql stable;

-- Spec §6.3: org_branding is a plain view that bypasses the base table's RLS
-- (Supabase flags it "unrestricted"). The exposure matches
-- organizations_public_select (deactivated_at is null); make it explicit.
alter view org_branding set (security_invoker = on);
