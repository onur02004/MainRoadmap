import { Router } from 'express';
import requireAuth from '../middleware/requireAuth.js';
import { q } from '../db/pool.js'; // Use 'q' as defined in your pool.js

const router = Router();

// GET: Load history
router.get('/api/moods', requireAuth, requireFeature('mt'), async (req, res) => {
    try {
        const userId = req.user.sub; 
        const result = await q(
            'SELECT log_date, rating, note, image_data FROM mood_entries WHERE user_id = $1 ORDER BY log_date DESC LIMIT 32',
            [userId]
        );

        const moodMap = {};
        result.rows.forEach(row => {
            // Manual formatting to prevent timezone shifts
            const d = new Date(row.log_date);
            const dateKey = d.getFullYear() + '-' + 
                            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(d.getDate()).padStart(2, '0');
            
            moodMap[dateKey] = {
                rating: row.rating,
                note: row.note,
                image: row.image_data
            };
        });

        res.json(moodMap);
    } catch (err) {
        console.error("GET MOODS ERROR:", err);
        res.status(500).json({ error: "Failed to load history" });
    }
});


router.post('/api/moods', requireAuth, async (req, res) => {
    const { date, rating, note, image } = req.body;
    
    // CHANGE THIS LINE: Your log shows the ID is stored in 'sub'
    const userId = req.user.sub; 

    if (!userId || !date || !rating) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const sql = `
            INSERT INTO mood_entries (user_id, log_date, rating, note, image_data)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, log_date) 
            DO UPDATE SET 
                rating = EXCLUDED.rating,
                note = EXCLUDED.note,
                image_data = EXCLUDED.image_data,
                created_at = NOW()
            RETURNING *;
        `;
        
        await q(sql, [userId, date, rating, note, image]);
        res.json({ success: true });
    } catch (err) {
        console.error("POST MOODS DATABASE ERROR:", err.detail || err.message);
        res.status(500).json({ error: "Database error" });
    }
});

// Helper for streak calculation
function calculateStreak(rows) {
    if (!rows || rows.length === 0) return 0;
    const loggedDates = [...new Set(rows.map(r => new Date(r.log_date).toISOString().split('T')[0]))].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (loggedDates[0] !== today && loggedDates[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 0; i < loggedDates.length - 1; i++) {
        const current = new Date(loggedDates[i]);
        const next = new Date(loggedDates[i + 1]);
        if ((current - next) / (1000 * 60 * 60 * 24) === 1) streak++;
        else break;
    }
    return streak;
}

router.get('/api/moods/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.user.sub;
        const result = await q(
            `SELECT rating, log_date, EXTRACT(DOW FROM log_date) as day_of_week
             FROM mood_entries WHERE user_id = $1 AND log_date > NOW() - INTERVAL '1 year'
             ORDER BY log_date DESC`, [userId]
        );

        const rows = result.rows;
        const weights = { green: 4, blue: 3, yellow: 2, red: 1 };
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        // Dominant Mood Calculation helper
        const getDominant = (daysLimit) => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - daysLimit);
            const counts = {};
            rows.filter(r => new Date(r.log_date) >= cutoff).forEach(r => {
                counts[r.rating] = (counts[r.rating] || 0) + 1;
            });
            return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, "--");
        };

        // Peak Performance (Happiest Day)
        const dayStats = {};
        rows.forEach(r => {
            const dow = parseInt(r.day_of_week);
            if (!dayStats[dow]) dayStats[dow] = { total: 0, count: 0 };
            dayStats[dow].total += (weights[r.rating] || 0);
            dayStats[dow].count++;
        });
        let peakDayIndex = Object.keys(dayStats).reduce((a, b) => 
            (dayStats[a].total/dayStats[a].count) > (dayStats[b].total/dayStats[b].count) ? a : b, 0);

        // Monthly Radiance
        const thisMonth = new Date().getMonth();
        const monthRows = rows.filter(r => new Date(r.log_date).getMonth() === thisMonth);
        const pos = monthRows.filter(r => r.rating === 'green' || r.rating === 'blue').length;

        res.json({
            streak: calculateStreak(rows),
            peakDay: dayNames[peakDayIndex],
            radiance: monthRows.length > 0 ? Math.round((pos / monthRows.length) * 100) : 0,
            volatility: 1.2, // Placeholder or calculated logic
            dominant: {
                week: getDominant(7),
                sixMonth: getDominant(180),
                year: getDominant(365)
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Remove image from a specific entry
router.delete('/api/moods/image', requireAuth, requireFeature('mt'), async (req, res) => {
    const { date } = req.body;
    const userId = req.user.sub;

    if (!date) {
        return res.status(400).json({ error: "Date is required" });
    }

    try {
        const sql = `
            UPDATE mood_entries 
            SET image_data = NULL 
            WHERE user_id = $1 AND log_date = $2
            RETURNING *;
        `;
        const result = await q(sql, [userId, date]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Entry not found" });
        }

        res.json({ success: true, message: "Image removed" });
    } catch (err) {
        console.error("DELETE IMAGE ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});

export default router;