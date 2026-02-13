
-- Add allowed_tabs to project_members for tab-level access control
ALTER TABLE public.project_members
ADD COLUMN allowed_tabs text[] NOT NULL DEFAULT ARRAY['dashboard', 'calls', 'imports', 'call-lists', 'suppliers', 'export', 'status'];

-- Update delete_project function to handle the new column (no change needed, it already deletes project_members)
