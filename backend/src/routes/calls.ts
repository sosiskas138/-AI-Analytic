import express from 'express';
import { query } from '../config/database.js';
import { authenticate, requireProjectAccess, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get calls for a project
router.get('/project/:projectId', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, pageSize = 50, status, phone, startDate, endDate, isGck } = req.query;

    let whereConditions = ['c.project_id = $1'];
    const values: any[] = [projectId];
    let paramCount = 2;

    if (status) {
      whereConditions.push(`c.status = $${paramCount++}`);
      values.push(status);
    }

    if (phone) {
      whereConditions.push(`(c.phone_raw ILIKE $${paramCount} OR c.phone_normalized ILIKE $${paramCount})`);
      values.push(`%${phone}%`);
      paramCount++;
    }

    if (startDate) {
      whereConditions.push(`c.call_at >= $${paramCount++}`);
      values.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`c.call_at <= $${paramCount++}`);
      values.push(endDate);
    }

    // Filter by GCK: isGck=true -> only GCK calls, isGck=false -> only non-GCK calls
    if (isGck === 'true') {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM supplier_numbers sn
        INNER JOIN suppliers s ON s.id = sn.supplier_id
        WHERE sn.phone_normalized = c.phone_normalized
        AND sn.project_id = c.project_id
        AND s.is_gck = true
      )`);
    } else if (isGck === 'false') {
      whereConditions.push(`(
        NOT EXISTS (
          SELECT 1 FROM supplier_numbers sn
          INNER JOIN suppliers s ON s.id = sn.supplier_id
          WHERE sn.phone_normalized = c.phone_normalized
          AND sn.project_id = c.project_id
          AND s.is_gck = true
        )
      )`);
    }

    const offset = (Number(page) - 1) * Number(pageSize);
    const result = await query(
      `SELECT c.* FROM calls c
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY c.call_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...values, Number(pageSize), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM calls c WHERE ${whereConditions.join(' AND ')}`,
      values
    );

    res.json({
      calls: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (error: any) {
    console.error('Get calls error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete calls
router.delete('/batch', authenticate, async (req: AuthRequest, res) => {
  try {
    const { callIds } = req.body;
    if (!Array.isArray(callIds) || callIds.length === 0) {
      return res.status(400).json({ error: 'Call IDs array is required' });
    }

    // Verify user has access to all calls' projects
    const callsResult = await query(
      `SELECT DISTINCT project_id FROM calls WHERE id = ANY($1)`,
      [callIds]
    );

    for (const row of callsResult.rows) {
      // Check access (this will throw if no access)
      const accessResult = await query(
        `SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = $2`,
        [req.user!.userId, row.project_id]
      );
      if (accessResult.rows.length === 0 && !req.user!.isAdmin) {
        return res.status(403).json({ error: 'No access to one or more projects' });
      }
    }

    await query('DELETE FROM calls WHERE id = ANY($1)', [callIds]);
    res.json({ message: 'Calls deleted successfully' });
  } catch (error: any) {
    console.error('Delete calls error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
