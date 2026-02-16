-- Add missing columns to project_status (used by ProjectStatus page)
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS analysis_link TEXT DEFAULT '';
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT '';
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS company_activity TEXT DEFAULT '';
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS materials_requested BOOLEAN DEFAULT false;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS materials_sent BOOLEAN DEFAULT false;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS skillbase_ready BOOLEAN DEFAULT false;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS test_launched BOOLEAN DEFAULT false;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS launched_to_production BOOLEAN DEFAULT false;
ALTER TABLE project_status ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT '';
