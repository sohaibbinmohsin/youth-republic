alter table opportunities
  add column if not exists city text,
  add column if not exists venue text,
  add column if not exists impact_stats jsonb default '{}'::jsonb;

-- Backfill city from existing location where city is null
update opportunities
set city = location
where city is null and location is not null;
