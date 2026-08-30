-- backend/supabase/migrations/0017_opportunities_content.sql
alter table opportunities
  add column about text,
  add column duties text[] not null default '{}',
  add column eligibility text[] not null default '{}',
  add column what_to_bring text[] not null default '{}',
  add column application_form jsonb not null default '{"version": 1, "fields": []}'::jsonb;

alter table opportunities drop column eligibility_criteria;
