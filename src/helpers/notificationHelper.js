import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";          // make sure this path matches your project
import { Expo } from "expo-server-sdk";
import { NotificationType } from "../constants/notificationTypes.js";
import { sendPush } from "./sendPush.js";

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

    const userId = req.user.sub;

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

export async function notifyUserByType({
  userId,
  type,
  title,
  body,
  data = {},
  imageUrl = null,
}) {
  // 1. Load notification settings
  const { rows: settingsRows } = await q(
    "SELECT * FROM user_notification_settings WHERE user_id = $1",
    [userId]
  );
  if (settingsRows.length === 0) return;
  const settings = settingsRows[0];

  // 2. SAVE TO DATABASE (Web Infrastructure)
  // This makes the notification available for the website even if push is disabled
  await q(
    `INSERT INTO notification_events (user_id, type, channel, payload)
   VALUES ($1, $2, $3, $4)`,
    [
      userId,
      type,
      'push',
      JSON.stringify({ title, body, imageUrl, ...data }) // This goes into 'payload'
    ]
  );

  // 3. Check if PUSH is allowed and send to mobile
  if (isNotificationAllowed(settings, type, "push")) {
    const { rows: tokenRows } = await q(
      "SELECT expo_token FROM device_tokens WHERE user_id = $1",
      [userId]
    );
    for (const row of tokenRows) {
      console.log("Notifying user: " + title + "-" +  body);
      await sendPush(row.expo_token, title, body, { ...data, type }, imageUrl);
    }
  }
}

function isNotificationAllowed(settings, type, channel) {
  if (channel === "push") {
    if (!settings.push_enabled) return false;

    switch (type) {
      case NotificationType.LOGIN:
        return settings.push_login;
      case NotificationType.PUBLIC_SHARE:
        return settings.push_public_share;
      case NotificationType.DIRECT_SHARE:
        return settings.push_direct_share;
      case NotificationType.POST_COMMENT:
        return settings.push_post_comment;
      case NotificationType.POST_REACTION:
        return settings.push_post_reaction;
      case NotificationType.SONG_PLAYED:
        return settings.push_song_played;
      default:
        return false;
    }
  }

  return false;
}

export default router;
