create table organizations (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  deactivated_at timestamptz,
  synced_at timestamptz not null default now()
);

create index organizations_slug_idx on organizations (slug);

alter table organizations enable row level security;

create policy organizations_public_select on organizations
  for select using (deactivated_at is null);
