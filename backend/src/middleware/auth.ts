import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../config/auth.js';
import { query } from '../config/database.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role?: string;
    isAdmin: boolean;
    canManageBases: boolean;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    // Get all user roles from database
    const roleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [payload.userId]
    );
    const roles = (roleResult.rows as { role: string }[]).map((r) => r.role);
    const isAdmin = roles.includes('admin');
    const canManageBases = roles.includes('bases');

    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: roles.includes('admin') ? 'admin' : roles.includes('bases') ? 'bases' : (roles[0] || 'member'),
      isAdmin,
      canManageBases: isAdmin || canManageBases,
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

export async function requireProjectAccess(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Admins have access to all projects
  if (req.user.isAdmin) {
    return next();
  }

  // Check if user is a member of the project
  const projectId = req.params.projectId || req.body.project_id;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID required' });
  }

  const result = await query(
    'SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = $2',
    [req.user.userId, projectId]
  );

  if (result.rows.length === 0) {
    return res.status(403).json({ error: 'Forbidden: No access to this project' });
  }

  next();
}

/** Requires project access AND (admin OR canManageBases OR can_create_suppliers). Use after requireProjectAccess. */
export async function requireCanCreateSuppliers(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.isAdmin || req.user.canManageBases) {
    return next();
  }
  const projectId = req.params.projectId || req.body.project_id;
  if (!projectId) {
    return res.status(400).json({ error: 'Project ID required' });
  }
  const result = await query(
    'SELECT COALESCE(can_create_suppliers, false) as can_create_suppliers FROM project_members WHERE user_id = $1 AND project_id = $2',
    [req.user.userId, projectId]
  );
  if (result.rows.length === 0 || !result.rows[0].can_create_suppliers) {
    return res.status(403).json({ error: 'Forbidden: No permission to create bases in this project' });
  }
  next();
}
