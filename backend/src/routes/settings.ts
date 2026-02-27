import express from 'express';
import { query } from '../config/database.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const CPL_KEYS = ['cpl_target_a', 'cpl_target_b', 'cpl_target_c'] as const;

/** GET /api/settings — получить настройки (денежные показатели CPL для A/B/C) */
router.get('/', authenticate, async (_req, res) => {
  try {
    const result = await query(
      "SELECT key, value FROM app_settings WHERE key = ANY($1)",
      [CPL_KEYS]
    );
    const map: Record<string, string> = {};
    for (const row of result.rows) {
      map[row.key] = row.value ?? '';
    }
    res.json({
      cpl_target_a: map.cpl_target_a ?? '500',
      cpl_target_b: map.cpl_target_b ?? '1000',
      cpl_target_c: map.cpl_target_c ?? '2000',
    });
  } catch (error: any) {
    // Таблица app_settings может отсутствовать до миграции
    res.json({ cpl_target_a: '500', cpl_target_b: '1000', cpl_target_c: '2000' });
  }
});

/** PUT /api/settings — обновить настройки (только админ). Требует миграцию migration_app_settings.sql */
router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { cpl_target_a, cpl_target_b, cpl_target_c } = req.body;
    const updates = [
      cpl_target_a != null && { key: 'cpl_target_a', value: String(cpl_target_a) },
      cpl_target_b != null && { key: 'cpl_target_b', value: String(cpl_target_b) },
      cpl_target_c != null && { key: 'cpl_target_c', value: String(cpl_target_c) },
    ].filter(Boolean) as { key: string; value: string }[];
    for (const { key, value } of updates) {
      await query(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    const result = await query(
      "SELECT key, value FROM app_settings WHERE key = ANY($1)",
      [CPL_KEYS]
    ).catch(() => ({ rows: [] }));
    const map: Record<string, string> = {};
    for (const row of result.rows) {
      map[row.key] = row.value ?? '';
    }
    res.json({
      cpl_target_a: map.cpl_target_a ?? '500',
      cpl_target_b: map.cpl_target_b ?? '1000',
      cpl_target_c: map.cpl_target_c ?? '2000',
    });
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
