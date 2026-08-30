-- backend/supabase/tests/database/applications_dynamic_form_test.sql
begin;
select plan(6);

select hasnt_column('applications', 'motivation_statement', 'motivation_statement dropped');
select has_column('applications', 'answers', 'answers exists');
select has_column('applications', 'form_snapshot', 'form_snapshot exists');
select has_column('applications', 'applicant_name', 'applicant_name exists');
select has_column('applications', 'applicant_email', 'applicant_email exists');
select col_not_null('applications', 'consent_accepted', 'consent_accepted is NOT NULL');

select * from finish();
rollback;
