-- CPL targets for statistics status (A = successful, B = average, C = problem)
-- For existing DB run manually: psql -U postgres -d telemarketing_analytics -f migration_app_settings.sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT INTO app_settings (key, value) VALUES
  ('cpl_target_a', '500'),
  ('cpl_target_b', '1000'),
  ('cpl_target_c', '2000')
ON CONFLICT (key) DO NOTHING;
