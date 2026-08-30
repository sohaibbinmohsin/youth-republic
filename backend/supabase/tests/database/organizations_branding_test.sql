-- backend/supabase/tests/database/organizations_branding_test.sql
begin;
select plan(6);

select has_column('organizations', 'brand_color', 'organizations.brand_color exists');
select has_column('organizations', 'logo_url', 'organizations.logo_url exists');
select has_column('organizations', 'favicon_url', 'organizations.favicon_url exists');
select has_column('organizations', 'about', 'organizations.about exists');

select lives_ok(
  $$ insert into organizations (id, name, slug, brand_color)
     values ('00000000-0000-0000-0000-0000000000aa', 'T', 't-slug', '#D3BD2A') $$,
  'valid hex brand_color accepted');

select throws_ok(
  $$ insert into organizations (id, name, slug, brand_color)
     values ('00000000-0000-0000-0000-0000000000ab', 'T2', 't-slug-2', 'gold') $$,
  null, null, 'non-hex brand_color rejected');

select * from finish();
rollback;
