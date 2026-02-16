-- Allow regular users to create bases when permitted per project
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS can_create_suppliers BOOLEAN NOT NULL DEFAULT false;
