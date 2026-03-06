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

    const result = await query(
      `SELECT
        p.id,
        p.name,
        MAX(c.call_at) as last_call_at,
        COUNT(*) FILTER (WHERE c.call_at::date = CURRENT_DATE - 1) as yesterday_calls,
        COUNT(*) FILTER (WHERE ${SUCCESSFUL_STATUS} AND c.call_at::date = CURRENT_DATE - 1) as yesterday_answered,
        COUNT(DISTINCT c.phone_normalized) FILTER (WHERE c.is_lead AND c.call_at::date = CURRENT_DATE - 1) as yesterday_leads,
        (SELECT MAX(ij.created_at) FROM import_jobs ij WHERE ij.project_id = p.id) as last_import_at
      FROM projects p
      LEFT JOIN calls c ON c.project_id = p.id
      WHERE p.id = ANY($1)
      GROUP BY p.id, p.name
      ORDER BY p.name`,
      [projectIds]
    );

    const projects = result.rows.map((row: any) => ({
      projectId: row.id,
      projectName: row.name,
      lastCallAt: row.last_call_at,
      lastImportAt: row.last_import_at,
      yesterdayCalls: parseInt(row.yesterday_calls) || 0,
      yesterdayAnswered: parseInt(row.yesterday_answered) || 0,
      yesterdayLeads: parseInt(row.yesterday_leads) || 0,
    }));

    res.json({ projects });
  } catch (error: any) {
    console.error('Monitoring error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
