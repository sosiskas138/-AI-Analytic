-- Function to clean up orphaned records in the database
-- This can be run periodically to maintain data integrity

-- Clean up calls with invalid supplier_number_id
UPDATE calls 
SET supplier_number_id = NULL 
WHERE supplier_number_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM supplier_numbers WHERE id = calls.supplier_number_id
  );

-- Clean up import_jobs with invalid uploaded_by
UPDATE import_jobs 
SET uploaded_by = NULL 
WHERE uploaded_by IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = import_jobs.uploaded_by
  );

-- Clean up reanimation_exports with invalid exported_by
UPDATE reanimation_exports 
SET exported_by = NULL 
WHERE exported_by IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = reanimation_exports.exported_by
  );

-- Clean up orphaned supplier_numbers (should not exist if CASCADE works)
DELETE FROM supplier_numbers 
WHERE supplier_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM suppliers WHERE id = supplier_numbers.supplier_id
  );

-- Clean up orphaned project_members (should not exist if CASCADE works)
DELETE FROM project_members 
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM projects WHERE id = project_members.project_id
  )
  OR user_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = project_members.user_id
  );

-- Clean up orphaned user_roles (should not exist if CASCADE works)
DELETE FROM user_roles 
WHERE user_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = user_roles.user_id
  );

-- Clean up orphaned profiles (should not exist if CASCADE works)
DELETE FROM profiles 
WHERE user_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = profiles.user_id
  );

-- Clean up orphaned calls (should not exist if CASCADE works)
DELETE FROM calls 
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM projects WHERE id = calls.project_id
  );

-- Clean up orphaned suppliers (should not exist if CASCADE works)
DELETE FROM suppliers 
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM projects WHERE id = suppliers.project_id
  );

-- Clean up orphaned project_pricing (should not exist if CASCADE works)
DELETE FROM project_pricing 
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM projects WHERE id = project_pricing.project_id
  );

-- Clean up orphaned project_status (should not exist if CASCADE works)
DELETE FROM project_status 
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM projects WHERE id = project_status.project_id
  );

-- Clean up orphaned import_jobs (should not exist if CASCADE works)
DELETE FROM import_jobs 
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM projects WHERE id = import_jobs.project_id
  );

-- Clean up orphaned reanimation_exports (should not exist if CASCADE works)
DELETE FROM reanimation_exports 
WHERE project_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM projects WHERE id = reanimation_exports.project_id
  );

-- Clean up orphaned reanimation_export_numbers (should not exist if CASCADE works)
DELETE FROM reanimation_export_numbers 
WHERE export_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM reanimation_exports WHERE id = reanimation_export_numbers.export_id
  );
