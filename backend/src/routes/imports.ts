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

export default router;
