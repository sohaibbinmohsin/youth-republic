-- 0010's admin_action_log_staff_select was
--   for select using (organization_id is null or staff_has_org_role(organization_id))
-- with no `to` clause, so the `organization_id is null` branch was
-- unconditionally true for ANY authenticated (or anon) caller — not just
-- platform owners. That leaked the null-org audit rows (today: the
-- `duplicate_flagged` entries written by register-volunteer, whose metadata
-- carries other volunteers' UUIDs) to every logged-in volunteer.
--
-- Restrict the null-org branch to platform owners, keeping the normal
-- org-scoped staff read path unchanged.

drop policy if exists admin_action_log_staff_select on admin_action_log;

create policy admin_action_log_staff_select on admin_action_log
  for select using (
    is_platform_owner()
    or (organization_id is not null and staff_has_org_role(organization_id))
  );
