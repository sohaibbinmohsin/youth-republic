-- backend/supabase/migrations/0016_organizations_branding.sql
alter table organizations
  add column brand_color text check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column logo_url text,
  add column favicon_url text,
  add column about text;

create view org_branding as
  select id, name, slug, brand_color, logo_url, favicon_url, about
  from organizations
  where deactivated_at is null;

grant select on org_branding to anon, authenticated;
