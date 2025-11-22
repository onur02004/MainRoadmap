import express from 'express';
import { searchImages } from '../helpers/wishlistHelper.js';

const router = express.Router();

router.get('/api/images', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) {
      return res.status(400).json({ error: 'Missing q parameter' });
    }

    const images = await searchImages(q, 10);
    res.json({ query: q, count: images.length, images });
  } catch (err) {
    console.error('Error in /api/images:', err);
    res.status(500).json({ error: 'Image search failed' });
  }
});

export default router;