create sequence volunteer_code_seq;

create or replace function generate_volunteer_code() returns text as $$
  select 'VOL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('volunteer_code_seq')::text, 6, '0');
$$ language sql;

create or replace function volunteer_is_minor(v_dob date) returns boolean as $$
  select v_dob > (current_date - interval '18 years');
$$ language sql stable;

create table volunteers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade deferrable initially deferred,
  volunteer_code text not null unique default generate_volunteer_code(),
  full_name text not null,
  email text not null unique,
  phone text not null unique,
  dob date not null,
  gender text not null,
  city text not null,
  province text not null,
  country text not null,
  institution text not null,
  degree_program text not null,
  cnic_number text unique,
  cnic_document_url text,
  graduation_year int,
  skills text[],
  interests text[],
  availability text,
  emergency_contact jsonb,
  profile_picture_url text,
  guardian_name text,
  guardian_contact text,
  guardian_consent_at timestamptz,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'active', 'inactive')),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  constraint guardian_fields_together check (
    (guardian_name is null and guardian_contact is null) or
    (guardian_name is not null and guardian_contact is not null)
  )
);

create index volunteers_city_idx on volunteers (city);
create index volunteers_institution_idx on volunteers (institution);
create index volunteers_status_idx on volunteers (status);
