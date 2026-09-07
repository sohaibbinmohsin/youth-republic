-- backend/supabase/migrations/0028_applications_pending_review_status.sql
--
-- Collapse the two "awaiting a decision" statuses ('submitted' and
-- 'under_review') into a single canonical 'pending_review'. The partner admin
-- surfaced both as identical "pending" badges/filters, so there was never a
-- behavioural difference between them — only visual noise.

alter table applications drop constraint if exists applications_status_check;

update applications
set status = 'pending_review'
where status in ('submitted', 'under_review');

alter table applications add constraint applications_status_check
  check (status in ('draft', 'pending_review', 'selected', 'waitlisted', 'rejected', 'withdrawn'));

alter table applications alter column status set default 'pending_review';
