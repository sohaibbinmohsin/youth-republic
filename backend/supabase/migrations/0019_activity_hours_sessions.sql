-- backend/supabase/migrations/0019_activity_hours_sessions.sql
alter table activity_hours add column note text;

alter table activity_hours alter column verification_status set default 'pending';

-- The 'recorded' status is being removed; it was the old initial state and is
-- replaced by 'pending' as the new default initial state. Remap any existing rows.
update activity_hours set verification_status = 'pending' where verification_status = 'recorded';

alter table activity_hours drop constraint activity_hours_verification_status_check;
alter table activity_hours add constraint activity_hours_verification_status_check
  check (verification_status in ('pending', 'verified', 'rejected'));
