-- 0027_chapter_scoped_rls.sql — align staff RLS on the chapter-partitioned
-- tables with the 4-arg permission check. Also fixes the stale 'vms' module
-- literal left in 0010 (the modules table was renamed vms->youth-republic in
-- the platform project; the token has always carried 'youth-republic').
-- These policies are a backstop — all admin access is via service-role Edge
-- Functions that already check in code (this plan's Tasks 5-8).
--
-- Renumbered from the plan's 0026 (0025 is taken by yr_volunteer_code_prefix).
-- The `applications` policies preserve 0024's draft / active-volunteer guards
-- and only add the 4-arg chapter check + the 'vms' -> 'youth-republic' fix.

-- opportunities
drop policy if exists opportunities_staff_select on opportunities;
create policy opportunities_staff_select on opportunities
  for select using (staff_has_permission(organization_id, 'youth-republic', 'opportunities:read', chapter_id));

drop policy if exists opportunities_staff_insert on opportunities;
create policy opportunities_staff_insert on opportunities
  for insert with check (staff_has_permission(organization_id, 'youth-republic', 'opportunities:write', chapter_id));

drop policy if exists opportunities_staff_update on opportunities;
create policy opportunities_staff_update on opportunities
  for update using (staff_has_permission(organization_id, 'youth-republic', 'opportunities:update', chapter_id));

-- opportunities_staff_delete was dropped in 0014 and is not recreated —
-- delete is a service-role-only path (update-opportunity handler).

-- applications (chapter derived through the opportunity link; 0024 guards kept)
drop policy if exists applications_staff_select on applications;
create policy applications_staff_select on applications
  for select using (
    (is_platform_owner() and status != 'draft')
    or (
      staff_has_permission(
        organization_id, 'youth-republic', 'applications:read',
        (select o.chapter_id from opportunities o where o.id = applications.opportunity_id))
      and status != 'draft'
      and volunteer_id in (select id from volunteers where status = 'active')
    )
  );

drop policy if exists applications_staff_update on applications;
create policy applications_staff_update on applications
  for update using (
    staff_has_permission(
      organization_id, 'youth-republic', 'applications:update',
      (select o.chapter_id from opportunities o where o.id = applications.opportunity_id))
    and (
      is_platform_owner()
      or (
        status != 'draft'
        and volunteer_id in (select id from volunteers where status = 'active')
      )
    )
  );

-- activity_hours
drop policy if exists activity_hours_staff_select on activity_hours;
create policy activity_hours_staff_select on activity_hours
  for select using (staff_has_permission(
    organization_id, 'youth-republic', 'hours:read',
    (select o.chapter_id from opportunities o where o.id = activity_hours.opportunity_id)));

drop policy if exists activity_hours_staff_update on activity_hours;
create policy activity_hours_staff_update on activity_hours
  for update using (staff_has_permission(
    organization_id, 'youth-republic', 'hours:update',
    (select o.chapter_id from opportunities o where o.id = activity_hours.opportunity_id)));
