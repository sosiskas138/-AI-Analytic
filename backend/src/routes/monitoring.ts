import express from 'express';
import { query } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const SUCCESSFUL_STATUS = "LOWER(TRIM(c.status)) IN ('успешный','ответ','answered','success')";

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const isAdmin = req.user!.isAdmin;

    let projectIds: string[];
    if (isAdmin) {
      const r = await query('SELECT id FROM projects ORDER BY name');
      projectIds = r.rows.map((row: any) => row.id);
    } else {
      const r = await query('SELECT project_id FROM project_members WHERE user_id = $1', [userId]);
      projectIds = r.rows.map((row: any) => row.project_id);
    }

    if (projectIds.length === 0) {
      return res.json({ projects: [] });
    }

    // Last business day: Mon→Fri(-3), Sun→Fri(-2), Sat→Fri(-1), otherwise yesterday
    const LAST_WORKDAY = `CASE EXTRACT(dow FROM CURRENT_DATE)
      WHEN 1 THEN CURRENT_DATE - 3
      WHEN 0 THEN CURRENT_DATE - 2
      WHEN 6 THEN CURRENT_DATE - 1
      ELSE CURRENT_DATE - 1
    END`;

    const result = await query(
      `SELECT
        p.id,
        p.name,
        COALESCE(ps.is_active, true) as is_active,
        MAX(c.call_at) as last_call_at,
        COUNT(*) FILTER (WHERE c.call_at::date = (${LAST_WORKDAY})) as yesterday_calls,
        COUNT(*) FILTER (WHERE ${SUCCESSFUL_STATUS} AND c.call_at::date = (${LAST_WORKDAY})) as yesterday_answered,
        COUNT(DISTINCT c.phone_normalized) FILTER (WHERE c.is_lead AND c.call_at::date = (${LAST_WORKDAY})) as yesterday_leads,
        (SELECT MAX(ij.created_at) FROM import_jobs ij WHERE ij.project_id = p.id) as last_import_at,
        (${LAST_WORKDAY})::text as check_date
      FROM projects p
      LEFT JOIN project_status ps ON ps.project_id = p.id
      LEFT JOIN calls c ON c.project_id = p.id
      WHERE p.id = ANY($1)
      GROUP BY p.id, p.name, ps.is_active
      ORDER BY p.name`,
      [projectIds]
    );

    const checkDate = result.rows[0]?.check_date ?? null;

    const projects = result.rows.map((row: any) => ({
      projectId: row.id,
      projectName: row.name,
      isActive: row.is_active,
      lastCallAt: row.last_call_at,
      lastImportAt: row.last_import_at,
      yesterdayCalls: parseInt(row.yesterday_calls) || 0,
      yesterdayAnswered: parseInt(row.yesterday_answered) || 0,
      yesterdayLeads: parseInt(row.yesterday_leads) || 0,
    }));

    res.json({ projects, checkDate });
  } catch (error: any) {
    console.error('Monitoring error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.patch('/:projectId/active', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user!.isAdmin) return res.status(403).json({ error: 'Admin only' });

    const { projectId } = req.params;
    const { isActive } = req.body;

    const existing = await query('SELECT id FROM project_status WHERE project_id = $1', [projectId]);
    if (existing.rows.length > 0) {
      await query('UPDATE project_status SET is_active = $1 WHERE project_id = $2', [isActive, projectId]);
    } else {
      await query('INSERT INTO project_status (project_id, is_active) VALUES ($1, $2)', [projectId, isActive]);
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Monitoring toggle active error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
