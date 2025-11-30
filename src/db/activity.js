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
      (user_id, activity_type, page_path, http_method, endpoint, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    // 1. Safe IP Extraction (handles proxies like Nginx/Cloudflare)
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
    // Postgres 'inet' type fails on empty strings, convert to null or localhost if missing
    if (!ip || ip === '::1') ip = '127.0.0.1';
    if (ip.includes(',')) ip = ip.split(',')[0].trim(); // Take first IP if multiple

    // 2. Data prep
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
      ip,
      userAgent
    ]).catch(err => console.error("Activity Log SQL Error:", err.message));

  } catch (err) {
    console.error("Failed to prepare activity log:", err);
  }
}