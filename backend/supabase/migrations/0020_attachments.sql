-- backend/supabase/migrations/0020_attachments.sql
create table attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  domain text not null check (domain in ('identity_doc', 'application_file', 'session_photo')),
  owner_type text not null check (owner_type in ('volunteer', 'application', 'activity_hours')),
  owner_id uuid not null,
  bucket text not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes int not null,
  original_filename text,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);
create index attachments_owner_idx on attachments (owner_type, owner_id);
create index attachments_org_idx on attachments (organization_id);

alter table attachments enable row level security;
-- All access is via the get-attachment / *-attachment edge functions (service role). No direct policies.

insert into storage.buckets (id, name, public)
values ('identity-docs', 'identity-docs', false),
       ('application-files', 'application-files', false),
       ('session-photos', 'session-photos', false)
on conflict (id) do nothing;
