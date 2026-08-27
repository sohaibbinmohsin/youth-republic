create table applications (
  id uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  organization_id uuid not null,
  motivation_statement text,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'selected', 'waitlisted', 'rejected', 'withdrawn')),
  applied_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (volunteer_id, opportunity_id)
);

create index applications_org_idx on applications (organization_id);
create index applications_status_idx on applications (status);
create index applications_volunteer_idx on applications (volunteer_id);
