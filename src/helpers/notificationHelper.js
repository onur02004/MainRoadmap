import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";          // make sure this path matches your project
import { Expo } from "expo-server-sdk";
import { NotificationType } from "../constants/notificationTypes.js";
import { sendPush } from "./sendPush.js";
import { sendEmail } from "../helpers/emailHelper.js";

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

export async function notifyUserByTypeOLD({ userId, type, title, body, data = {}, imageUrl = null }) {
  // DEBUG LOG 1: See if the function is even called
  console.log(`[DEBUG] notifyUserByType triggered for User: ${userId}, Type: ${type}`);

  // 1. SAVE TO DATABASE
  await q(
    `INSERT INTO notification_events (user_id, type, channel, payload)
     VALUES ($1, $2, $3, $4)`,
    [userId, type, 'push', JSON.stringify({ title, body, imageUrl, ...data })]
  );

  // 2. TOKEN LOOKUP
  const { rows: tokenRows } = await q(
    "SELECT expo_token FROM device_tokens WHERE user_id = $1",
    [userId]
  );

  // DEBUG LOG 2: Check if tokens were actually found
  console.log(`[DEBUG] Found ${tokenRows.length} tokens for user ${userId}`);

  if (tokenRows.length === 0) return;

  for (const row of tokenRows) {
    // THIS IS THE OUTPUT YOU ARE LOOKING FOR
    console.log("Notifying user: " + title + " - " + body); 
    await sendPush(row.expo_token, title, body, { ...data, type }, imageUrl);
  }
}


function isNotificationAllowedOLD(settings, type, channel) {
  if (channel === "push") {
    if (!settings.push_enabled) return false;

    switch (type) {
      // Use the exported constants instead of hardcoded strings
      case NotificationType.LOGIN:
        return settings.push_login;
      case NotificationType.PUBLIC_SHARE:
        return settings.push_public_share;
      case NotificationType.DIRECT_SHARE:
        return settings.push_direct_share;
      case NotificationType.REACTION: // Changed from NotificationType.POST_REACTION
        return settings.push_post_reaction;
      case NotificationType.COMMENT: // Changed from NotificationType.POST_COMMENT
        return settings.push_post_comment;
      case NotificationType.PLAY_EVENT: // Changed from NotificationType.SONG_PLAYED
        return settings.push_song_played;
      default:
        return false;
    }
  }
  return false;
}


async function canSendNotification(userId, type, channel) {
  const systemMasterKey = channel === 'email' ? 'email_system_master' : 'push_system_master';
  
  try {
    // 1. Check Global Admin Kill-Switches
    const { rows: globalRows } = await q(
      `SELECT feature_key, is_enabled FROM global_notification_controls 
       WHERE feature_key IN ($1, $2)`, 
      [systemMasterKey, type]
    );

    const globalStatus = globalRows.reduce((acc, row) => {
      acc[row.feature_key] = row.is_enabled;
      return acc;
    }, {});

    if (globalStatus[systemMasterKey] === false) return false; // Entire system off
    if (globalStatus[type] === false) return false; // Specific category off

    // 2. Check User Preference
    const { rows: userSettings } = await q(
      `SELECT push_enabled, email_enabled, ${type} 
       FROM user_notification_settings WHERE user_id = $1`,
      [userId]
    );

    if (userSettings.length === 0) return true; // Default to allow if no row exists

    const settings = userSettings[0];
    const channelEnabled = channel === 'email' ? settings.email_enabled : settings.push_enabled;
    
    return channelEnabled && settings[type] === true;

  } catch (err) {
    console.error("Permission check failed:", err);
    return false;
  }
}


export async function notifyUserByType({ userId, type, title, body, data = {}, imageUrl = null }) {
  // Check Push Permission
  if (await canSendNotification(userId, `push_${type}`, 'push')) {
    const { rows: tokens } = await q("SELECT expo_token FROM device_tokens WHERE user_id = $1", [userId]);
    for (const row of tokens) {
      await sendPush(row.expo_token, title, body, { ...data, type }, imageUrl);
    }
  }

  // Check Email Permission (If you want to send emails too)
  if (await canSendNotification(userId, `email_${type}`, 'email')) {
     const { rows: users } = await q("SELECT email FROM users WHERE id = $1 AND email_verified = true", [userId]);
     if (users[0]?.email) {
       await sendEmail(users[0].email, title, `<h3>${title}</h3><p>${body}</p>`);
     }
  }
}

export default router;
