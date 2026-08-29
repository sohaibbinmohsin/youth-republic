create table participation (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete set null,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  organization_id uuid not null,
  status text not null default 'selected'
    check (status in ('selected', 'participating', 'completed', 'no_show', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index participation_org_idx on participation (organization_id);
create index participation_volunteer_idx on participation (volunteer_id);

-- An application can auto-create at most one participation row (decide-application,
-- Task 16). admin-direct enrollment (Task 28) always has a null application_id, so
-- this is a partial index — it must not constrain that path.
create unique index participation_application_id_key on participation (application_id)
  where application_id is not null;
