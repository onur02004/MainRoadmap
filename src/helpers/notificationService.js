import webpush from 'web-push';
import { q } from "../db/pool.js";
import 'dotenv/config';

// Initialize Web Push with keys from .env
webpush.setVapidDetails(
  'mailto:admin@pi.330nur.org', // Replace with your admin email
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Sends a push notification to a specific user on all their devices.
 * @param {string} targetUserId - The UUID of the user to notify.
 * @param {object} payload - { title, body, url, tag, icon }
 */
export async function sendNotificationToUser(targetUserId, payload) {
    try {
        // 1. Get all subscriptions for this user
        const result = await q(
            `SELECT * FROM push_subscriptions WHERE user_id = $1`,
            [targetUserId]
        );

        const subscriptions = result.rows;

        if (subscriptions.length === 0) return;

        // 2. Format the payload for the Service Worker
        const notificationData = JSON.stringify(payload);

        // 3. Send to all devices in parallel
        const promises = subscriptions.map(async (sub) => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushConfig, notificationData);
            } catch (err) {
                // If 410 (Gone) or 404, the subscription is dead. Delete it.
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`Removing dead subscription for user ${targetUserId}`);
                    await q(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
                } else {
                    console.error('Push error:', err);
                }
            }
        });

        await Promise.all(promises);

    } catch (error) {
        console.error("Error in notification service:", error);
    }
}