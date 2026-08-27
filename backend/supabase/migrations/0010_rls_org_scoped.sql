alter table opportunities enable row level security;

create policy opportunities_public_select on opportunities
  for select using (deactivated_at is null);

create policy opportunities_staff_select on opportunities
  for select using (staff_has_org_role(organization_id));

create policy opportunities_staff_insert on opportunities
  for insert with check (staff_has_permission(organization_id, 'vms', 'opportunities:write'));

create policy opportunities_staff_update on opportunities
  for update using (staff_has_permission(organization_id, 'vms', 'opportunities:update'));

create policy opportunities_staff_delete on opportunities
  for delete using (staff_has_permission(organization_id, 'vms', 'opportunities:delete'));

alter table applications enable row level security;

create policy applications_self_select on applications
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

-- Deliberately no self-insert policy: apply-to-opportunity() (service-role)
-- enforces cnic_required before writing; a direct insert would bypass that.

create policy applications_staff_select on applications
  for select using (staff_has_org_role(organization_id));

create policy applications_staff_update on applications
  for update using (staff_has_permission(organization_id, 'vms', 'applications:update'));

alter table participation enable row level security;

create policy participation_self_select on participation
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy participation_staff_select on participation
  for select using (staff_has_org_role(organization_id));

create policy participation_staff_insert on participation
  for insert with check (staff_has_permission(organization_id, 'vms', 'participation:write'));

create policy participation_staff_update on participation
  for update using (staff_has_permission(organization_id, 'vms', 'participation:update'));

alter table activity_hours enable row level security;

create policy activity_hours_self_select on activity_hours
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

-- Deliberately no self-insert policy: submit-hours() (service-role) is the
-- only write path — a direct insert here previously only checked that
-- volunteer_id matched the caller, never that the participation_id they
-- supplied actually belonged to them.

create policy activity_hours_staff_select on activity_hours
  for select using (staff_has_org_role(organization_id));

create policy activity_hours_staff_insert on activity_hours
  for insert with check (staff_has_permission(organization_id, 'vms', 'hours:write'));

create policy activity_hours_staff_update on activity_hours
  for update using (staff_has_permission(organization_id, 'vms', 'hours:update'));

alter table chapters enable row level security;

create policy chapters_public_select on chapters
  for select using (status = 'active');

create policy chapters_staff_select on chapters
  for select using (staff_has_org_role(organization_id));

create policy chapters_staff_insert on chapters
  for insert with check (staff_has_permission(organization_id, 'vms', 'chapters:write'));

create policy chapters_staff_update on chapters
  for update using (staff_has_permission(organization_id, 'vms', 'chapters:update'));

create policy chapters_staff_delete on chapters
  for delete using (staff_has_permission(organization_id, 'vms', 'chapters:delete'));

alter table volunteer_chapter_link enable row level security;

create policy volunteer_chapter_link_self_select on volunteer_chapter_link
  for select using (volunteer_id in (select id from volunteers where auth_user_id = auth.uid()));

create policy volunteer_chapter_link_staff_select on volunteer_chapter_link
  for select using (staff_has_org_role(organization_id));

create policy volunteer_chapter_link_staff_insert on volunteer_chapter_link
  for insert with check (staff_has_permission(organization_id, 'vms', 'chapters:write'));

create policy volunteer_chapter_link_staff_delete on volunteer_chapter_link
  for delete using (staff_has_permission(organization_id, 'vms', 'chapters:update'));

alter table admin_action_log enable row level security;

create policy admin_action_log_staff_select on admin_action_log
  for select using (organization_id is null or staff_has_org_role(organization_id));

alter table profile_field_changes enable row level security;

create policy profile_field_changes_staff_select on profile_field_changes
  for select using (
    is_platform_owner()
    or exists (
      select 1 from org_volunteer_index ovi
      where ovi.volunteer_id = profile_field_changes.volunteer_id
        and ovi.organization_id = any(staff_org_ids())
    )
  );

alter table org_volunteer_index enable row level security;

create policy org_volunteer_index_staff_select on org_volunteer_index
  for select using (staff_has_org_role(organization_id));
