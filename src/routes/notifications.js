import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";

const router = Router();

router.get("/api/notifications/latest", requireAuth, async (req, res) => {
    try {
        const userId = req.user.sub;
        // We use ->> to extract text from the JSONB payload column
        const result = await q(
            `SELECT 
                id, 
                payload->>'title' as title, 
                payload->>'body' as body, 
                payload->>'imageUrl' as image_url, 
                sent_at as created_at
             FROM notification_events 
             WHERE user_id = $1 
             ORDER BY sent_at DESC LIMIT 5`,
            [userId]
        );
        res.json({ notifications: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

export default router;