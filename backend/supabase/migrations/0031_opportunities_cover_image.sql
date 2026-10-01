-- backend/supabase/migrations/0031_opportunities_cover_image.sql
alter table opportunities
  add column if not exists cover_image_url text;
