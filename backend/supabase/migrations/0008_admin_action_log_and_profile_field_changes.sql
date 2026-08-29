create table admin_action_log (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid,
  actor_type text not null default 'staff',
  action text not null,
  target_type text not null,
  target_id uuid not null,
  organization_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index admin_action_log_org_idx on admin_action_log (organization_id);
create index admin_action_log_target_idx on admin_action_log (target_type, target_id);

create table profile_field_changes (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  field_name text not null
    check (field_name in ('dob', 'cnic_number', 'phone', 'emergency_contact', 'guardian_name', 'guardian_contact')),
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);

create index profile_field_changes_volunteer_idx on profile_field_changes (volunteer_id);
