import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Middleware to check if user is admin
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Admin dashboard
router.get("/admin", requireAuth, requireAdmin, (req, res) => {
  const projectRoot = path.join(__dirname, '../..');
  const filePath = path.join(projectRoot, 'src', 'public', 'admin', 'index.html');
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending admin panel:", err);
      res.status(500).send("Internal Server Error: Could not load admin panel");
    }
  });
});

// Get all users with pagination
router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';

    let whereClause = '';
    let params = [limit, offset];
    
    if (search) {
      whereClause = `WHERE user_name ILIKE $3 OR real_name ILIKE $3 OR email ILIKE $3`;
      params.push(`%${search}%`);
    }

    const sql = `
      SELECT 
        id, user_name, real_name, email, tel_nr, role, 
        is_verified, join_date, verification_date, location,
        profile_pic_path, updated_at
      FROM users 
      ${whereClause}
      ORDER BY join_date DESC 
      LIMIT $1 OFFSET $2
    `;

    const countSql = `
      SELECT COUNT(*) as total 
      FROM users 
      ${whereClause}
    `;

    const [usersResult, countResult] = await Promise.all([
      q(sql, params),
      q(countSql, search ? [params[2]] : [])
    ]);

    res.json({
      users: usersResult.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get user details
router.get("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    const userSql = `
      SELECT * FROM users WHERE id = $1
    `;
    
    // Updated to return feature IDs as well so frontend can map them easily
    const featuresSql = `
      SELECT f.id, f.key, f.label 
      FROM user_features uf 
      JOIN features f ON f.id = uf.feature_id 
      WHERE uf.user_id = $1
    `;

    const weightEntriesSql = `
      SELECT * FROM weight_entries 
      WHERE user_id = $1 
      ORDER BY entry_date DESC 
      LIMIT 100
    `;

    const [userResult, featuresResult, weightResult] = await Promise.all([
      q(userSql, [userId]),
      q(featuresSql, [userId]),
      q(weightEntriesSql, [userId])
    ]);

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: userResult.rows[0],
      features: featuresResult.rows,
      weightEntries: weightResult.rows
    });
  } catch (err) {
    console.error("Error fetching user details:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Update user (FIXED TO INCLUDE FEATURES)
router.patch("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = req.body;

    // 1. Handle Feature Updates (if 'features' array exists in body)
    if (updates.features !== undefined && Array.isArray(updates.features)) {
        // First, remove all existing features for this user
        await q('DELETE FROM user_features WHERE user_id = $1', [userId]);

        // Then, add the selected ones
        if (updates.features.length > 0) {
            for (const featureId of updates.features) {
                // Ensure ID is an integer
                const fId = parseInt(featureId);
                if (!isNaN(fId)) {
                    await q('INSERT INTO user_features (user_id, feature_id) VALUES ($1, $2)', [userId, fId]);
                }
            }
        }
    }

    // 2. Handle User Table Updates
    const allowedFields = ['user_name', 'real_name', 'email', 'tel_nr', 'role', 'is_verified', 'location'];
    const setClauses = [];
    const params = [];
    let paramCount = 1;

    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramCount}`);
        params.push(updates[field]);
        paramCount++;
      }
    });

    let userResult;

    // Only run UPDATE query if there are user fields to update
    if (setClauses.length > 0) {
      params.push(userId);
      const sql = `
        UPDATE users 
        SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING *
      `;
      userResult = await q(sql, params);
      
      if (!userResult.rows.length) {
        return res.status(404).json({ error: "User not found" });
      }
    } else {
      // If only features were updated, just fetch the user to return consistent response
      userResult = await q('SELECT * FROM users WHERE id = $1', [userId]);
      if (!userResult.rows.length) {
          return res.status(404).json({ error: "User not found" });
      }
    }

    res.json({ user: userResult.rows[0], message: "User updated successfully" });

  } catch (err) {
    console.error("Error updating user:", err);
    
    // Handle unique constraint violations
    if (err.code === '23505') {
      if (err.constraint === 'users_username_unique') {
        return res.status(400).json({ error: "Username already exists" });
      }
      if (err.constraint === 'users_email_key') {
        return res.status(400).json({ error: "Email already exists" });
      }
    }
    
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete user
router.delete("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user.sub) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }

    const sql = `DELETE FROM users WHERE id = $1 RETURNING id`;
    const result = await q(sql, [userId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get system statistics
router.get("/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const statsSql = `
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE is_verified = true) as verified_users,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') as admin_users,
        (SELECT COUNT(*) FROM weight_entries) as total_weight_entries,
        (SELECT COUNT(*) FROM devices) as total_devices,
        (SELECT COUNT(*) FROM password_resets WHERE used = false AND expires_at > NOW()) as active_reset_tokens
    `;

    const recentUsersSql = `
      SELECT user_name, join_date, role 
      FROM users 
      ORDER BY join_date DESC 
      LIMIT 5
    `;

    const [statsResult, recentUsersResult] = await Promise.all([
      q(statsSql),
      q(recentUsersSql)
    ]);

    res.json({
      stats: statsResult.rows[0],
      recentUsers: recentUsersResult.rows
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Manage user features (Single add/remove - kept for compatibility if needed elsewhere)
router.post("/admin/users/:id/features", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { featureKey, action } = req.body; // action: 'add' or 'remove'

    if (!featureKey || !action) {
      return res.status(400).json({ error: "Missing featureKey or action" });
    }

    if (action === 'add') {
      const sql = `
        INSERT INTO user_features (user_id, feature_id)
        SELECT $1, id FROM features WHERE key = $2
        ON CONFLICT (user_id, feature_id) DO NOTHING
        RETURNING *
      `;
      const result = await q(sql, [userId, featureKey]);
      res.json({ message: "Feature added", feature: result.rows[0] });
    } else if (action === 'remove') {
      const sql = `
        DELETE FROM user_features 
        WHERE user_id = $1 AND feature_id IN (SELECT id FROM features WHERE key = $2)
        RETURNING *
      `;
      const result = await q(sql, [userId, featureKey]);
      res.json({ message: "Feature removed", feature: result.rows[0] });
    } else {
      res.status(400).json({ error: "Invalid action" });
    }
  } catch (err) {
    console.error("Error managing user features:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get all available features
router.get("/admin/features", requireAuth, requireAdmin, async (req, res) => {
  try {
    const sql = `SELECT * FROM features ORDER BY key`;
    const result = await q(sql);
    res.json({ features: result.rows });
  } catch (err) {
    console.error("Error fetching features:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Create new feature
router.post("/admin/features", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { featureKey, featureLabel } = req.body;
    const sql = `
        INSERT INTO features VALUES (nextval('features_id_seq'::regclass) + 1, $1, $2)
      `;
    const result = await q(sql, [featureKey, featureLabel]);
    res.json({ features: result.rows });
  } catch (err) {
    console.error("Error creating features:", err);
    res.status(500).json({ error: "Internal Server Error creating feature" });
  }
});

// Add user
router.post("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { user_name, real_name, email, tel_nr, role, password } = req.body;

    // Validate required fields
    if (!user_name || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    // Validate username format (matches your schema constraint)
    const usernameRegex = /^[A-Za-z0-9_]{3,32}$/;
    if (!usernameRegex.test(user_name)) {
      return res.status(400).json({ error: "Username must be 3-32 characters and contain only letters, numbers, and underscores" });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    const sql = `
      INSERT INTO users (user_name, real_name, email, tel_nr, role, password_hash, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_name, real_name, email, role, is_verified, join_date
    `;

    const params = [
      user_name,
      real_name || null,
      email || null,
      tel_nr || null,
      role || 'user',
      password_hash,
      true // Auto-verify admin-created users
    ];

    const result = await q(sql, params);
    
    res.status(201).json({ 
      message: "User created successfully", 
      user: result.rows[0] 
    });
  } catch (err) {
    console.error("Error creating user:", err);
    
    // Handle unique constraint violations
    if (err.code === '23505') {
      if (err.constraint === 'users_username_unique') {
        return res.status(400).json({ error: "Username already exists" });
      }
      if (err.constraint === 'users_email_key') {
        return res.status(400).json({ error: "Email already exists" });
      }
    }
    
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Change user password
router.patch("/admin/users/:id/password", requireAuth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    // Hash new password
    const password_hash = await bcrypt.hash(newPassword, 12);

    const sql = `
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, user_name, email
    `;

    const result = await q(sql, [password_hash, userId]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ 
      message: "Password updated successfully",
      user: result.rows[0]
    });
  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;