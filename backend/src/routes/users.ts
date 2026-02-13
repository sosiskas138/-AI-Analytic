import express from 'express';
import { query } from '../config/database.js';
import { hashPassword } from '../config/auth.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, p.full_name,
       COALESCE((SELECT role FROM user_roles WHERE user_id = u.id LIMIT 1), 'member') as role
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (error: any) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Create user (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { login, password, full_name, role } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required' });
    }

    // If login doesn't contain @, append @app.local
    const email = login.includes('@') ? login : `${login}@app.local`;

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userResult = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );

    const user = userResult.rows[0];

    // Create profile
    await query(
      'INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)',
      [user.id, full_name || '']
    );

    // Assign role if specified
    if (role && role !== 'member') {
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING',
        [user.id, role]
      );
    }

    res.json({ user_id: user.id });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update user (admin only)
router.put('/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { login, password, full_name } = req.body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (login) {
      const email = login.includes('@') ? login : `${login}@app.local`;
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }

    if (password) {
      const passwordHash = await hashPassword(password);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }

    if (updates.length > 0) {
      values.push(userId);
      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    }

    if (full_name !== undefined) {
      await query(
        'UPDATE profiles SET full_name = $1 WHERE user_id = $2',
        [full_name, userId]
      );
    }

    res.json({ message: 'User updated successfully' });
  } catch (error: any) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete user (admin only)
router.delete('/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Delete user (cascade will handle related records)
    await query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
