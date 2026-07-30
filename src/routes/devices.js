// src/routes/devices.js
import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";
import express from "express";
import path from "node:path";
import { spawn } from "node:child_process";
import { processMatrixState } from "../widgets/engine.js";
import 'dotenv/config';
import http from "node:http";

const router = Router();

/**
 * GET /api/device-kinds
 * List all defined kinds so the UI can label/filter.
 */
router.get("/api/device-kinds", requireAuth, async (_req, res) => {
    try {
        const { rows } = await q(`select key, label, is_smart from device_kinds order by label asc`);
        res.json(rows);
    } catch (err) {
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
              select d.id, d.display_name, d.kind_key, dk.label as kind_label, dk.is_smart,
                     d.status, d.last_seen, d.meta, d.created_at,
                     s.mode as state_mode, s.params as state_params, s.updated_at as state_updated_at
                from devices d
                join device_kinds dk on dk.key = d.kind_key
                left join device_state s on s.device_id = d.id
               where d.owner_user_id = $1
            ),
            caps as (
              select dc.device_id, json_agg(distinct dc.capability order by dc.capability) as capabilities
                from device_capabilities dc group by dc.device_id
            ),
            acts as (
              select da.device_id,
                     json_agg(jsonb_build_object('action', da.action, 'handlerKey', da.handler_key) order by da.action) as actions
                from device_actions da group by da.device_id
            )
            select b.*, coalesce(c.capabilities, '[]') as capabilities, coalesce(a.actions, '[]') as actions
              from base b
              left join caps c on c.device_id = b.id
              left join acts a on a.device_id = b.id;`,
            [req.user.sub]
        );
        res.json({ items: rows, count: rows.length });
    } catch (err) {
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
            `with base as (
               select d.id, d.display_name, d.kind_key, dk.label as kind_label, dk.is_smart,
                      d.status, d.last_seen, d.meta, d.created_at,
                      s.mode as state_mode, s.params as state_params, s.updated_at as state_updated_at
                 from devices d
                 join device_kinds dk on dk.key = d.kind_key
                 left join device_state s on s.device_id = d.id
                where d.owner_user_id = $1 and d.id = $2::uuid
             ),
             caps as (
               select dc.device_id, json_agg(distinct dc.capability order by dc.capability) as capabilities
                 from device_capabilities dc group by dc.device_id
             ),
             acts as (
               select da.device_id,
                      json_agg(jsonb_build_object('action', da.action, 'handlerKey', da.handler_key) order by da.action) as actions
                 from device_actions da group by da.device_id
             )
             select b.*, coalesce(c.capabilities, '[]') as capabilities, coalesce(a.actions, '[]') as actions
               from base b
               left join caps c on c.device_id = b.id
               left join acts a on a.device_id = b.id;`,
            [req.user.sub, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: "Not found" });
        res.json(rows[0]);
    } catch (err) {
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
        const kind = await q(`select 1 from device_kinds where key=$1 limit 1`, [kindKey]);
        if (!kind.rowCount) return res.status(400).json({ error: "Unknown kindKey" });

        const insert = await q(
            `insert into devices (owner_user_id, kind_key, display_name, meta)
             values ($1, $2, $3, $4::jsonb)
             returning id, owner_user_id, kind_key, display_name, status, last_seen, meta, created_at`,
            [req.user.sub, kindKey, displayName, meta]
        );
        res.status(201).json(insert.rows[0]);
    } catch (err) {
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
                    console.log("Turning on led");
                    args.push("on");
                    break;
                case "off":
                    args.push("off");
                    console.log("Turning off led");
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

            // Windows'ta 'python', Linux/Pi üzerinde 'python3' komutunu dinamik seçelim
            const pythonCommand = process.platform === "win32" ? "python" : "python3";
            const py = spawn(pythonCommand, args, { env });


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

    // Genişletilmiş ve izin verilmiş Matrix modları
    const allowed = new Set([
        "rgb", "wave", "hue", "image", "spotify_album",
        "spotify_lyrics", "weather", "calendar", "countdown", "text", "auto"
    ]);

    if (mode && !allowed.has(mode)) {
        return res.status(400).json({ error: "Invalid mode provided" });
    }

    const cur = await q(
        `select d.id, d.kind_key, s.mode as cur_mode, s.params as cur_params
           from devices d
      left join device_state s on s.device_id = d.id
          where d.id = $1::uuid and d.owner_user_id = $2`,
        [id, req.user.sub]
    );
    const row = cur.rows[0];
    if (!row) return res.status(404).json({ error: "Not found" });

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

    res.json({ ok: true, state: up.rows[0] });
});


// Memory cache for active codes: code -> { status: 'pending' | 'claimed', deviceId: null }
const activeDeviceCodes = new Map();

function generate6DigitCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * GET /api/pairing/device-code
 * Called by the unauthenticated Matrix screen on boot to get a pairing code.
 */
router.get("/api/pairing/device-code", async (req, res) => {
    let code = generate6DigitCode();
    while (activeDeviceCodes.has(code)) {
        code = generate6DigitCode();
    }
    activeDeviceCodes.set(code, { status: "pending", deviceId: null });

    // Auto-expire pairing code after 10 minutes
    setTimeout(() => activeDeviceCodes.delete(code), 10 * 60 * 1000);

    res.json({ code });
});

/**
 * GET /api/pairing/check
 * Polled by the Matrix screen to determine if the user claimed the device yet.
 */
router.get("/api/pairing/check", async (req, res) => {
    const { code } = req.query;
    if (!code || !activeDeviceCodes.has(code)) {
        return res.status(404).json({ error: "Code expired or invalid" });
    }
    const state = activeDeviceCodes.get(code);
    if (state.status === "claimed") {
        activeDeviceCodes.delete(code); // Clean up memory
        return res.json({ status: "paired", deviceId: state.deviceId });
    }
    res.json({ status: "pending" });
});

/**
 * POST /api/pairing/claim-code
 * User submits the 6-digit code from the web dashboard to claim the device.
 */
router.post("/api/pairing/claim-code", requireAuth, express.json(), async (req, res) => {
    const { code, displayName, kindKey } = req.body || {};
    if (!code || !displayName || !kindKey) {
        return res.status(400).json({ error: "Code, display name, and kind are required" });
    }

    if (!activeDeviceCodes.has(code)) {
        return res.status(400).json({ error: "Invalid or expired pairing code" });
    }

    const state = activeDeviceCodes.get(code);
    if (state.status === "claimed") {
        return res.status(400).json({ error: "Code already claimed" });
    }

    try {
        // Insert device into database mapped to user
        const insert = await q(
            `insert into devices (owner_user_id, kind_key, display_name, status, last_seen, meta)
             values ($1, $2, $3, 'online', now(), '{}'::jsonb)
             returning id`,
            [req.user.sub, kindKey, displayName]
        );
        const deviceId = insert.rows[0].id;

        // Default capabilities for this new RGB Matrix screen
        const caps = ["rgb", "wave", "brightness", "image", "spotify_album", "text"];
        for (const cap of caps) {
            await q(`insert into device_capabilities (device_id, capability) values ($1::uuid, $2)`, [deviceId, cap]);
        }

        // Add device actions
        const actions = [
            { action: "on", handler: "led_control.on" },
            { action: "off", handler: "led_control.off" },
            { action: "set_color", handler: "led_control.set_color" },
            { action: "set_brightness", handler: "led_control.set_brightness" }
        ];
        for (const act of actions) {
            await q(
                `insert into device_actions (device_id, action, handler_key)
                 values ($1::uuid, $2, $3)
                 on conflict do nothing`,
                [deviceId, act.action, act.handler]
            );
        }

        // Add initial default active mode
        await q(
            `insert into device_state (device_id, mode, params, updated_by)
             values ($1::uuid, 'rgb', '{"r":0,"g":255,"b":0,"brightness":100}'::jsonb, $2)
             on conflict do nothing`,
            [deviceId, req.user.sub]
        );

        // Inform the matrix screen polling process about the success
        state.status = "claimed";
        state.deviceId = deviceId;
        activeDeviceCodes.set(code, state);

        res.json({ ok: true, deviceId });
    } catch (err) {
        console.error("Error creating device via claim-code:", err);
        res.status(500).json({ error: "Failed to link device" });
    }
});


// Small helper uses your existing executor endpoint internally
async function callAction(deviceId, action, params) {
    console.log("Device Mode Changed to: " + action + " with param: " + params);

    // local call through DB+spawn path
    // You already have router.post("/api/device-actions/:id/:action"...)
    // Here we just re-run the same logic directly to avoid HTTP hop:
    // If you prefer, you can also fetch() your own endpoint.
    return; // if you inline execution, or leave as a no-op and let client call afterwards
}



/**
 * GET /api/hardware/matrix/:deviceId/poll
 * ESP32'nin her saniye çağıracağı "Aptal" uç nokta.
 * auth.js (requireAuth) BURADA KULLANILMAZ!
 */
router.get("/api/hardware/matrix/:deviceId/poll", async (req, res) => {
    try {
        const { deviceId } = req.params;

        // 1. Cihazın mevcut durumunu (mode) çek
        const stateRes = await q(
            `SELECT mode FROM device_state WHERE device_id = $1::uuid`,
            [deviceId]
        );
        
        if (!stateRes.rows[0]) {
            return res.send("TXT|#FF0000|Eslenmedi");
        }
        
        const activeMode = stateRes.rows[0].mode; // Örn: 'simple_clock'

        // 2. Aktif modun özel ayarlarını çek
        const configRes = await q(
            `SELECT config FROM device_widget_configs 
             WHERE device_id = $1::uuid AND widget_key = $2`,
            [deviceId, activeMode]
        );
        
        const config = configRes.rows[0] ? configRes.rows[0].config : {};

        // 3. Ortak verileri topla (Eğer Lyrics modundaysa Spotify datası çekilebilir)
        const sharedData = {
            // İleride Spotify veya hava durumu verileri buraya eklenecek
        };

        // 4. Widget Engine'e gönder ve String komutu al
        const esp32Command = await processMatrixState(activeMode, config, sharedData);

        // 5. Saf metin (text/plain) olarak ESP32'ye yolla
        res.set('Content-Type', 'text/plain');
        res.send(esp32Command);

    } catch (error) {
        console.error("Matrix Poll Hatası:", error);
        res.send("TXT|#FF0000|Sunucu Hatasi");
    }
});


const deviceCooldowns = new Map();
const COOLDOWN_MS = 500; // İstekler arası en az 500ms olmalı (İsteğe göre değiştirebilirsin)

/**
 * POST /api/secret/led-control
 * C# veya Postman üzerinden doğrudan LED kontrolü için gizli endpoint.
 * Body örneği: 
 * {
 *   "apiKey": "SÜPER_GİZLİ_KEY_123",
 *   "deviceId": "UUID-BURAYA",
 *   "action": "toggle", // "on", "off", "toggle", "set_color", "set_brightness"
 *   "params": { "r": 255, "g": 0, "b": 0, "value": 100 }
 * }
 */
router.post("/api/secret/led-control", express.json(), async (req, res) => {
    try {
        const { apiKey, deviceId, action, params = {} } = req.body || {};

        // 1. GÜVENLİK KONTROLÜ (API Key)
        // Buradaki KEY'i .env dosyandan çekebilirsin (process.env.SECRET_LED_API_KEY)
        const SECRET_KEY = process.env.LED_API_KEY;
        if (!apiKey || apiKey !== SECRET_KEY) {
            return res.status(401).json({ error: "Unauthorized: Geçersiz API Key" });
        }

        if (!deviceId) {
            return res.status(400).json({ error: "deviceId gereklidir." });
        }

        // 2. RATE LIMIT / COOLDOWN KONTROLÜ (IO Kilitlenmesini Önleme)
        const now = Date.now();
        const lastCall = deviceCooldowns.get(deviceId) || 0;

        if (now - lastCall < COOLDOWN_MS) {
            const waitTime = COOLDOWN_MS - (now - lastCall);
            return res.status(429).json({ 
                error: "Too Many Requests: Sistem aşırı yüklenmesini önlemek için cooldown aktif.", 
                retryAfterMs: waitTime 
            });
        }
        
        // Son istek zamanını güncelle
        deviceCooldowns.set(deviceId, now);

        // 3. CİHAZ VE MEVCUT DURUMU ÇEK
        const devRes = await q(
            `SELECT d.id, d.meta, s.mode, s.params 
               FROM devices d 
          LEFT JOIN device_state s ON s.device_id = d.id 
              WHERE d.id = $1::uuid`,
            [deviceId]
        );

        if (!devRes.rows[0]) {
            return res.status(404).json({ error: "Cihaz bulunamadı." });
        }

        const device = devRes.rows[0];
        let targetAction = action;

        // 4. ESNEK DURUM YÖNETİMİ (Eğer action boşsa veya toggle ise)
        if (!targetAction || targetAction === "toggle") {
            // Mevcut duruma bak; eğer açıksa kapat, kapalıysa aç
            const currentPower = device.params?.power;
            targetAction = (currentPower === "off") ? "on" : "off";
        }

        // 5. PYTHON SCRIPT ÇAĞRISI (led_control.py)
        const scriptPath = path.join(process.cwd(), "/src/led_control.py");
        let args = [scriptPath];

        switch (targetAction) {
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
                args.push("set_brightness", String(value));
                break;
            }
            default:
                return res.status(400).json({ error: `Desteklenmeyen action: ${targetAction}` });
        }

        // Python çalıştırma ortamı
        const env = { ...process.env };
        if (device.meta?.pin) env.LED_PIN = device.meta.pin;
        if (device.meta?.pixels) env.LED_PIXELS = String(device.meta.pixels);

        const pythonCommand = process.platform === "win32" ? "python" : "python3";
        const py = spawn(pythonCommand, args, { env });

        let out = "", err = "";
        py.stdout.on("data", (d) => (out += d.toString()));
        py.stderr.on("data", (d) => (err += d.toString()));

        py.on("close", async (code) => {
            if (code !== 0) {
                return res.status(500).json({ error: "Script hatası", stderr: err.trim() });
            }

            // DB Durumunu Güncelle
            const newPowerState = targetAction === "off" ? "off" : "on";
            const updatedParams = { 
                ...(device.params || {}), 
                ...params, 
                power: newPowerState 
            };

            await q(
                `INSERT INTO device_state (device_id, mode, params, updated_at)
                 VALUES ($1::uuid, 'rgb', $2::jsonb, now())
                 ON CONFLICT (device_id) DO UPDATE
                 SET params = $2::jsonb, updated_at = now()`,
                [deviceId, JSON.stringify(updatedParams)]
            );

            await q(`UPDATE devices SET last_seen = now(), status = 'online' WHERE id = $1::uuid`, [deviceId]);

            return res.json({ 
                ok: true, 
                executedAction: targetAction, 
                state: updatedParams,
                stdout: out.trim() 
            });
        });

    } catch (e) {
        console.error("Secret LED endpoint error:", e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});















// --- KAMERA YÖNETİMİ İÇİN DEĞİŞKENLER ---
const ALLOWED_USER_ID = "7f5c358d-f973-4b15-8998-2fcf5eae128c"; // prod ID
//const ALLOWED_USER_ID = "5efaab86-0a88-4fa0-adf0-23197bf040bf"; // local ID

let ustreamerProcess = null;
let activeWatchers = 0;
let stopTimer = null;
let ustreamerLogs = []; // Son 50 log satırını bellekte tutar

// --- İKİLİ KAMERA YÖNETİMİ ---

const CAMERAS = {
    1: { device: "/dev/video0", port: 8080, format: "MJPEG", res: "1280x720", process: null, watchers: 0, stopTimer: null },
    2: { device: "/dev/video2", port: 8081, format: "MJPEG", res: "640x480", process: null, watchers: 0, stopTimer: null } // /dev/video2 olarak güncellendi!
};


function logToBuffer(data) {
    const lines = data.toString().split("\n");
    for (const line of lines) {
        if (line.trim()) {
            ustreamerLogs.push(`[${new Date().toLocaleTimeString()}] ${line.trim()}`);
            if (ustreamerLogs.length > 50) ustreamerLogs.shift();
        }
    }
}

function startUstreamerForCam(camId) {
    const cam = CAMERAS[camId];
    if (!cam || cam.process) return;

    console.log(`[Kamera ${camId}] ustreamer başlatılıyor (Port: ${cam.port}, Cihaz: ${cam.device})...`);
    ustreamerLogs.push(`[${new Date().toLocaleTimeString()}] Kamera ${camId} (${cam.device}) başlatılıyor...`);

    const args = [
        "--host=127.0.0.1",
        `--port=${cam.port}`,
        `--device=${cam.device}`,
        `--format=${cam.format}`,
        `--resolution=${cam.res}`,
        "--desired-fps=30"
    ];

    const proc = spawn("ustreamer", args);

    proc.on("error", (err) => {
        console.error(`[Kamera ${camId}] ustreamer hatası:`, err.message);
        ustreamerLogs.push(`[${new Date().toLocaleTimeString()}] HATA: Kamera ${camId} (${err.code})`);
        cam.process = null;
    });

    proc.stdout.on("data", logToBuffer);
    proc.stderr.on("data", logToBuffer);

    proc.on("close", (code) => {
        console.log(`[Kamera ${camId}] ustreamer kapandı (Kod: ${code})`);
        ustreamerLogs.push(`[${new Date().toLocaleTimeString()}] Kamera ${camId} kapandı (Kod: ${code})`);
        cam.process = null;
    });

    cam.process = proc;
}

function stopUstreamerForCam(camId) {
    const cam = CAMERAS[camId];
    if (cam && cam.process) {
        console.log(`[Kamera ${camId}] İzleyici kalmadı, kapatılıyor...`);
        cam.process.kill("SIGTERM");
        cam.process = null;
    }
}

// --- ROTALAR ---

/**
 * GET /odam/stream/:camId
 * İstene kamera ID'sine (1 veya 2) göre ustreamer başlatır ve proxy akışı sağlar.
 */
router.get("/odam/stream/:camId", requireAuth, (req, res) => {
    const currentUserId = req.user?.sub || req.user?.id;
    if (currentUserId !== ALLOWED_USER_ID) {
        return res.status(403).json({ error: "Erişim yetkiniz yok." });
    }

    const camId = req.params.camId || "1";
    const cam = CAMERAS[camId];

    if (!cam) {
        return res.status(404).send("Tanımsız kamera.");
    }

    if (cam.stopTimer) {
        clearTimeout(cam.stopTimer);
        cam.stopTimer = null;
    }

    cam.watchers++;
    startUstreamerForCam(camId);

    setTimeout(() => {
        const proxyReq = http.request(
            {
                host: "127.0.0.1",
                port: cam.port,
                path: "/stream",
                method: "GET",
                headers: { 'Connection': 'keep-alive' }
            },
            (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res, { end: true });
            }
        );

        proxyReq.on("error", (err) => {
            console.error(`Kamera ${camId} proxy hatası:`, err);
            if (!res.headersSent) {
                res.status(502).send("Kamera yayını aktif değil.");
            }
        });

        req.on("close", () => {
            proxyReq.destroy();
            cam.watchers = Math.max(0, cam.watchers - 1);

            if (cam.watchers === 0) {
                cam.stopTimer = setTimeout(() => {
                    stopUstreamerForCam(camId);
                }, 5000);
            }
        });

        proxyReq.end();
    }, 500);
});

/**
 * GET /odam/logs
 */
router.get("/odam/logs", requireAuth, (req, res) => {
    const currentUserId = req.user?.sub || req.user?.id;
    if (currentUserId !== ALLOWED_USER_ID) {
        return res.status(403).json({ error: "Erişim yetkiniz yok." });
    }

    const isAnyActive = Object.values(CAMERAS).some(c => c.process !== null);
    const totalWatchers = Object.values(CAMERAS).reduce((acc, c) => acc + c.watchers, 0);

    res.json({
        active: isAnyActive,
        watchers: totalWatchers,
        logs: ustreamerLogs
    });
});




// --- ODA & KAMERA ROTALARI ---

/**
 * 1. GET /odam
 * Odaya özel HTML sayfasını sunar.
 */
router.get("/odam", requireAuth, (req, res) => {
    const currentUserId = req.user?.sub || req.user?.id;

    if (currentUserId !== ALLOWED_USER_ID) {
        return res.status(403).json({ error: "Bu odaya erişim yetkiniz bulunmamaktadır." });
    }

    const filePath = path.join(process.cwd(), "src", "public", "features", "odam.html");
    
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error("odam.html gönderilirken hata oluştu:", err);
            res.status(500).send("Sayfa yüklenirken bir hata oluştu.");
        }
    });
});

/**
 * 2. GET /odam/stream
 * İstek atıldığında ustreamer'ı otomatik başlatır, izleyici ayrıldığında 5sn sonra kapatır.
 */
router.get("/odam/stream", requireAuth, (req, res) => {
    const currentUserId = req.user?.sub || req.user?.id;

    if (currentUserId !== ALLOWED_USER_ID) {
        return res.status(403).json({ error: "Erişim yetkiniz yok." });
    }

    // Aktif durdurma zamanlayıcısı varsa iptal et
    if (stopTimer) {
        clearTimeout(stopTimer);
        stopTimer = null;
    }

    activeWatchers++;
    startUstreamer();

    // Process'in ayağa kalkması için 500ms tolerans verip akışı başlatıyoruz
    setTimeout(() => {
        const proxyReq = http.request(
            {
                host: "127.0.0.1",
                port: 8080,
                path: "/stream",
                method: "GET",
                headers: {
                    'Connection': 'keep-alive'
                }
            },
            (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res, { end: true });
            }
        );

        proxyReq.on("error", (err) => {
            console.error("Kamera akışı local proxy hatası:", err);
            if (!res.headersSent) {
                res.status(502).send("Kamera yayını şu an aktif değil.");
            }
        });

        req.on("close", () => {
            proxyReq.destroy();
            activeWatchers = Math.max(0, activeWatchers - 1);

            // Kimse kalmadıysa 5 saniye sonra kamerayı kapat
            if (activeWatchers === 0) {
                stopTimer = setTimeout(() => {
                    stopUstreamer();
                }, 5000);
            }
        });

        proxyReq.end();
    }, 500);
});

/**
 * GET /odam/stream/:camId
 * İstene kamera ID'sine (1 veya 2) göre ustreamer başlatır ve proxy akışı sağlar.
 */
router.get("/odam/stream/:camId", requireAuth, (req, res) => {
    const currentUserId = req.user?.sub || req.user?.id;
    if (currentUserId !== ALLOWED_USER_ID) {
        return res.status(403).json({ error: "Erişim yetkiniz yok." });
    }

    const camId = req.params.camId || "1";
    const cam = CAMERAS[camId];

    if (!cam) {
        return res.status(404).send("Tanımsız kamera.");
    }

    if (cam.stopTimer) {
        clearTimeout(cam.stopTimer);
        cam.stopTimer = null;
    }

    cam.watchers++;
    startUstreamerForCam(camId);

    setTimeout(() => {
        const proxyReq = http.request(
            {
                host: "127.0.0.1",
                port: cam.port,
                path: "/stream",
                method: "GET",
                headers: { 'Connection': 'keep-alive' }
            },
            (proxyRes) => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res, { end: true });
            }
        );

        proxyReq.on("error", (err) => {
            console.error(`Kamera ${camId} proxy hatası:`, err);
            if (!res.headersSent) {
                res.status(502).send("Kamera yayını aktif değil.");
            }
        });

        req.on("close", () => {
            proxyReq.destroy();
            cam.watchers = Math.max(0, cam.watchers - 1);

            if (cam.watchers === 0) {
                cam.stopTimer = setTimeout(() => {
                    stopUstreamerForCam(camId);
                }, 5000);
            }
        });

        proxyReq.end();
    }, 500);
});

/**
 * GET /odam/logs
 */
router.get("/odam/logs", requireAuth, (req, res) => {
    const currentUserId = req.user?.sub || req.user?.id;
    if (currentUserId !== ALLOWED_USER_ID) {
        return res.status(403).json({ error: "Erişim yetkiniz yok." });
    }

    const isAnyActive = Object.values(CAMERAS).some(c => c.process !== null);
    const totalWatchers = Object.values(CAMERAS).reduce((acc, c) => acc + c.watchers, 0);

    res.json({
        active: isAnyActive,
        watchers: totalWatchers,
        logs: ustreamerLogs
    });
});


export default router;
