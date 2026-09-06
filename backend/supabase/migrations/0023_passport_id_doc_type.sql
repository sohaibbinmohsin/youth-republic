-- Migration 0023: Allow 'passport' in volunteers.id_doc_type
alter table volunteers drop constraint if exists volunteers_id_doc_type_check;
alter table volunteers add constraint volunteers_id_doc_type_check check (id_doc_type in ('cnic', 'b_form', 'passport'));
