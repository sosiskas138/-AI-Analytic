-- Migration to fix CASCADE constraints and clean up orphaned records
-- Run this if your database was created before CASCADE constraints were added

-- 1. Fix calls.supplier_number_id to SET NULL on delete
DO $$
BEGIN
  -- Drop existing constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'calls_supplier_number_id_fkey'
  ) THEN
    ALTER TABLE calls DROP CONSTRAINT calls_supplier_number_id_fkey;
  END IF;
  
  -- Add constraint with ON DELETE SET NULL
  ALTER TABLE calls 
    ADD CONSTRAINT calls_supplier_number_id_fkey 
    FOREIGN KEY (supplier_number_id) 
    REFERENCES supplier_numbers(id) 
    ON DELETE SET NULL;
END $$;

-- 2. Fix import_jobs.uploaded_by to SET NULL on delete
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'import_jobs_uploaded_by_fkey'
  ) THEN
    ALTER TABLE import_jobs DROP CONSTRAINT import_jobs_uploaded_by_fkey;
  END IF;
  
  ALTER TABLE import_jobs 
    ADD CONSTRAINT import_jobs_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) 
    REFERENCES users(id) 
    ON DELETE SET NULL;
END $$;

-- 3. Fix reanimation_exports.exported_by to SET NULL on delete
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reanimation_exports_exported_by_fkey'
  ) THEN
    ALTER TABLE reanimation_exports DROP CONSTRAINT reanimation_exports_exported_by_fkey;
  END IF;
  
  ALTER TABLE reanimation_exports 
    ADD CONSTRAINT reanimation_exports_exported_by_fkey 
    FOREIGN KEY (exported_by) 
    REFERENCES users(id) 
    ON DELETE SET NULL;
END $$;

-- 4. Ensure supplier_numbers has CASCADE on supplier_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'supplier_numbers_supplier_id_fkey'
  ) THEN
    ALTER TABLE supplier_numbers DROP CONSTRAINT supplier_numbers_supplier_id_fkey;
  END IF;
  
  ALTER TABLE supplier_numbers 
    ADD CONSTRAINT supplier_numbers_supplier_id_fkey 
    FOREIGN KEY (supplier_id) 
    REFERENCES suppliers(id) 
    ON DELETE CASCADE;
END $$;

-- 5. Clean up orphaned records (calls with invalid supplier_number_id)
UPDATE calls 
SET supplier_number_id = NULL 
WHERE supplier_number_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM supplier_numbers WHERE id = calls.supplier_number_id
  );

-- 6. Clean up orphaned records (import_jobs with invalid uploaded_by)
UPDATE import_jobs 
SET uploaded_by = NULL 
WHERE uploaded_by IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = import_jobs.uploaded_by
  );

-- 7. Clean up orphaned records (reanimation_exports with invalid exported_by)
UPDATE reanimation_exports 
SET exported_by = NULL 
WHERE exported_by IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = reanimation_exports.exported_by
  );

-- 8. Clean up orphaned supplier_numbers (should not exist if CASCADE works, but just in case)
DELETE FROM supplier_numbers 
WHERE supplier_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM suppliers WHERE id = supplier_numbers.supplier_id
  );
