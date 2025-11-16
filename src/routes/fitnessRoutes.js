import { Router } from "express";
import express from "express";
import requireAuth from "../middleware/requireAuth.js";
import { q, pool } from "../db/pool.js";

const router = Router();
router.use(express.json());


//WORKOUT ISTE
router.get("/api/machines", requireAuth, async (_req, res) => {
  try {
    const { rows } = await q(
      `SELECT id, name, body_part
         FROM machines
        ORDER BY name ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /api/machines", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/machines", requireAuth, async (req, res) => {
  try {
    const { name, body_part = null } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Missing machine name" });
    const { rows } = await q(
      `INSERT INTO machines (name, body_part)
       VALUES ($1,$2)
       ON CONFLICT (name) DO UPDATE
         SET body_part = COALESCE(EXCLUDED.body_part, machines.body_part)
       RETURNING id, name, body_part`,
      [String(name).trim(), body_part]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /api/machines", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ------------------------------- EXERCISES ------------------------------ */

router.get("/api/exercises", requireAuth, async (req, res) => {
  try {
    const qstr = (req.query.query ?? "").trim();
    const params = [];
    let sql = `SELECT id, name, category, primary_muscle, is_bodyweight FROM exercises`;
    if (qstr) {
      sql += ` WHERE name ILIKE $1`;
      params.push(`%${qstr}%`);
    }
    sql += ` ORDER BY name ASC LIMIT 200`;
    const { rows } = await q(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /api/exercises", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/api/exercises", requireAuth, async (req, res) => {
  try {
    const { name, category = null, primary_muscle = null, is_bodyweight = false } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "Missing name" });

    const { rows } = await q(
      `INSERT INTO exercises (name, category, primary_muscle, is_bodyweight)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (name) DO UPDATE
         SET category = COALESCE(EXCLUDED.category, exercises.category),
             primary_muscle = COALESCE(EXCLUDED.primary_muscle, exercises.primary_muscle),
             is_bodyweight = EXCLUDED.is_bodyweight
       RETURNING id, name, category, primary_muscle, is_bodyweight`,
      [String(name).trim(), category, primary_muscle, !!is_bodyweight]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /api/exercises", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ------------------------------- SESSIONS ------------------------------- */


/**
 * GET /api/workouts?days=7|30|90|180|365
 */
router.get("/api/workouts", requireAuth, async (req, res) => {
  try {
    const allowed = new Set([7, 30, 90, 180, 365]);
    const raw = Number.parseInt(String(req.query.days ?? "30"), 10);
    const days = allowed.has(raw) ? raw : 30;

    const { rows: sessions } = await q(
      `WITH bounds AS (
         SELECT
           (now() AT TIME ZONE 'Europe/Berlin')::date AS end_date,
           ((now() AT TIME ZONE 'Europe/Berlin')::date - ($2::int - 1)) AS start_date
       )
       SELECT ws.*
         FROM workout_sessions ws, bounds b
        WHERE ws.user_id = $1
          AND ws.session_date BETWEEN b.start_date AND b.end_date
        ORDER BY ws.session_date DESC, ws.created_at DESC`,
      [req.user.id, days]
    );

    const sessionIds = sessions.map(s => s.id);
    let items = [];
    if (sessionIds.length) {
      const { rows } = await q(
        `SELECT we.*,
                m.name AS machine_name,
                e.name AS exercise_name
           FROM workout_entries we
           LEFT JOIN machines  m ON m.id = we.machine_id
           LEFT JOIN exercises e ON e.id = we.exercise_id
          WHERE we.session_id = ANY($1::uuid[])
          ORDER BY we.created_at ASC`,
        [sessionIds]
      );
      items = rows;
    }

    res.json({ days, count: sessions.length, sessions, items });
  } catch (e) {
    console.error("GET /api/workouts", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/workouts
 * body: { session_date?: 'YYYY-MM-DD', note?: string, entries?: [ ... ] }
 * entries: { exercise_id?, machine_id?, minutes?, sets?, reps?, weight_kg?, distance_km?, calories?, comment? }
 */
router.post("/api/workouts", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { session_date = null, note = null, entries = [] } = req.body || {};

    // Validate entries is an array
    if (!Array.isArray(entries)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Entries must be an array" });
    }
    console.log("Adding Workut uid(sub): " + req.user.sub);

    // Insert workout session
    const insSession = await client.query(
      `INSERT INTO workout_sessions (user_id, session_date, note)
       VALUES ($1, COALESCE($2::date, (now() AT TIME ZONE 'Europe/Berlin')::date), $3)
       RETURNING id, user_id, session_date, note, created_at`,
      [req.user.sub, session_date, note]
    );
    const session = insSession.rows[0];

    // Process entries if any
    if (entries.length > 0) {
      // Clean and validate entries
      const cleanEntries = entries.map((e, index) => {
        // Basic validation
        if (!e.exercise_id) {
          throw new Error(`Entry ${index + 1}: exercise_id is required`);
        }

        return {
          exercise_id: e.exercise_id,
          machine_id: e.machine_id ?? null,
          minutes: e.minutes ?? null,
          sets: e.sets ?? null,
          reps: e.reps ?? null,
          weight_kg: e.weight_kg ?? null,
          distance_km: e.distance_km ?? null,
          calories: e.calories ?? null,
          comment: (e.comment || "").trim() || null
        };
      });

      // Build safe parameterized query
      const placeholders = [];
      const params = [session.id];
      let paramCounter = 2;

      cleanEntries.forEach(entry => {
        placeholders.push(
          `($1, $${paramCounter}, $${paramCounter + 1}, $${paramCounter + 2}, $${paramCounter + 3}, $${paramCounter + 4}, $${paramCounter + 5}, $${paramCounter + 6}, $${paramCounter + 7}, $${paramCounter + 8})`
        );
        
        params.push(
          entry.exercise_id,
          entry.machine_id,
          entry.minutes,
          entry.sets,
          entry.reps,
          entry.weight_kg,
          entry.distance_km,
          entry.calories,
          entry.comment
        );
        
        paramCounter += 9;
      });

      const insertEntriesQuery = `
        INSERT INTO workout_entries
          (session_id, exercise_id, machine_id, minutes, sets, reps, weight_kg, distance_km, calories, comment)
        VALUES ${placeholders.join(",")}
        RETURNING *
      `;

      await client.query(insertEntriesQuery, params);
    }

    await client.query("COMMIT");

    // Fetch the complete session with joined data
    const { rows: items } = await client.query(
      `SELECT 
         we.*,
         m.name AS machine_name,
         e.name AS exercise_name,
         e.category AS exercise_category,
         e.primary_muscle AS exercise_primary_muscle
       FROM workout_entries we
       LEFT JOIN machines m ON m.id = we.machine_id
       LEFT JOIN exercises e ON e.id = we.exercise_id
       WHERE we.session_id = $1
       ORDER BY we.created_at ASC`,
      [session.id]
    );

    res.status(201).json({ 
      success: true,
      session: {
        ...session,
        entry_count: items.length
      }, 
      items 
    });

  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/workouts", e);

    // Handle specific error cases
    if (e.message?.includes("exercise_id is required")) {
      return res.status(400).json({ error: e.message });
    }
    if (e.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: "Invalid exercise_id or machine_id provided" });
    }
    if (e.code === '22003') { // Numeric value out of range
      return res.status(400).json({ error: "One or more numeric values are out of acceptable range" });
    }
    if (e.code === '22008') { // Invalid datetime format
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    res.status(500).json({ 
      error: "Failed to create workout session",
      details: process.env.NODE_ENV === 'development' ? e.message : undefined
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/workout-entries
 * body: { session_id, exercise_id?, machine_id?, minutes?, sets?, reps?, weight_kg?, distance_km?, calories?, comment? }
 */
router.post("/api/workout-entries", requireAuth, async (req, res) => {
  try {
    const {
      session_id, exercise_id = null, machine_id = null,
      minutes = null, sets = null, reps = null,
      weight_kg = null, distance_km = null, calories = null,
      comment = null
    } = req.body || {};

    if (!session_id) return res.status(400).json({ error: "Missing session_id" });

    // Ownership check
    const { rows: srows } = await q(
      `SELECT 1 FROM workout_sessions WHERE id=$1 AND user_id=$2 LIMIT 1`,
      [session_id, req.user.id]
    );
    if (!srows.length) return res.status(403).json({ error: "Forbidden" });

    const { rows } = await q(
      `INSERT INTO workout_entries
        (session_id, exercise_id, machine_id, minutes, sets, reps, weight_kg, distance_km, calories, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [session_id, exercise_id, machine_id, minutes, sets, reps, weight_kg, distance_km, calories, comment]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /api/workout-entries", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;