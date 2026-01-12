import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { q } from "../db/pool.js";
import { getJwtSecret } from "../middleware/requireAuth.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import express from "express";
import cookieParser from "cookie-parser";
import requireAuth from "../middleware/requireAuth.js";
import requireFeature from "../middleware/requireAuth.js";
import { features } from "process";
import res from 'express/lib/response.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cookieParser());


function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: String(process.env.COOKIE_SECURE).toLowerCase() === "true",
    maxAge: 1000 * 60 * 60 // 1h
  });
}

// POST /login
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).send("Missing credentials. <a href='/login.html'>Back</a>");
  }

  // user_name is CITEXT (case-insensitive) in your schema
  const { rows } = await q(
    `SELECT id, user_name, real_name, role, is_verified, password_hash
     FROM users
     WHERE user_name = $1
     LIMIT 1`,
    [username]
  );

  const user = rows[0];
  if (!user) {
    return res.status(401).send("Invalid credentials sry. <a href='/login.html'>Try again</a>");
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).send("Invalid credentials maybe login expired idk. <a href='/login.html'>Try again</a>");
  }

  // (Optional) block unverified users:
  // if (!user.is_verified) return res.status(403).send("Please verify your account.");

  const payload = {
    sub: user.id,                // uuid
    uname: user.user_name,       // login name
    name: user.real_name || "",  // display
    role: user.role              // 'user' | 'admin' | 'moderator'
  };

  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRES || "1h" });
  setAuthCookie(res, token);
  return res.redirect("/account");
});

// GET /login
router.get("/login", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      res.sendFile("login.html", { root: path.join(__dirname, "../public") });

    }

    try {
      jwt.verify(token, getJwtSecret());
      return res.redirect("/account");
    } catch {
      res.sendFile("login.html", { root: path.join(__dirname, "../public") });
    }
  } catch (err) {
    console.error("Error in /login route:", err);
    res.status(500).send("Internal Server Error. KB");
  }
});

// POST /logout
router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.status(204).end();
});

router.get("/api/session", async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ authenticated: false });

  try {
    const user = jwt.verify(token, getJwtSecret());
    // only return the safe bits you need on the client
    const { rows } = await q(
      `SELECT id
       FROM users
       WHERE user_name = $1
       LIMIT 1`,
      [user.uname]
    );

    const user2 = rows[0];
    if (!user2) return res.status(404).json({ error: "User not found" });


    const feats = await q(
      `SELECT f.key, f.label
         FROM user_features uf
         JOIN features f ON f.id = uf.feature_id
        WHERE uf.user_id = $1`,
      [user2.id]
    );

    return res.json({

      authenticated: true,
      user: {
        id: user.sub,
        uname: user.uname,
        name: user.name,
        role: user.role,
        //features: feats.rows.map(r => r.key) // e.g. ['x','y']
        features: feats.rows
      }
    });
    //featuerlar olmadan
    //return res.json({
    //  authenticated: true,
    //  user: { id: user.sub, uname: user.uname, name: user.name, role: user.role }
    //});
  } catch {
    return res.json({ authenticated: false });
  }
});

router.get("/meinfo", async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // verify token
    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { rows } = await q(
      `SELECT id,
              user_name,
              real_name,
              role,
              is_verified,
              join_date,
              verification_date,
              email,
              tel_nr,
              location,
              profile_pic_path,
              updated_at,
              email_verified,
              email_confirmed_by_user
       FROM users
       WHERE user_name = $1
       LIMIT 1`,
      [decoded.uname]
    );

    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    //ozellikler
    const feats = await q(
      `SELECT f.key
         FROM user_features uf
         JOIN features f ON f.id = uf.feature_id
        WHERE uf.user_id = $1`,
      [user.id]
    );

    res.json({
      username: user.user_name,
      realName: user.real_name,
      role: user.role,
      verified: user.is_verified,
      joinDate: user.join_date,
      verifiedAt: user.verification_date,
      email: user.email,
      phone: user.tel_nr,
      location: user.location,
      profilePic: user.profile_pic_path,
      updatedAt: user.updated_at,
      features: feats.rows.map(r => r.key),
      email_verified: user.email_verified,
      email_confirmed_by_user: user.email_confirmed_by_user
    });
  } catch (err) {
    console.error("Error retrieving user info:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//mobile
router.post("/api/mobile-login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  const { rows } = await q(
    `SELECT id, user_name, real_name, role, is_verified, password_hash
     FROM users
     WHERE user_name = $1
     LIMIT 1`,
    [username]
  );

  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const payload = {
    id: user.id,
    sub: user.id,
    uname: user.user_name,
    name: user.real_name || "",
    role: user.role
  };

  const token = jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES || "1h"
  });

  return res.json({ token, user: payload });
});

//mobile
router.get("/api/me", requireAuth, async (req, res) => {
  try {
    const { uname, sub } = req.user; // from JWT

    const { rows } = await q(
      `SELECT id,
              user_name,
              real_name,
              role,
              is_verified,
              join_date,
              verification_date,
              email,
              tel_nr,
              location,
              profile_pic_path,
              updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [sub]
    );

    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const feats = await q(
      `SELECT f.key
         FROM user_features uf
         JOIN features f ON f.id = uf.feature_id
        WHERE uf.user_id = $1`,
      [user.id]
    );

    res.json({
      username: user.user_name,
      realName: user.real_name,
      role: user.role,
      verified: user.is_verified,
      joinDate: user.join_date,
      verifiedAt: user.verification_date,
      email: user.email,
      phone: user.tel_nr,
      location: user.location,
      profilePic: user.profile_pic_path,
      updatedAt: user.updated_at,
      features: feats.rows.map(r => r.key)
    });
  } catch (err) {
    console.error("Error retrieving user info:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


//FORGOT PASSWORD CALISMIYO 
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  console.log("Birisi email forgot etti =>", email);

  // Always respond success-ish
  const genericResponse =
    "If an account with that email exists, you will receive a password reset link.";

  if (!email) {
    console.log("email yok gondermiyorum linki");
    return res.status(200).json({ message: genericResponse });
  }

  try {
    // 1. Find the user by email
    console.log('1');
    const { rows } = await q(
      `SELECT id, email FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    console.
      console.log('2');
    const user = rows[0];
    if (!user) {
      // do NOT reveal "no such email"
      return res.status(200).json({ message: genericResponse });
    }

    // 2. Build a secure random token
    //    (crypto.randomBytes(32).toString("hex") is fine)
    console.log('3');
    const cryptoBytes = await import("crypto");
    const rawToken = cryptoBytes.randomBytes(32).toString("hex");

    console.log('4');
    // 3. Insert token in DB with expiry (e.g. now + 15 min)
    const { rows: inserted } = await q(
      `INSERT INTO password_resets (token, user_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
       RETURNING token`,
      [rawToken, user.id]
    );

    console.log('5');
    const resetToken = inserted[0].token;

    // 4. Send email containing reset link with that token
    //    FRONTEND PAGE: /reset-password.html?token=...
    console.log('6');
    const resetUrl = `${process.env.PUBLIC_BASE_URL}/reset-password.html?token=${encodeURIComponent(resetToken)}`;

    // pseudo-mailer
    // await emailSender.send({
    //   to: user.email,
    //   subject: "Password reset",
    //   text: `Click this link to reset your password: ${resetUrl}\nThis link expires in 15 minutes.`
    // });

    console.log("Password reset link for debug:", resetUrl);

    // 5. Respond generic
    return res.status(200).json({ message: genericResponse });

  } catch (err) {
    console.error("forgot-password error:", err);
    // still don't leak info
    return res.status(200).json({ message: genericResponse });
  }
});

//CALISMIYO
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};

  if (!token || !newPassword) {
    return res.status(400).json({ error: "Missing data" });
  }

  try {
    // 1. Look up the token
    const { rows } = await q(
      `SELECT pr.user_id, pr.expires_at, pr.used,
              u.id, u.user_name
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token = $1
       LIMIT 1`,
      [token]
    );

    const row = rows[0];
    if (!row) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // 2. Check expiry and used
    const now = Date.now();
    const expiresAt = new Date(row.expires_at).getTime();
    if (row.used || now > expiresAt) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // 3. Hash new password
    const hash = await bcrypt.hash(newPassword, 12); // cost 12 is ok

    // 4. Update user's password_hash
    await q(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hash, row.user_id]
    );

    // 5. Mark token as used (single-use)
    await q(
      `UPDATE password_resets SET used = TRUE WHERE token = $1`,
      [token]
    );

    return res.status(200).json({ ok: true, message: "Password updated." });

  } catch (err) {
    console.error("reset-password error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


// GET /api/me/notifications - Fetch current notification settings
router.get("/api/me/notifications", requireAuth, async (req, res) => {
  try {
    const { rows } = await q(
      `SELECT push_enabled, email_enabled, 
              push_login, push_public_share, push_direct_share, push_post_comment, push_post_reaction, push_song_played,
              email_login, email_public_share, email_direct_share, email_post_comment, email_post_reaction, email_song_played
       FROM user_notification_settings 
       WHERE user_id = $1`,
      [req.user.sub]
    );

    if (rows.length === 0) {
      // If no settings exist yet, create default entry or return defaults
      return res.json({
        push_enabled: true,
        email_enabled: false,
        push_login: true,
        // ... fill other defaults matching your DB schema
      });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Failed to fetch notification settings:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PATCH /api/me/notifications - Update specific notification settings
router.patch("/api/me/notifications", requireAuth, async (req, res) => {
  try {
    const settings = req.body;
    // In auth.js
    const allowedKeys = [
      'push_enabled', 'email_enabled',
      'push_login', 'push_public_share', 'push_direct_share', 'push_post_comment', 'push_post_reaction', 'push_song_played',
      'email_login', 'email_public_share', 'email_direct_share', 'email_post_comment', 'email_post_reaction', 'email_song_played'
    ];

    // Filter body to only include valid columns
    const updates = {};
    for (const key of allowedKeys) {
      if (typeof settings[key] === 'boolean') {
        updates[key] = settings[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid settings provided" });
    }

    // Build dynamic SQL query
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    const values = [req.user.sub, ...Object.values(updates)];

    const query = `
      UPDATE user_notification_settings 
      SET ${setClause}, updated_at = NOW() 
      WHERE user_id = $1 
      RETURNING *`;

    const { rows } = await q(query, values);
    res.json({ ok: true, settings: rows[0] });
  } catch (err) {
    console.error("Failed to update notification settings:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/notifications/global-status - Check if systems/categories are globally enabled
router.get("/api/notifications/global-status", requireAuth, async (req, res) => {
  try {
    const { rows } = await q(`SELECT feature_key, is_enabled FROM global_notification_controls`);
    // Convert array to a key-value object for easier frontend lookup: { email_login: true, ... }
    const statusMap = rows.reduce((acc, row) => {
      acc[row.feature_key] = row.is_enabled;
      return acc;
    }, {});

    res.json(statusMap);
  } catch (err) {
    console.error("Error fetching global status:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/me/push-subscription-status - Check if user has registered push devices
router.get("/api/me/push-subscription-status", requireAuth, async (req, res) => {
  try {
    const { rows } = await q(
      `SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = $1`,
      [req.user.sub]
    );

    const hasSubscription = parseInt(rows[0].count) > 0;
    res.json({ hasSubscription });
  } catch (err) {
    console.error("Error checking push subscription:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


//POST WEIGHT INPUT
router.post('/api/weight', requireAuth, express.json(), async (req, res) => {
  try {
    const { weightKg, entry_date, note = null, source = 'manual' } = req.body || {};

    const w = Number(weightKg);
    if (!isFinite(w) || w <= 0 || w >= 400) {
      return res.status(400).json({ error: 'Invalid weight' });
    }

    const sql = `
      INSERT INTO weight_entries (user_id, entry_date, weight_kg, note, source)
      VALUES ($1, COALESCE($2::date, (now() AT TIME ZONE 'Europe/Berlin')::date), $3::numeric, $4, $5)
      ON CONFLICT (user_id, entry_date) DO NOTHING
      RETURNING user_id, entry_date, weight_kg, note, source, created_at, updated_at;
    `;
    const params = [req.user.sub, entry_date ?? null, w, note, source];

    const { rows } = await q(sql, params);
    if (!rows.length) {
      // conflict happened
      return res.status(409).json({ error: 'An entry for this date already exists. You Can only add one entry per date. If may wish to edit the entry for that day' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('POST /api/weight failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// GET /api/weights?days=7|30|90|180|365
router.get('/api/weights', requireAuth, async (req, res) => {
  try {
    // Accept only the presets from your UI select
    const allowed = new Set([7, 30, 90, 180, 365]);
    const raw = Number.parseInt(String(req.query.days ?? '30'), 10);
    const days = allowed.has(raw) ? raw : 30;

    // Compute inclusive date range in Europe/Berlin (same as insert code)
    // We select entries whose entry_date >= (today_in_Berlin - (days-1))
    const sql = `
      WITH bounds AS (
        SELECT
          (now() AT TIME ZONE 'Europe/Berlin')::date                           AS end_date,
          ((now() AT TIME ZONE 'Europe/Berlin')::date - ($2::int - 1))        AS start_date
      )
      SELECT
        e.entry_date,
        e.weight_kg,
        e.note,
        e.source
      FROM weight_entries e, bounds b
      WHERE e.user_id = $1
        AND e.entry_date BETWEEN b.start_date AND b.end_date
      ORDER BY e.entry_date ASC;
    `;

    const params = [req.user.sub, days];
    const { rows } = await q(sql, params);

    // Also return the exact start/end we used so the client can label the chart nicely
    const metaSql = `
      SELECT
        (now() AT TIME ZONE 'Europe/Berlin')::date                           AS end_date,
        ((now() AT TIME ZONE 'Europe/Berlin')::date - ($1::int - 1))        AS start_date
    `;
    const meta = (await q(metaSql, [days])).rows[0];

    return res.json({
      days,
      range: { start: meta.start_date, end: meta.end_date },
      count: rows.length,
      items: rows
    });
  } catch (err) {
    console.error('GET /api/weights failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.patch('/api/weight/:date', requireAuth, express.json(), async (req, res) => {
  try {
    const entry_date = String(req.params.date || '').trim();

    // Basic YYYY-MM-DD sanity check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
      console.log("False Date format to update the KT.");
      return res.status(400).json({ error: 'Invalid date format (expected YYYY-MM-DD). INPUT: ' + entry_date });
    }

    // DESTRUCTURE FIRST
    let { weightKg, note, source } = req.body || {};

    // THEN LOG
    console.log('PATCH request for date:', entry_date);
    console.log('Update data:', { weightKg, note, source });
    console.log('User ID:', req.user.sub);

    // Optional weight validation (only if provided)
    if (weightKg !== undefined) {
      const w = Number(weightKg);
      if (!isFinite(w) || w <= 0 || w >= 400) {
        return res.status(400).json({ error: 'Invalid weight' });
      }
      weightKg = w;
    }

    // Only allow known sources (optional: tighten as you like)
    if (source !== undefined && typeof source !== 'string') {
      return res.status(400).json({ error: 'Invalid source' });
    }
    if (note !== undefined && typeof note !== 'string') {
      return res.status(400).json({ error: 'Invalid note' });
    }

    // Nothing to update?
    if (weightKg === undefined && note === undefined && source === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Build dynamic UPDATE with COALESCE on passed fields
    const params = [
      req.user.sub,        // $1 user_id
      entry_date,          // $2 date
      weightKg ?? null,    // $3 weight_kg
      note ?? null,        // $4 note
      source ?? null       // $5 source
    ];

    const sql = `
      UPDATE weight_entries
         SET weight_kg = COALESCE($3::numeric, weight_kg),
             note      = COALESCE($4, note),
             source    = COALESCE($5, source),
             updated_at= now()
       WHERE user_id   = $1
         AND entry_date= $2::date
      RETURNING user_id, entry_date, weight_kg, note, source, created_at, updated_at;
    `;

    const { rows } = await q(sql, params);
    if (!rows.length) return res.status(404).json({ error: 'Entry not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/weight/:date failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



export default router;