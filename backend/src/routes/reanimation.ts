import express from 'express';
import { query } from '../config/database.js';
import { authenticate, requireAdmin, requireProjectAccess, AuthRequest } from '../middleware/auth.js';

const MAX_PHONE_NUMBERS_PER_EXPORT = 100_000;

const router = express.Router();

// Get reanimation exports for a project
router.get('/project/:projectId/exports', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM reanimation_exports WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.projectId]
    );
    res.json({ exports: result.rows });
  } catch (error: any) {
    console.error('Get reanimation exports error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create reanimation export
router.post('/exports', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { project_id, phone_count, duration_filter, filename, date_from, date_to, phone_numbers } = req.body;

    if (!project_id || !phone_numbers || !Array.isArray(phone_numbers)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    if (phone_numbers.length > MAX_PHONE_NUMBERS_PER_EXPORT) {
      return res.status(400).json({ error: `Too many phone numbers. Maximum ${MAX_PHONE_NUMBERS_PER_EXPORT} per export.` });
    }

    // Check project access
    const projectCheck = await query('SELECT 1 FROM projects WHERE id = $1', [project_id]);
    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Create export record
    const exportResult = await query(
      `INSERT INTO reanimation_exports (project_id, phone_count, duration_filter, filename, date_from, date_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [project_id, phone_count || 0, duration_filter || '', filename || '', date_from || null, date_to || null]
    );

    const exportId = exportResult.rows[0].id;

    // Insert phone numbers in batches
    const BATCH = 500;
    for (let i = 0; i < phone_numbers.length; i += BATCH) {
      const batch = phone_numbers.slice(i, i + BATCH);
      const values = batch.map((phone: string, idx: number) => 
        `($${idx * 2 + 1}, $${idx * 2 + 2})`
      ).join(', ');
      const params: any[] = [];
      batch.forEach((phone: string) => {
        params.push(exportId, phone);
      });
      
      await query(
        `INSERT INTO reanimation_export_numbers (export_id, phone_normalized) VALUES ${values}`,
        params
      );
    }

    res.json({ id: exportId });
  } catch (error: any) {
    console.error('Create reanimation export error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get all exports (admin only)
router.get('/exports', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM reanimation_exports ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ exports: result.rows });
  } catch (error: any) {
    console.error('Get all exports error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get export numbers (user must have access to the export's project)
router.get('/exports/:exportId/numbers', authenticate, async (req: AuthRequest, res) => {
  try {
    const { exportId } = req.params;
    const { page = 1, pageSize = 1000 } = req.query;

    const exportRow = await query(
      'SELECT project_id FROM reanimation_exports WHERE id = $1',
      [exportId]
    );
    if (exportRow.rows.length === 0) {
      return res.status(404).json({ error: 'Export not found' });
    }
    const projectId = exportRow.rows[0].project_id;
    if (!req.user!.isAdmin) {
      const member = await query(
        'SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = $2',
        [req.user!.userId, projectId]
      );
      if (member.rows.length === 0) {
        return res.status(403).json({ error: 'No access to this export' });
      }
    }

    const offset = (Number(page) - 1) * Number(pageSize);
    const result = await query(
      `SELECT phone_normalized FROM reanimation_export_numbers
       WHERE export_id = $1
       ORDER BY phone_normalized
       LIMIT $2 OFFSET $3`,
      [exportId, Number(pageSize), offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM reanimation_export_numbers WHERE export_id = $1',
      [exportId]
    );

    res.json({
      numbers: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (error: any) {
    console.error('Get export numbers error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete export (admin only)
router.delete('/exports/:exportId', authenticate, requireAdmin, async (req, res) => {
  try {
    // Delete cascade will handle reanimation_export_numbers
    await query('DELETE FROM reanimation_exports WHERE id = $1', [req.params.exportId]);
    res.json({ message: 'Export deleted successfully' });
  } catch (error: any) {
    console.error('Delete export error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
