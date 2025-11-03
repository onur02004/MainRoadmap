// src/routes/devices.js
import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";
import express from "express";
import path from "node:path";
import { spawn } from "node:child_process";

const router = Router();

/**
 * GET /api/device-kinds
 * List all defined kinds so the UI can label/filter.
 */
router.get("/api/device-kinds", requireAuth, async (_req, res) => {
    try {
        const { rows } = await q(
            `select key, label, is_smart
         from device_kinds
        order by label asc`
        );
        res.json(rows);
    } catch (err) {
        console.error("GET /api/device-kinds failed:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * GET /api/devices
 * Return ONLY the caller's devices, with capabilities & actions embedded.
 * This is shaped for easy rendering (like your features grid).
 */
router.get("/api/devices", requireAuth, async (req, res) => {
    try {
        const { rows } = await q(
            `with base as (
  select d.id,
         d.display_name,
         d.kind_key,
         dk.label as kind_label,
         dk.is_smart,
         d.status,
         d.last_seen,
         d.meta,
         d.created_at,
         s.mode       as state_mode,
         s.params     as state_params,
         s.updated_at as state_updated_at
    from devices d
    join device_kinds dk on dk.key = d.kind_key
    left join device_state s on s.device_id = d.id
   where d.owner_user_id = $1
),
caps as (
  select dc.device_id,
         json_agg(distinct dc.capability order by dc.capability) as capabilities
    from device_capabilities dc
   group by dc.device_id
),
acts as (
  select da.device_id,
         json_agg(
           jsonb_build_object(
             'action', da.action,
             'handlerKey', da.handler_key,
             'paramSchema', coalesce(da.param_schema, '{}'::jsonb)
           ) order by da.action
         ) as actions
    from device_actions da
   group by da.device_id
)
select b.*,
       coalesce(c.capabilities, '[]') as capabilities,
       coalesce(a.actions, '[]')      as actions
  from base b
  left join caps c on c.device_id = b.id
  left join acts a on a.device_id = b.id;

      `,
            [req.user.sub]
        );

        res.json({ items: rows, count: rows.length });
    } catch (err) {
        console.error("GET /api/devices failed:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * GET /api/devices/:id
 * Fetch a single device ONLY if it belongs to the caller.
 */
router.get("/api/devices/:id", requireAuth, async (req, res) => {
    try {
        const { rows } = await q(
            `
       with base as (
   select d.id,
          d.display_name,
          d.kind_key,
          dk.label as kind_label,
          dk.is_smart,
          d.status,
          d.last_seen,
          d.meta,
          d.created_at,
         s.mode as state_mode,
         s.params as state_params,
         s.updated_at as state_updated_at
     from devices d
     join device_kinds dk on dk.key = d.kind_key
    left join device_state s on s.device_id = d.id
    where d.owner_user_id = $1
     and d.id = $2::uuid
 ),
      caps as (
        select dc.device_id,
               json_agg(distinct dc.capability order by dc.capability) as capabilities
          from device_capabilities dc
         group by dc.device_id
      ),
      acts as (
        select da.device_id,
               json_agg(
                 jsonb_build_object(
                   'action', da.action,
                   'handlerKey', da.handler_key,
                   'paramSchema', coalesce(da.param_schema, '{}'::jsonb)
                 ) order by da.action
               ) as actions
          from device_actions da
         group by da.device_id
      )
      select b.*,
             coalesce(c.capabilities, '[]') as capabilities,
             coalesce(a.actions, '[]')      as actions
        from base b
        left join caps c on c.device_id = b.id
        left join acts a on a.device_id = b.id
      `,
            [req.user.sub, req.params.id]
        );

        const row = rows[0];
        if (!row) return res.status(404).json({ error: "Not found" });
        res.json(row);
    } catch (err) {
        console.error("GET /api/devices/:id failed:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * POST /api/devices
 * Create a device you manage manually (e.g., Pi/Arduino). Smart devices can
 * still be created here if you want to pre-provision them.
 * Body: { kindKey, displayName, meta }
 */
router.post("/api/devices", requireAuth, async (req, res) => {
    try {
        const { kindKey, displayName, meta = {} } = req.body || {};
        if (!kindKey || !displayName) {
            return res.status(400).json({ error: "kindKey and displayName are required" });
        }

        // Validate kind exists
        const kind = await q(`select 1 from device_kinds where key=$1 limit 1`, [kindKey]);
        if (!kind.rowCount) return res.status(400).json({ error: "Unknown kindKey" });

        const insert = await q(
            `
      insert into devices (owner_user_id, kind_key, display_name, meta)
      values ($1, $2, $3, $4::jsonb)
      returning id, owner_user_id, kind_key, display_name, status, last_seen, meta, created_at
      `,
            [req.user.sub, kindKey, displayName, meta]
        );

        res.status(201).json(insert.rows[0]);
    } catch (err) {
        console.error("POST /api/devices failed:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * POST /api/pairing-codes
 * Generate a 6-digit pairing code for one of *your* devices (good for smart agents).
 * Body: { deviceId, ttlSeconds? }
 */
router.post("/api/pairing-codes", requireAuth, async (req, res) => {
    try {
        const { deviceId, ttlSeconds = 600 } = req.body || {};
        if (!deviceId) return res.status(400).json({ error: "deviceId required" });

        // Check ownership
        const { rowCount } = await q(
            `select 1 from devices where id=$1::uuid and owner_user_id=$2`,
            [deviceId, req.user.sub]
        );
        if (!rowCount) return res.status(403).json({ error: "Forbidden" });

        // simple 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        const ins = await q(
            `
      insert into pairing_codes (code, device_id, expires_at)
      values ($1, $2::uuid, now() + ($3 || ' seconds')::interval)
      returning code, device_id, expires_at, used
      `,
            [code, deviceId, Number(ttlSeconds)]
        );

        res.status(201).json(ins.rows[0]);
    } catch (err) {
        console.error("POST /api/pairing-codes failed:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * POST /api/pairing/claim
 * Device/agent presents { code } to finalize pairing.
 * We mark the code used. (Ownership is already tied via the device row.)
 */
router.post("/api/pairing/claim", async (req, res) => {
    try {
        const { code } = req.body || {};
        if (!code) return res.status(400).json({ error: "code required" });

        const up = await q(
            `
      update pairing_codes pc
         set used = true
       where pc.code = $1
         and used = false
         and now() < pc.expires_at
      returning device_id, expires_at
      `,
            [code]
        );

        if (!up.rowCount) {
            return res.status(400).json({ error: "Invalid or expired code" });
        }

        res.json({ ok: true, deviceId: up.rows[0].device_id });
    } catch (err) {
        console.error("POST /api/pairing/claim failed:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


router.post("/api/device-actions/:id/:action", requireAuth, express.json(), async (req, res) => {
    const { id, action } = req.params;
    const params = req.body?.params || {};

    try {
        // 1) Check device belongs to user + load action + handler
        const { rows } = await q(
            `
      select d.id, d.owner_user_id, d.kind_key, d.meta,
             da.action, da.handler_key
        from devices d
        join device_actions da on da.device_id = d.id
       where d.id = $1::uuid
         and d.owner_user_id = $2
         and da.action = $3
       limit 1
      `,
            [id, req.user.sub, action]
        );

        const row = rows[0];
        if (!row) return res.status(404).json({ error: "Device or action not found" });

        // 2) Dispatch by handler_key prefix
        const handler = row.handler_key || "";
        if (handler.startsWith("led_control")) {
            // Map actions to python args
            // led_control.py should support: on/off, set_color r g b, set_brightness value
            const scriptPath = path.join(process.cwd(), "/src/led_control.py"); // adjust if needed
            let args = [scriptPath];
            console.log("Action receiver python path: " + scriptPath);

            console.log("Action Received: " + action + " from: " + req.user.sub);

            switch (action) {
                case "on":
                    args.push("on");
                    break;
                case "off":
                    args.push("off");
                    break;
                case "set_color": {
                    const { r = 255, g = 255, b = 255 } = params;
                    args.push("set_color", String(r), String(g), String(b));
                    break;
                }
                case "set_brightness": {
                    const { value = 128 } = params;
                    console.log("Setting brightness: " + value);
                    args.push("set_brightness", String(value));
                    break;
                }
                case "wave": {
                    //belki dalga hizi???
                    // value exception verebilir
                    console.log("Setting wave");
                    args.push("wave", String(value));
                } case "hue": {
                    return res.status(400).json({ error: "Hue coming soon" });
                }
                default:
                    return res.status(400).json({ error: "Unsupported LED action" });
            }



            //ASAGISI PYTHON A BAGLANIS
            // Optionally pass meta (e.g., pin or pixels) via env
            const env = { ...process.env };
            if (row.meta?.pin) env.LED_PIN = row.meta.pin;
            if (row.meta?.pixels) env.LED_PIXELS = String(row.meta.pixels);

            const py = spawn("python3", args, { env });


            let out = "", err = "";
            py.stdout.on("data", (d) => (out += d.toString()));
            py.stderr.on("data", (d) => (err += d.toString()));
            py.on("close", async (code) => {
                // Update last_seen / status heuristic
                q(`update devices set last_seen = now(), status = 'online' where id=$1::uuid`, [id]).catch(() => { });

                // Update current state heuristically based on action
                try {
                    if (action === "on") {
                        await q(`update device_state set updated_at=now() where device_id=$1::uuid`, [id]);
                    } else if (action === "off") {
                        //-- nothing; you may add a "power": "off" flag inside params if you like
                    } else if (action === "set_color") {
                        const { r = 255, g = 255, b = 255 } = params;
                        await q(`
             insert into device_state (device_id, mode, params)
                values ($1::uuid,'rgb',jsonb_build_object('r',$2,'g',$3,'b',$4))
             on conflict (device_id) do update
                   set mode='rgb',
                       params = coalesce(device_state.params,'{}'::jsonb) || jsonb_build_object('r',$2,'g',$3,'b',$4),
                       updated_at = now()`,
                            [id, r, g, b]
                        );
                    } else if (action === "set_brightness") {
                        const { value = 128 } = params;
                        await q(`
             insert into device_state (device_id, mode, params)
                values ($1::uuid,'rgb',jsonb_build_object('brightness',$2))
             on conflict (device_id) do update
                   set params = coalesce(device_state.params,'{}'::jsonb) || jsonb_build_object('brightness',$2),
                       updated_at = now()`,
                            [id, value]
                        );
                    } else if (action === "wave") {
                        const { speed = 0.5 } = params;
                        await q(`
             insert into device_state (device_id, mode, params)
                values ($1::uuid,'wave',jsonb_build_object('speed',$2))
             on conflict (device_id) do update
                   set mode='wave',
                       params = coalesce(device_state.params,'{}'::jsonb) || jsonb_build_object('speed',$2),
                       updated_at = now()`,
                            [id, speed]
                        );
                    }
                } catch (_) { }

                
                if (code === 0) return res.json({ ok: true, stdout: out.trim() });
                return res.status(500).json({ error: "Handler failed", code, stderr: err.trim(), stdout: out.trim() });


            });

            return; // we’ll respond in the close() handler
        }

        // Fallback for other handlers (stub)
        // You can add: vibrate/notify/open_url/read/write here later.
        return res.status(400).json({ error: `No executor for handler "${handler}" yet` });
    } catch (e) {
        console.error("POST /api/device-actions error:", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Get current state (ownership enforced)
router.get("/api/devices/:id/state", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { rows } = await q(
        `select s.mode, s.params, s.updated_at
       from device_state s
       join devices d on d.id = s.device_id
      where s.device_id = $1::uuid
        and d.owner_user_id = $2`,
        [id, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
});

// Update state (and optionally execute)
router.patch("/api/devices/:id/state", requireAuth, express.json(), async (req, res) => {
    const { id } = req.params;
    const { mode, params = {}, execute = true } = req.body || {};

    // soft-validate mode
    const allowed = new Set(["rgb", "wave", "hue"]);
    if (mode && !allowed.has(mode)) return res.status(400).json({ error: "Invalid mode" });

    // Ownership + current state
    const cur = await q(
        `select d.id, d.kind_key,
            s.mode as cur_mode, s.params as cur_params
       from devices d
  left join device_state s on s.device_id = d.id
      where d.id = $1::uuid and d.owner_user_id = $2`,
        [id, req.user.sub]
    );
    const row = cur.rows[0];
    if (!row) return res.status(404).json({ error: "Not found" });

    // Merge params; if no row in state, insert; else update
    const nextMode = mode || row.cur_mode || "rgb";
    const nextParams = { ...(row.cur_params || {}), ...(params || {}) };

    const up = await q(
        `insert into device_state (device_id, mode, params, updated_by)
         values ($1::uuid, $2, $3::jsonb, $4)
      on conflict (device_id) do update
            set mode=$2, params=$3::jsonb, updated_at=now(), updated_by=$4
      returning mode, params, updated_at`,
        [id, nextMode, nextParams, req.user.sub]
    );

    // Optional history
    await q(
        `insert into device_state_history (device_id, prev_mode, next_mode, prev_params, next_params, changed_by)
     values ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [id, row.cur_mode, nextMode, row.cur_params, nextParams, req.user.sub]
    ).catch(() => { }); // best-effort

    // Optionally execute the new state right away
    if (!execute) return res.json({ ok: true, state: up.rows[0] });

    // Map mode -> action calls (so state change actually drives the device)
    try {
        if (nextMode === "rgb") {
            const { r = 255, g = 255, b = 255, brightness } = nextParams;
            // set brightness first if provided
            if (Number.isFinite(brightness)) {
                await callAction(id, "set_brightness", { value: Number(brightness) });
            }
            await callAction(id, "set_color", { r, g, b });
        } else if (nextMode === "wave") {
            const { speed = 0.5, brightness } = nextParams;
            if (Number.isFinite(brightness)) {
                await callAction(id, "set_brightness", { value: Number(brightness) });
            }
            await callAction(id, "wave", { speed });
        } else if (nextMode === "hue") {
            // Placeholder until you implement hue
            return res.status(400).json({ error: "Hue not implemented yet" });
        }
        return res.json({ ok: true, state: up.rows[0] });
    } catch (e) {
        return res.status(500).json({ error: "Apply failed", detail: e.message });
    }
});

// Small helper uses your existing executor endpoint internally
async function callAction(deviceId, action, params) {
    // local call through DB+spawn path
    // You already have router.post("/api/device-actions/:id/:action"...)
    // Here we just re-run the same logic directly to avoid HTTP hop:
    // If you prefer, you can also fetch() your own endpoint.
    return; // if you inline execution, or leave as a no-op and let client call afterwards
}


export default router;
