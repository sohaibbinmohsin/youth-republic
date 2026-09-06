-- backend/supabase/migrations/0024_application_drafts_and_partner_visibility.sql

-- 1. Allow 'draft' status on applications
alter table applications drop constraint if exists applications_status_check;
alter table applications add constraint applications_status_check
  check (status in ('draft', 'submitted', 'under_review', 'selected', 'waitlisted', 'rejected', 'withdrawn'));

-- 2. Add auth_user_id and draft_profile columns
alter table applications add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;
alter table applications add column if not exists draft_profile jsonb not null default '{}'::jsonb;

-- 3. Make volunteer_id nullable for drafts
alter table applications alter column volunteer_id drop not null;
alter table applications drop constraint if exists applications_volunteer_required_when_not_draft;
alter table applications add constraint applications_volunteer_required_when_not_draft
  check (status = 'draft' or volunteer_id is not null);

-- 4. Backfill existing applications with auth_user_id from volunteers
update applications a
set auth_user_id = v.auth_user_id
from volunteers v
where a.volunteer_id = v.id and a.auth_user_id is null;

-- 5. Create index for fast draft/user lookups
create unique index if not exists applications_auth_user_opportunity_idx
  on applications (auth_user_id, opportunity_id);

-- 6. RLS Policies
drop policy if exists applications_self_select on applications;
create policy applications_self_select on applications
  for select using (
    auth_user_id = auth.uid()
    or volunteer_id in (select id from volunteers where auth_user_id = auth.uid())
  );

drop policy if exists applications_self_insert_draft on applications;
create policy applications_self_insert_draft on applications
  for insert with check (
    auth.uid() is not null
    and auth_user_id = auth.uid()
    and status = 'draft'
  );

drop policy if exists applications_self_update_draft on applications;
create policy applications_self_update_draft on applications
  for update using (
    auth.uid() is not null
    and (
      auth_user_id = auth.uid()
      or volunteer_id in (select id from volunteers where auth_user_id = auth.uid())
    )
    and status = 'draft'
  ) with check (
    status = 'draft'
  );

drop policy if exists applications_self_delete_draft on applications;
create policy applications_self_delete_draft on applications
  for delete using (
    auth.uid() is not null
    and (
      auth_user_id = auth.uid()
      or volunteer_id in (select id from volunteers where auth_user_id = auth.uid())
    )
    and status = 'draft'
  );

drop policy if exists applications_staff_select on applications;
create policy applications_staff_select on applications
  for select using (
    (
      is_platform_owner()
      and status != 'draft'
    )
    or (
      staff_has_org_role(organization_id)
      and status != 'draft'
      and volunteer_id in (select id from volunteers where status = 'active')
    )
  );

drop policy if exists applications_staff_update on applications;
create policy applications_staff_update on applications
  for update using (
    staff_has_permission(organization_id, 'vms', 'applications:update')
    and (
      is_platform_owner()
      or (
        status != 'draft'
        and volunteer_id in (select id from volunteers where status = 'active')
      )
    )
  );
