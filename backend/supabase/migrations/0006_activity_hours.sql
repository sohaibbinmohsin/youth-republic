create table activity_hours (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references participation(id) on delete cascade,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  organization_id uuid not null,
  role text,
  activity_date date not null,
  location text,
  hours_submitted numeric(5,2) not null check (hours_submitted > 0),
  hours_verified numeric(5,2),
  verification_status text not null default 'recorded'
    check (verification_status in ('recorded', 'pending', 'verified', 'rejected')),
  rejection_reason text,
  admin_notes text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index activity_hours_org_idx on activity_hours (organization_id);
create index activity_hours_volunteer_idx on activity_hours (volunteer_id);
create index activity_hours_status_idx on activity_hours (verification_status);

create or replace function volunteer_total_verified_hours(p_volunteer_id uuid) returns numeric as $$
  select coalesce(sum(hours_verified), 0) from activity_hours
  where volunteer_id = p_volunteer_id and verification_status = 'verified';
$$ language sql stable;
