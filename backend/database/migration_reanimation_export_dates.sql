-- Add date_from and date_to to reanimation_exports for filtering info
-- For existing DB run manually: psql -U postgres -d telemarketing_analytics -f migration_reanimation_export_dates.sql
ALTER TABLE reanimation_exports
  ADD COLUMN IF NOT EXISTS date_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_to TIMESTAMPTZ;
