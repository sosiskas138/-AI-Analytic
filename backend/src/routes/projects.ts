import express from 'express';
import { query } from '../config/database.js';
import { authenticate, requireAdmin, requireProjectAccess, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

const ALLOWED_STATUS_KEYS = [
  'responsible',
  'is_active',
  'analysis_link',
  'company_name',
  'company_activity',
  'materials_requested',
  'materials_sent',
  'skillbase_ready',
  'test_launched',
  'launched_to_production',
  'comment',
] as const;

// Get all projects
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    let result;
    if (req.user!.isAdmin) {
      result = await query('SELECT * FROM projects ORDER BY created_at DESC');
    } else {
      result = await query(
        `SELECT p.* FROM projects p
         INNER JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = $1
         ORDER BY p.created_at DESC`,
        [req.user!.userId]
      );
    }
    res.json({ projects: result.rows });
  } catch (error: any) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get project stats (optimized - all projects at once)
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    let projectIds: string[];
    if (req.user!.isAdmin) {
      const projectsResult = await query('SELECT id FROM projects');
      projectIds = projectsResult.rows.map((r: any) => r.id);
    } else {
      const projectsResult = await query(
        `SELECT p.id FROM projects p
         INNER JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = $1`,
        [req.user!.userId]
      );
      projectIds = projectsResult.rows.map((r: any) => r.id);
    }

    if (projectIds.length === 0) {
      return res.json({ stats: {} });
    }

    // Get all calls stats in one query
    // unique_calls = уникальные номера (по которым звонили)
    // answered_calls = уникальные номера со статусом Успешный
    const statsResult = await query(
      `SELECT 
        project_id,
        COUNT(DISTINCT phone_normalized) as unique_calls,
        COUNT(DISTINCT CASE WHEN LOWER(TRIM(status)) IN ('успешный','ответ','answered','success') THEN phone_normalized END) as answered_calls,
        COUNT(DISTINCT CASE WHEN is_lead THEN phone_normalized END) as lead_calls
       FROM calls
       WHERE project_id = ANY($1)
       GROUP BY project_id`,
      [projectIds]
    );

    const stats: Record<string, { uniqueCalls: number; convCall: string; convLead: string }> = {};
    for (const row of statsResult.rows) {
      const uniqueCalls = parseInt(row.unique_calls) || 0;
      const answered = parseInt(row.answered_calls) || 0;
      const leads = parseInt(row.lead_calls) || 0;
      const convCall = uniqueCalls > 0 ? ((answered / uniqueCalls) * 100).toFixed(1) : '0';
      const convLead = answered > 0 ? ((leads / answered) * 100).toFixed(1) : '0';
      stats[row.project_id] = { uniqueCalls, convCall, convLead };
    }

    // Fill missing projects with zeros
    for (const id of projectIds) {
      if (!stats[id]) {
        stats[id] = { uniqueCalls: 0, convCall: '0', convLead: '0' };
      }
    }

    res.json({ stats });
  } catch (error: any) {
    console.error('Get project stats error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get single project stats (для дашборда, с опциональной фильтрацией по датам)
router.get('/:projectId/stats', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { fromDate, toDate } = req.query;
    let whereConditions = ['project_id = $1'];
    const values: any[] = [projectId];
    let paramCount = 2;
    if (fromDate) {
      whereConditions.push(`call_at >= $${paramCount++}::date`);
      values.push(fromDate);
    }
    if (toDate) {
      whereConditions.push(`call_at < ($${paramCount++}::date + interval '1 day')`);
      values.push(toDate);
    }
    const whereClause = whereConditions.join(' AND ');
    const statsResult = await query(
      `SELECT
        COUNT(DISTINCT phone_normalized) as unique_calls,
        COUNT(DISTINCT CASE WHEN LOWER(TRIM(status)) IN ('успешный','ответ','answered','success') THEN phone_normalized END) as answered_calls,
        COUNT(DISTINCT CASE WHEN is_lead THEN phone_normalized END) as lead_calls
       FROM calls
       WHERE ${whereClause}`,
      values
    );
    const row = statsResult.rows[0];
    const uniqueCalls = parseInt(row.unique_calls) || 0;
    const answered = parseInt(row.answered_calls) || 0;
    const leads = parseInt(row.lead_calls) || 0;
    const answerRate = uniqueCalls > 0 ? ((answered / uniqueCalls) * 100) : 0;
    res.json({ uniqueCalls, answered, leads, answerRate });
  } catch (error: any) {
    console.error('Get project stats error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get project by ID
router.get('/:projectId', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const result = await query('SELECT * FROM projects WHERE id = $1', [req.params.projectId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get project error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create project (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const trimmedName = String(name).trim();
    const existing = await query(
      'SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER($1)',
      [trimmedName]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Проект с таким названием уже существует' });
    }

    const result = await query(
      'INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *',
      [trimmedName, description || '']
    );

    const projectId = result.rows[0].id;

    // Add creator as member
    await query(
      'INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)',
      [projectId, req.user!.userId]
    );

    // Default price per minute = 12
    await query(
      'INSERT INTO project_pricing (project_id, price_per_number, price_per_call, price_per_minute) VALUES ($1, 0, 0, 12)',
      [projectId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create project error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update project (admin: name, description, has_gck; user with "Базы": only has_gck for own projects)
router.put('/:projectId', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, has_gck } = req.body;

    const isAdmin = req.user!.isAdmin;
    const canManageBases = req.user!.canManageBases;
    const canUpdateHasGck = isAdmin || canManageBases;
    if (!isAdmin && !canManageBases) {
      return res.status(403).json({ error: 'Forbidden: No permission to update project' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (isAdmin && name !== undefined) {
      const trimmedName = String(name).trim();
      const existing = await query(
        'SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER($1) AND id != $2',
        [trimmedName, projectId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Проект с таким названием уже существует' });
      }
      updates.push(`name = $${paramCount++}`);
      values.push(trimmedName);
    }
    if (isAdmin && description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (canUpdateHasGck && has_gck !== undefined) {
      updates.push(`has_gck = $${paramCount++}`);
      values.push(has_gck);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(projectId);
    const result = await query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update project error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete project (admin only)
router.delete('/:projectId', authenticate, requireAdmin, async (req, res) => {
  try {
    await query('SELECT delete_project($1)', [req.params.projectId]);
    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get project members
router.get('/:projectId/members', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const result = await query(
      `SELECT pm.*, u.email, p.full_name
       FROM project_members pm
       INNER JOIN users u ON u.id = pm.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE pm.project_id = $1`,
      [req.params.projectId]
    );
    res.json({ members: result.rows });
  } catch (error: any) {
    console.error('Get members error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Add project member (admin only)
router.post('/:projectId/members', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId, allowedTabs, canCreateSuppliers } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await query(
      `INSERT INTO project_members (project_id, user_id, allowed_tabs, can_create_suppliers)
       VALUES ($1, $2, $3, COALESCE($4, false))
       ON CONFLICT (project_id, user_id) DO UPDATE SET
         allowed_tabs = EXCLUDED.allowed_tabs,
         can_create_suppliers = COALESCE(EXCLUDED.can_create_suppliers, false)
       RETURNING *`,
      [req.params.projectId, userId, allowedTabs || [], canCreateSuppliers ?? false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Add member error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update project member (admin only)
router.put('/:projectId/members/:membershipId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { allowedTabs, canCreateSuppliers } = req.body;

    if (allowedTabs !== undefined && canCreateSuppliers === undefined) {
      await query(
        'UPDATE project_members SET allowed_tabs = $1 WHERE id = $2',
        [allowedTabs || [], req.params.membershipId]
      );
    } else if (canCreateSuppliers !== undefined && allowedTabs === undefined) {
      await query(
        'UPDATE project_members SET can_create_suppliers = $1 WHERE id = $2',
        [!!canCreateSuppliers, req.params.membershipId]
      );
    } else if (allowedTabs !== undefined || canCreateSuppliers !== undefined) {
      const updates: string[] = [];
      const values: any[] = [];
      let i = 1;
      if (allowedTabs !== undefined) {
        updates.push(`allowed_tabs = $${i++}`);
        values.push(allowedTabs || []);
      }
      if (canCreateSuppliers !== undefined) {
        updates.push(`can_create_suppliers = $${i++}`);
        values.push(!!canCreateSuppliers);
      }
      values.push(req.params.membershipId);
      await query(
        `UPDATE project_members SET ${updates.join(', ')} WHERE id = $${i}`,
        values
      );
    } else {
      return res.status(400).json({ error: 'No fields to update' });
    }
    res.json({ message: 'Member updated successfully' });
  } catch (error: any) {
    console.error('Update member error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Remove project member (admin only)
router.delete('/:projectId/members/:membershipId', authenticate, requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM project_members WHERE id = $1', [req.params.membershipId]);
    res.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get project pricing
router.get('/:projectId/pricing', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM project_pricing WHERE project_id = $1',
      [req.params.projectId]
    );
    res.json(result.rows[0] || null);
  } catch (error: any) {
    console.error('Get pricing error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update project pricing (admin or user with "Базы" for own projects)
router.put('/:projectId/pricing', authenticate, requireProjectAccess, async (req: AuthRequest, res) => {
  try {
    if (!req.user!.isAdmin && !req.user!.canManageBases) {
      return res.status(403).json({ error: 'Forbidden: No permission to update pricing' });
    }
    const { price_per_number, price_per_call, price_per_minute } = req.body;

    const result = await query(
      `INSERT INTO project_pricing (project_id, price_per_number, price_per_call, price_per_minute)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id) DO UPDATE SET
         price_per_number = EXCLUDED.price_per_number,
         price_per_call = EXCLUDED.price_per_call,
         price_per_minute = EXCLUDED.price_per_minute
       RETURNING *`,
      [req.params.projectId, price_per_number || 0, price_per_call || 0, price_per_minute || 0]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update pricing error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get project status
router.get('/:projectId/status', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM project_status WHERE project_id = $1',
      [req.params.projectId]
    );
    res.json(result.rows[0] || null);
  } catch (error: any) {
    console.error('Get project status error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update project status
router.put('/:projectId/status', authenticate, requireProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const updateData: Record<string, unknown> = {};
    for (const key of ALLOWED_STATUS_KEYS) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No allowed fields to update' });
    }

    // Check if status exists
    const existing = await query(
      'SELECT id FROM project_status WHERE project_id = $1',
      [projectId]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      const setClause = Object.keys(updateData)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
      result = await query(
        `UPDATE project_status SET ${setClause} WHERE project_id = $1 RETURNING *`,
        [projectId, ...Object.values(updateData)]
      );
    } else {
      // Insert new
      const keys = Object.keys(updateData);
      const values = Object.values(updateData);
      const placeholders = keys.map((_, idx) => `$${idx + 2}`).join(', ');
      result = await query(
        `INSERT INTO project_status (project_id, ${keys.join(', ')}) VALUES ($1, ${placeholders}) RETURNING *`,
        [projectId, ...values]
      );
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update project status error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Cleanup orphaned records (admin only)
router.post('/cleanup/orphaned', authenticate, requireAdmin, async (req, res) => {
  try {
    const results: any = {
      calls_updated: 0,
      import_jobs_updated: 0,
      reanimation_exports_updated: 0,
      supplier_numbers_deleted: 0,
      project_members_deleted: 0,
      user_roles_deleted: 0,
      profiles_deleted: 0,
      calls_deleted: 0,
      suppliers_deleted: 0,
      project_pricing_deleted: 0,
      project_status_deleted: 0,
      import_jobs_deleted: 0,
      reanimation_exports_deleted: 0,
      reanimation_export_numbers_deleted: 0,
    };

    // Clean up calls with invalid supplier_number_id
    const callsUpdate = await query(
      `UPDATE calls SET supplier_number_id = NULL 
       WHERE supplier_number_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM supplier_numbers WHERE id = calls.supplier_number_id)`
    );
    results.calls_updated = callsUpdate.rowCount || 0;

    // Clean up import_jobs with invalid uploaded_by
    const importJobsUpdate = await query(
      `UPDATE import_jobs SET uploaded_by = NULL 
       WHERE uploaded_by IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM users WHERE id = import_jobs.uploaded_by)`
    );
    results.import_jobs_updated = importJobsUpdate.rowCount || 0;

    // Clean up reanimation_exports with invalid exported_by
    const reanimationExportsUpdate = await query(
      `UPDATE reanimation_exports SET exported_by = NULL 
       WHERE exported_by IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM users WHERE id = reanimation_exports.exported_by)`
    );
    results.reanimation_exports_updated = reanimationExportsUpdate.rowCount || 0;

    // Clean up orphaned supplier_numbers
    const supplierNumbersDelete = await query(
      `DELETE FROM supplier_numbers 
       WHERE supplier_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM suppliers WHERE id = supplier_numbers.supplier_id)`
    );
    results.supplier_numbers_deleted = supplierNumbersDelete.rowCount || 0;

    // Clean up orphaned project_members
    const projectMembersDelete = await query(
      `DELETE FROM project_members 
       WHERE (project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM projects WHERE id = project_members.project_id))
       OR (user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = project_members.user_id))`
    );
    results.project_members_deleted = projectMembersDelete.rowCount || 0;

    // Clean up orphaned user_roles
    const userRolesDelete = await query(
      `DELETE FROM user_roles 
       WHERE user_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM users WHERE id = user_roles.user_id)`
    );
    results.user_roles_deleted = userRolesDelete.rowCount || 0;

    // Clean up orphaned profiles
    const profilesDelete = await query(
      `DELETE FROM profiles 
       WHERE user_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM users WHERE id = profiles.user_id)`
    );
    results.profiles_deleted = profilesDelete.rowCount || 0;

    // Clean up orphaned calls
    const callsDelete = await query(
      `DELETE FROM calls 
       WHERE project_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM projects WHERE id = calls.project_id)`
    );
    results.calls_deleted = callsDelete.rowCount || 0;

    // Clean up orphaned suppliers
    const suppliersDelete = await query(
      `DELETE FROM suppliers 
       WHERE project_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM projects WHERE id = suppliers.project_id)`
    );
    results.suppliers_deleted = suppliersDelete.rowCount || 0;

    // Clean up orphaned project_pricing
    const projectPricingDelete = await query(
      `DELETE FROM project_pricing 
       WHERE project_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM projects WHERE id = project_pricing.project_id)`
    );
    results.project_pricing_deleted = projectPricingDelete.rowCount || 0;

    // Clean up orphaned project_status
    const projectStatusDelete = await query(
      `DELETE FROM project_status 
       WHERE project_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM projects WHERE id = project_status.project_id)`
    );
    results.project_status_deleted = projectStatusDelete.rowCount || 0;

    // Clean up orphaned import_jobs
    const importJobsDelete = await query(
      `DELETE FROM import_jobs 
       WHERE project_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM projects WHERE id = import_jobs.project_id)`
    );
    results.import_jobs_deleted = importJobsDelete.rowCount || 0;

    // Clean up orphaned reanimation_exports
    const reanimationExportsDelete = await query(
      `DELETE FROM reanimation_exports 
       WHERE project_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM projects WHERE id = reanimation_exports.project_id)`
    );
    results.reanimation_exports_deleted = reanimationExportsDelete.rowCount || 0;

    // Clean up orphaned reanimation_export_numbers
    const reanimationExportNumbersDelete = await query(
      `DELETE FROM reanimation_export_numbers 
       WHERE export_id IS NOT NULL 
       AND NOT EXISTS (SELECT 1 FROM reanimation_exports WHERE id = reanimation_export_numbers.export_id)`
    );
    results.reanimation_export_numbers_deleted = reanimationExportNumbersDelete.rowCount || 0;

    const totalCleaned = Object.values(results).reduce((sum: number, val: any) => sum + (val || 0), 0);

    res.json({
      message: 'Cleanup completed',
      results,
      total_cleaned: totalCleaned
    });
  } catch (error: any) {
    console.error('Cleanup orphaned records error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
