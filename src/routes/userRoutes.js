import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import 'dotenv/config'; // Ensure environment variables are loaded
import { q } from "../db/pool.js";
const router = Router();

router.get('/api/searchUsers', requireAuth, async (req, res) => {
    const query = req.query.q;

    if (!query || query.trim().length < 2) {
        // Don't search for less than 2 characters
        return res.json([]);
    }

    // Use ILIKE for case-insensitive search
    // We select only the fields the frontend needs
    const searchQuery = `
        SELECT
            id,
            user_name,
            real_name,
            profile_pic_path
        FROM
            users
        WHERE
            user_name ILIKE $1
            OR real_name ILIKE $1
        LIMIT 10;
    `;

    try {
        // We add '%' wildcards for a "contains" search
        const { rows } = await q(searchQuery, [`%${query}%`]);
        res.json(rows);
    } catch (err) {
        console.error('User search error:', err);
        res.status(500).json({ error: 'Error searching for users' });
    }
});


export default router;