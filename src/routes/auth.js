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
              updated_at
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
      features: feats.rows.map(r => r.key) // e.g. ['x','y']
    });
  } catch (err) {
    console.error("Error retrieving user info:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


//FORGOT PASSWORD
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


//POST WEIGHT INPUT
router.post('/api/weight', requireAuth, express.json(), async (req, res) => {
  try {
    const { weightKg, entry_date, note = null, source = 'manual' } = req.body || {};

    // Validate
    const w = Number(weightKg);
    if (!isFinite(w) || w <= 0 || w >= 400) {
      return res.status(400).json({ error: 'Invalid weight' });
    }

    // If client didn’t send a date, use today in Europe/Berlin
    // This sets entry_date_server to a DATE in that TZ.
    const sql = `
      INSERT INTO weight_entries (user_id, entry_date, weight_kg, note, source)
      VALUES ($1,
              COALESCE($2::date, (now() AT TIME ZONE 'Europe/Berlin')::date),
              $3::numeric,
              $4,
              $5)
      ON CONFLICT (user_id, entry_date)
      DO UPDATE SET
        weight_kg = EXCLUDED.weight_kg,
        note      = EXCLUDED.note,
        source    = EXCLUDED.source,
        updated_at= now()
      RETURNING user_id, entry_date, weight_kg, note, source, created_at, updated_at;
    `;
    const params = [req.user.sub, entry_date || null, w, note, source];
    const dbRes = await q(sql, params);
    console.log(dbRes.rows[0]);
    return res.status(201).json(dbRes.rows[0]);
  } catch (err) {
    console.error('POST /api/weight failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
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
      return res.status(400).json({ error: 'Invalid date format (expected YYYY-MM-DD)' });
    }

    let { weightKg, note, source } = req.body || {};

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
    const sql = `
      UPDATE weight_entries
         SET weight_kg = COALESCE($4::numeric, weight_kg),
             note      = COALESCE($5, note),
             source    = COALESCE($6, source),
             updated_at= now()
       WHERE user_id   = $1
         AND entry_date= $2::date
      RETURNING user_id, entry_date, weight_kg, note, source, created_at, updated_at;
    `;

    const params = [
      req.user.sub,        // $1 user_id (from JWT)
      entry_date,          // $2 date to edit
      null,                // (kept for readability if you later add more columns)
      weightKg ?? null,    // $4 weight_kg (nullable for COALESCE)
      note ?? null,        // $5 note
      source ?? null       // $6 source
    ];

    const { rows } = await q(sql, params);
    if (!rows.length) return res.status(404).json({ error: 'Entry not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/weight/:date failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
