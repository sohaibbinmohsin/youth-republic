-- backend/supabase/migrations/0021_volunteer_id_doc.sql
alter table volunteers rename column cnic_number to id_doc_number;
alter table volunteers drop column cnic_document_url;
alter table volunteers add column id_doc_type text check (id_doc_type in ('cnic', 'b_form'));

alter table profile_field_changes drop constraint profile_field_changes_field_name_check;
alter table profile_field_changes add constraint profile_field_changes_field_name_check
  check (field_name in ('dob', 'id_doc_number', 'phone', 'emergency_contact', 'guardian_name', 'guardian_contact'));
