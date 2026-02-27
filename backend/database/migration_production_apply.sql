-- =============================================================================
-- Миграция для ПРОДАКШЕНА: только добавления, данные не трогаем.
-- Запуск: psql -U <user> -d telemarketing_analytics -f migration_production_apply.sql
-- Можно запускать повторно (идемпотентно).
-- =============================================================================

-- 1) Статистика: таблица настроек (пороги CPL для статусов A/B/C на странице «Статистика»)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT INTO app_settings (key, value) VALUES
  ('cpl_target_a', '500'),
  ('cpl_target_b', '1000'),
  ('cpl_target_c', '2000')
ON CONFLICT (key) DO NOTHING;

-- 2) Право "Базы": новое значение в enum app_role
--    (доступ к базам своих проектов, цены, вкл/выкл ГЦК)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'bases'
  ) THEN
    ALTER TYPE app_role ADD VALUE 'bases';
  END IF;
END$$;
