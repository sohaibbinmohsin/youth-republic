create table opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  type text not null,
  description text,
  location text,
  is_online boolean not null default false,
  application_open_at timestamptz,
  application_deadline timestamptz,
  activity_start_at timestamptz,
  activity_end_at timestamptz,
  eligibility_criteria text,
  capacity int,
  status_override text check (status_override in ('coming_soon', 'open', 'closed', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create index opportunities_org_idx on opportunities (organization_id);
create index opportunities_status_override_idx on opportunities (status_override);

create or replace function opportunity_status(o opportunities) returns text as $$
  select coalesce(
    o.status_override,
    case
      when o.deactivated_at is not null then 'closed'
      when o.application_open_at is not null and now() < o.application_open_at then 'coming_soon'
      when o.activity_start_at is not null and now() >= o.activity_start_at
           and (o.activity_end_at is null or now() <= o.activity_end_at) then 'in_progress'
      when o.activity_end_at is not null and now() > o.activity_end_at then 'completed'
      when o.application_deadline is not null and now() > o.application_deadline then 'closed'
      else 'open'
    end
  );
$$ language sql stable;
