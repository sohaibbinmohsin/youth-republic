-- backend/supabase/tests/database/attachments_test.sql
begin;
select plan(5);

select has_table('attachments', 'attachments table exists');

select throws_ok(
  $$ insert into attachments (domain, owner_type, owner_id, bucket, storage_path, mime_type, size_bytes, uploaded_by)
     values ('bad', 'volunteer', gen_random_uuid(), 'b', 'p', 'image/png', 1, gen_random_uuid()) $$,
  null, null, 'domain check rejects unknown domain');

select throws_ok(
  $$ insert into attachments (domain, owner_type, owner_id, bucket, storage_path, mime_type, size_bytes, uploaded_by)
     values ('session_photo', 'nope', gen_random_uuid(), 'b', 'p', 'image/png', 1, gen_random_uuid()) $$,
  null, null, 'owner_type check rejects unknown type');

with ins as (
  insert into attachments (domain, owner_type, owner_id, bucket, storage_path, mime_type, size_bytes, uploaded_by)
  values ('session_photo', 'activity_hours', gen_random_uuid(), 'session-photos', 'p', 'image/png', 1, gen_random_uuid())
  returning status
)
select is(
  (select status from ins),
  'pending', 'status defaults to pending');

select bag_eq(
  $$ select id from storage.buckets where id in ('identity-docs','application-files','session-photos') $$,
  $$ values ('identity-docs'), ('application-files'), ('session-photos') $$,
  'three private buckets created');

select * from finish();
rollback;
