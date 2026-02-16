import express from 'express';
import { query } from '../config/database.js';
import { authenticate, requireProjectAccess, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get import jobs for a project
router.get('/project/:projectId', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const result = await query(
      `SELECT ij.*, u.email as uploaded_by_email
       FROM import_jobs ij
       LEFT JOIN users u ON u.id = ij.uploaded_by
       WHERE ij.project_id = $1
       ORDER BY ij.created_at DESC`,
      [req.params.projectId]
    );
    res.json({ imports: result.rows });
  } catch (error: any) {
    console.error('Get imports error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete import job
router.delete('/:importId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { importId } = req.params;
    const check = await query(
      'SELECT project_id FROM import_jobs WHERE id = $1',
      [importId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Import not found' });
    }
    const projectId = check.rows[0].project_id;

    // Check access
    if (!req.user!.isAdmin) {
      const access = await query(
        'SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = $2',
        [req.user!.userId, projectId]
      );
      if (access.rows.length === 0) {
        return res.status(403).json({ error: 'Forbidden: No access to this project' });
      }
    }

    await query('DELETE FROM import_jobs WHERE id = $1', [importId]);
    res.json({ message: 'Import deleted' });
  } catch (error: any) {
    console.error('Delete import error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
