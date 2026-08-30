-- backend/supabase/migrations/0022_organizations_foreign_keys.sql
-- Add foreign key relationships from core tenant tables to organizations so PostgREST can embed organizations(...)

ALTER TABLE opportunities
  DROP CONSTRAINT IF EXISTS opportunities_organization_id_fkey,
  ADD CONSTRAINT opportunities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_organization_id_fkey,
  ADD CONSTRAINT applications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE participation
  DROP CONSTRAINT IF EXISTS participation_organization_id_fkey,
  ADD CONSTRAINT participation_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE activity_hours
  DROP CONSTRAINT IF EXISTS activity_hours_organization_id_fkey,
  ADD CONSTRAINT activity_hours_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE attachments
  DROP CONSTRAINT IF EXISTS attachments_organization_id_fkey,
  ADD CONSTRAINT attachments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
