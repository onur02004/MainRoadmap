import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";          // make sure this path matches your project
import { Expo } from "expo-server-sdk";

const expo = new Expo();
const router = Router();

router.post("/api/register-device", requireAuth, async (req, res) => {
  try {
    console.log("Registering Device Token For Notifications");
    const { expoToken, platform } = req.body;

    if (!expoToken || !platform) {
      return res.status(400).json({ error: "expoToken and platform required" });
    }

    if (!Expo.isExpoPushToken(expoToken)) {
      return res.status(400).json({ error: "Invalid Expo push token" });
    }

    const userId = req.user.sub; // this is UUID from your users table

    await q(
      `
      INSERT INTO device_tokens (user_id, expo_token, platform)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, expo_token)
      DO UPDATE SET last_seen = NOW(), platform = EXCLUDED.platform
      `,
      [userId, expoToken, platform]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("register-device error:", err);
    res.status(500).json({ error: "internal error" });
  }
});

export default router;
