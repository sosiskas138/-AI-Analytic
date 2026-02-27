-- Add 'bases' role for permission "Базы": access to bases of own projects, set prices, enable/disable ГЦК.
-- Run once: psql -U postgres -d telemarketing_analytics -f migration_bases_role.sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_role' AND e.enumlabel = 'bases') THEN
    ALTER TYPE app_role ADD VALUE 'bases';
  END IF;
END$$;
