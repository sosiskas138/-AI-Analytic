import express from 'express';
import { query } from '../config/database.js';
import { authenticate, requireAdmin, requireProjectAccess, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get suppliers for a project
router.get('/project/:projectId', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const { isGck } = req.query;
    let queryText = 'SELECT * FROM suppliers WHERE project_id = $1';
    const values: any[] = [req.params.projectId];
    
    if (isGck === 'true') {
      queryText += ' AND is_gck = true';
    } else if (isGck === 'false') {
      queryText += ' AND (is_gck = false OR is_gck IS NULL)';
    }
    
    queryText += ' ORDER BY created_at DESC';
    
    const result = await query(queryText, values);
    res.json({ suppliers: result.rows });
  } catch (error: any) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create supplier (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { project_id, name, tag, price_per_contact, is_gck } = req.body;
    if (!project_id || !name) {
      return res.status(400).json({ error: 'Project ID and name are required' });
    }

    const result = await query(
      `INSERT INTO suppliers (project_id, name, tag, price_per_contact, is_gck)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id, name, tag) DO UPDATE SET
         price_per_contact = EXCLUDED.price_per_contact,
         is_gck = EXCLUDED.is_gck
       RETURNING *`,
      [project_id, name, tag || '', price_per_contact || 0, is_gck || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update supplier (admin only)
router.put('/:supplierId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { name, tag, price_per_contact, is_gck } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (tag !== undefined) {
      updates.push(`tag = $${paramCount++}`);
      values.push(tag);
    }
    if (price_per_contact !== undefined) {
      updates.push(`price_per_contact = $${paramCount++}`);
      values.push(price_per_contact);
    }
    if (is_gck !== undefined) {
      updates.push(`is_gck = $${paramCount++}`);
      values.push(is_gck);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(supplierId);
    const result = await query(
      `UPDATE suppliers SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete supplier (admin only)
router.delete('/:supplierId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { supplierId } = req.params;
    
    // Verify supplier exists
    const supplierCheck = await query('SELECT id FROM suppliers WHERE id = $1', [supplierId]);
    if (supplierCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Delete supplier (CASCADE will automatically delete supplier_numbers)
    // Also need to set supplier_number_id to NULL in calls that reference deleted supplier_numbers
    await query(
      `UPDATE calls SET supplier_number_id = NULL 
       WHERE supplier_number_id IN (
         SELECT id FROM supplier_numbers WHERE supplier_id = $1
       )`,
      [supplierId]
    );
    
    // Delete supplier (CASCADE will delete supplier_numbers)
    await query('DELETE FROM suppliers WHERE id = $1', [supplierId]);
    
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error: any) {
    console.error('Delete supplier error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get supplier numbers for a project
router.get('/project/:projectId/numbers', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, pageSize = 1000, supplierId, isGck } = req.query;

    let whereConditions = ['sn.project_id = $1'];
    const values: any[] = [projectId];
    let paramCount = 2;

    if (supplierId) {
      whereConditions.push(`sn.supplier_id = $${paramCount++}`);
      values.push(supplierId);
    }

    // Filter by GCK: isGck=true -> only GCK, isGck=false -> only non-GCK
    const needsSupplierJoin = isGck === 'true' || isGck === 'false';
    if (isGck === 'true') {
      whereConditions.push(`s.is_gck = true`);
    } else if (isGck === 'false') {
      whereConditions.push(`(s.is_gck = false OR s.is_gck IS NULL)`);
    }

    const offset = (Number(page) - 1) * Number(pageSize);
    const result = await query(
      `SELECT sn.* FROM supplier_numbers sn
       ${needsSupplierJoin ? 'INNER JOIN suppliers s ON s.id = sn.supplier_id' : ''}
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY sn.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...values, Number(pageSize), offset]
    );

    const countQuery = needsSupplierJoin
      ? `SELECT COUNT(*) FROM supplier_numbers sn INNER JOIN suppliers s ON s.id = sn.supplier_id WHERE ${whereConditions.join(' AND ')}`
      : `SELECT COUNT(*) FROM supplier_numbers sn WHERE ${whereConditions.join(' AND ')}`;
    
    const countResult = await query(countQuery, values);

    res.json({
      numbers: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (error: any) {
    console.error('Get supplier numbers error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
