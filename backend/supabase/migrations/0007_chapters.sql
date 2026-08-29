create table chapters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  institution text,
  city text,
  province text,
  status text not null default 'active' check (status in ('active', 'inactive'))
);

create index chapters_org_idx on chapters (organization_id);

create table volunteer_chapter_link (
  volunteer_id uuid not null references volunteers(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  organization_id uuid not null,
  linked_at timestamptz not null default now(),
  primary key (volunteer_id, chapter_id)
);
