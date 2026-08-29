create table org_volunteer_index (
  organization_id uuid not null,
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  first_activity_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  primary key (organization_id, volunteer_id)
);

create index org_volunteer_index_volunteer_idx on org_volunteer_index (volunteer_id);

create or replace function touch_org_volunteer_index(p_org_id uuid, p_volunteer_id uuid) returns void as $$
  insert into org_volunteer_index (organization_id, volunteer_id)
  values (p_org_id, p_volunteer_id)
  on conflict (organization_id, volunteer_id)
  do update set last_activity_at = now();
$$ language sql;
