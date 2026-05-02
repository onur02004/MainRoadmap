import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import 'dotenv/config'; // Ensure environment variables are loaded
import { q } from "../db/pool.js";
import axios from 'axios';


const router = Router();



/**
 * @openapi
 * /api/movies/search:
 * get:
 * summary: Search for movies and TV titles
 * description: Fetches media metadata from the IMDB API and formats it for the grid view.
 * parameters:
 * - in: query
 * name: q
 * schema:
 * type: string
 * required: true
 * description: The search term ("Inception" mesela)
 * responses:
 * 200:
 * description: A list of search results formatted for the frontend.
 * 400:
 * description: Missing search query.
 * 500:
 * description: External API or server error.
 */
router.get("/api/movies/search", async (req, res) => {
    const searchQuery = req.query.q;

    if (!searchQuery) {
        return res.status(400).json({ message: "Search query is required" });
    }

    try {
        const response = await axios.get(`https://api.imdbapi.dev/search/titles?query=${encodeURIComponent(searchQuery)}`);
        
        // Use 'titles' instead of 'results' based on your API response
        const titlesData = response.data?.titles || [];

        const searchResults = titlesData.map(item => ({
            id: item.id,
            title: item.primaryTitle,
            // The image is inside primaryImage.url
            poster: item.primaryImage?.url || "placeholder.jpg", 
            type: item.type, 
            year: item.startYear || 'N/A',
            rating: item.rating?.aggregateRating || 0,
            watched: false 
        }));

        res.status(200).json({
            pageType: "grid",
            query: searchQuery,
            content: searchResults
        });

    } catch (error) {
        console.error("(500)Search Error:", error.message);
        res.status(500).json({ message: "Search failed." });
    }
});


export default router;
