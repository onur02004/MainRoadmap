// src/services/notifyUser.js
import { q } from "../db/pool.js";
import { sendPush } from "../helpers/sendPush.js";

export async function notifyUser(userId, title, body, extraData = {}) {
  try {
    const { rows } = await q(
      "SELECT expo_token FROM device_tokens WHERE user_id = $1",
      [userId]
    );

    for (const row of rows) {
      await sendPush(row.expo_token, title, body, extraData);
    }
  } catch (err) {
    console.error("notifyUser error:", err);
  }
}
