-- backend/supabase/migrations/0018_applications_dynamic_form.sql
alter table applications drop column motivation_statement;

alter table applications
  add column answers jsonb not null default '{}'::jsonb,
  add column form_snapshot jsonb not null default '{"version": 1, "fields": []}'::jsonb,
  add column applicant_name text,
  add column applicant_email text,
  add column applicant_phone text,
  add column consent_accepted boolean not null default false;
