-- backend/supabase/tests/database/volunteer_id_doc_test.sql
begin;
select plan(5);

select hasnt_column('volunteers', 'cnic_number', 'cnic_number renamed away');
select hasnt_column('volunteers', 'cnic_document_url', 'cnic_document_url dropped');
select has_column('volunteers', 'id_doc_number', 'id_doc_number exists');
select has_column('volunteers', 'id_doc_type', 'id_doc_type exists');

select throws_ok(
  $$ update volunteers set id_doc_type = 'alien_id' $$,
  null, null, 'id_doc_type check rejects unknown type');

select * from finish();
rollback;
