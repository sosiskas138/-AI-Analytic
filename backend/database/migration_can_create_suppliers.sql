-- Allow regular users to create bases (suppliers) when permitted per project
-- For existing DB run manually: psql -U postgres -d telemarketing_analytics -f migration_can_create_suppliers.sql
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS can_create_suppliers BOOLEAN NOT NULL DEFAULT false;
