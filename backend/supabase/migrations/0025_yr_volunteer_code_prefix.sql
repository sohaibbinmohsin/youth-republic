-- Migration 0025: Update volunteer_code prefix to YR- and migrate existing VOL- codes
create or replace function generate_volunteer_code() returns text as $$
  select 'YR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('volunteer_code_seq')::text, 6, '0');
$$ language sql;

-- Update existing records in volunteers from VOL- to YR-
update volunteers
set volunteer_code = regexp_replace(volunteer_code, '^VOL-', 'YR-')
where volunteer_code like 'VOL-%';
