-- backend/supabase/migrations/0029_opportunities_draft_status_override.sql
--
-- Allow 'draft' as an opportunity status_override. The partner admin saves
-- unfinished opportunities as drafts; they must not appear on the volunteer
-- noticeboard (handled in list-opportunities' public path) and can't be
-- applied to (computeOpportunityStatus returns "draft", which
-- apply-to-opportunity already rejects).

alter table opportunities drop constraint if exists opportunities_status_override_check;

alter table opportunities add constraint opportunities_status_override_check
  check (status_override in ('draft', 'coming_soon', 'open', 'closed', 'in_progress', 'completed'));
