import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import 'dotenv/config'; // Ensure environment variables are loaded

const router = Router();

// Your Last.fm API Key should be set in your .env file
const LASTFM_API_KEY = process.env.LASTFM_API_KEY; 
const LASTFM_API_URL = "http://ws.audioscrobbler.com/2.0/";

/**
 * API endpoint to search for music tracks on Last.fm.
 * Requires authentication.
 * GET /api/music/search?track=song_title
 */
router.get("/api/music/searchLASTFM", requireAuth, async (req, res) => {
    const trackQuery = req.query.track;

    if (!LASTFM_API_KEY) {
        console.error("LASTFM_API_KEY is not set in environment variables.");
        return res.status(500).json({ 
            error: "Server configuration error: Music API key missing." 
        });
    }

    if (!trackQuery || trackQuery.trim() === "") {
        return res.status(400).json({ error: "Track query is required." });
    }

    // Construct the Last.fm API request URL
    const url = `${LASTFM_API_URL}?method=track.search&track=${encodeURIComponent(trackQuery)}&api_key=${LASTFM_API_KEY}&format=json`;

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error(`Last.fm API failed: ${response.status} ${response.statusText}`);
            return res.status(502).json({ 
                error: "External API error. Could not retrieve music data." 
            });
        }

        const data = await response.json();

        // Check for error messages from Last.fm (e.g., invalid API key)
        if (data.error) {
            console.error("Last.fm reported an error:", data.message);
            return res.status(500).json({ 
                error: "Music search failed due to an external service error." 
            });
        }

        // Process the results to extract relevant information
        const results = data.results?.trackmatches?.track || [];
        
        const simplifiedResults = results.map(track => {
            // Find the largest available image (size "extralarge" or "large")
            const largeImage = track.image.find(img => img.size === 'extralarge' || img.size === 'large');
            const imageUrl = largeImage ? largeImage['#text'] : 'https://placehold.co/150x150/000000/FFFFFF?text=No+Cover'; // Fallback placeholder

            return {
                name: track.name,
                artist: track.artist,
                // Last.fm can sometimes return an empty string for the image URL, so we use a fallback
                imageUrl: imageUrl || 'https://placehold.co/150x150/000000/FFFFFF?text=No+Cover'
            };
        });

        return res.json({ 
            tracks: simplifiedResults 
        });

    } catch (error) {
        console.error("Error fetching data from Last.fm:", error);
        return res.status(500).json({ 
            error: "An unexpected error occurred during search." 
        });
    }
});



// MusicBrainz and Cover Art Archive URLs
const MUSICBRAINZ_API_URL = "https://musicbrainz.org/ws/2/";
const COVERART_ARCHIVE_URL = "https://coverartarchive.org/";

/**
 * API endpoint to search for music tracks on MusicBrainz.
 * Requires authentication.
 * GET /api/music/search?track=song_title
 */
router.get("/api/music/searchMusicBrainz", requireAuth, async (req, res) => {
    const trackQuery = req.query.track;

    if (!trackQuery || trackQuery.trim() === "") {
        return res.status(400).json({ error: "Track query is required." });
    }

    // Construct the MusicBrainz API request URL for recordings (songs)
    // We include 'artist-credits' and 'releases' to find the cover art MBID
    const searchUrl = `${MUSICBRAINZ_API_URL}recording/?query=recording:${encodeURIComponent(trackQuery)}&fmt=json&limit=10&inc=artist-credits+releases`;

    try {
        // MusicBrainz requires a proper User-Agent header
        const searchResponse = await fetch(searchUrl, {
            headers: { 
                'User-Agent': 'SongShareApp/1.0 ( contact@example.com )' 
            }
        });
        
        if (!searchResponse.ok) {
            console.error(`MusicBrainz API failed: ${searchResponse.status} ${searchResponse.statusText}`);
            return res.status(502).json({ 
                error: "External API error. Could not retrieve music data." 
            });
        }

        const searchData = await searchResponse.json();
        const recordings = searchData.recordings || [];
        
        const simplifiedResults = recordings.map(recording => {
            // Find the Release Group ID from the first associated release
            const releaseGroupId = recording.releases?.[0]?.['release-group']?.id;
            
            // The Cover Art Archive uses the Release Group ID to link to the album art.
            // This URL will redirect to the actual image file.
            const coverArtUrl = releaseGroupId 
                ? `${COVERART_ARCHIVE_URL}release-group/${releaseGroupId}/front`
                : COVER_FALLBACK;

            // Extract the primary artist name
            const artist = recording['artist-credit']?.[0]?.name || 'Unknown Artist';

            return {
                name: recording.title,
                artist: artist,
                imageUrl: coverArtUrl
            };
        });

        return res.json({ 
            tracks: simplifiedResults 
        });

    } catch (error) {
        console.error("Error fetching data from MusicBrainz:", error);
        return res.status(500).json({ 
            error: "An unexpected error occurred during search." 
        });
    }
});



// Spotify API URLs
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";
const COVER_FALLBACK = 'https://placehold.co/150x150/000000/FFFFFF?text=No+Cover';

// Global token variables for client credentials flow caching
let spotifyToken = null;
let tokenExpiry = 0;

/**
 * Fetches a new Spotify Client Credentials token if the current one is missing or expired.
 * @returns {string} The valid access token.
 */
async function getSpotifyToken() {
    // Return cached token if still valid
    if (spotifyToken && Date.now() < tokenExpiry) {
        return spotifyToken; 
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Missing Spotify Client ID or Secret in environment configuration.");
    }

    // Base64 encode client ID and secret for basic authentication
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
        console.error("Failed to get Spotify token:", response.status, await response.text());
        throw new Error("Failed to authenticate with Spotify.");
    }

    const data = await response.json();
    spotifyToken = data.access_token;
    // Set expiry time 1 minute before actual expiry for safety
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; 
    return spotifyToken;
}

/**
 * API endpoint to search for music tracks on Spotify.
 * Requires authentication.
 * GET /api/music/search?track=song_title
 */
router.get("/api/music/search", requireAuth, async (req, res) => {
    const trackQuery = req.query.track;

    if (!trackQuery || trackQuery.trim() === "") {
        return res.status(400).json({ error: "Track query is required." });
    }

    try {
        const token = await getSpotifyToken();
        
        // Construct the Spotify API request URL for tracks
        const searchUrl = `${SPOTIFY_SEARCH_URL}?q=${encodeURIComponent(trackQuery)}&type=track&limit=10`;

        const searchResponse = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!searchResponse.ok) {
            console.error(`Spotify API failed: ${searchResponse.status} ${searchResponse.statusText}`);
            return res.status(502).json({ 
                error: "External API error. Could not retrieve music data from Spotify." 
            });
        }

        const searchData = await searchResponse.json();
        const tracks = searchData.tracks?.items || [];
        
        const simplifiedResults = tracks.map(track => {
            const album = track.album;
            
            // Spotify provides images in descending size order, so the first one is the largest.
            const imageUrl = album.images?.[0]?.url || COVER_FALLBACK;

            // Concatenate all artist names
            const artist = track.artists.map(a => a.name).join(', ');

            return {
                name: track.name,
                artist: artist,
                imageUrl: imageUrl
            };
        });

        return res.json({ 
            tracks: simplifiedResults 
        });

    } catch (error) {
        console.error("Error fetching data from Spotify:", error);
        return res.status(500).json({ 
            error: error.message || "An unexpected error occurred during Spotify search." 
        });
    }
});

export default router;