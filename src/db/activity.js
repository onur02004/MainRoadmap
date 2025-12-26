import { q } from "./pool.js";

/**
 * Logs user interaction to the user_activity table.
 * @param {string} userId - The UUID of the user.
 * @param {string} activityType - Short code for the activity (e.g., 'LOGIN', 'ACCESS', 'VIP_FEATURE').
 * @param {object} req - The Express request object.
 */
export async function logUserActivity(userId, activityType, req) {
  try {
    if (!userId) return;

    const sql = `
      INSERT INTO user_activity 
      (user_id, activity_type, page_path, http_method, endpoint, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;


    const pagePath = req.path; // e.g., "/account"
    const httpMethod = req.method; // "GET", "POST"
    const endpoint = req.originalUrl || req.url; // e.g., "/account?details=true"
    const userAgent = req.get('User-Agent') || 'Unknown';

    // 3. Fire and forget (don't await to avoid slowing down the user response)
    q(sql, [
      userId,
      activityType,
      pagePath,
      httpMethod,
      endpoint,
      userAgent
    ]).catch(err => console.error("Activity Log SQL Error:", err.message));

  } catch (err) {
    console.error("Failed to prepare activity log:", err);
  }
}

const lastUpdateCache = new Map();
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 min
export async function keepLastOnline(userId) {
  try {
    if (!userId) {
      console.log("Err No ID yok. keepLastOnline() activity.js");
      return;
    }

    const now = Date.now();
    const lastUpdate = lastUpdateCache.get(userId);

    if (lastUpdate && (now - lastUpdate < UPDATE_INTERVAL)) {
      return;
    }

    const sql = `
      UPDATE users SET last_online = CURRENT_TIMESTAMP WHERE id = $1;
    `;

    lastUpdateCache.set(userId, now);

    q(sql, [userId]).catch(err => {
      console.error("keepLastOnline SQL Error:", err.message);
      lastUpdateCache.delete(userId);
    });

  } catch (err) {
    console.log("Err saving keepLastOnline");
  }
}