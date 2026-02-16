-- Add import_job_id to link calls and supplier_numbers with import jobs
-- When an import is deleted, its data will be removed

ALTER TABLE calls ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE;
ALTER TABLE supplier_numbers ADD COLUMN IF NOT EXISTS import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_calls_import_job_id ON calls(import_job_id) WHERE import_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_numbers_import_job_id ON supplier_numbers(import_job_id) WHERE import_job_id IS NOT NULL;
