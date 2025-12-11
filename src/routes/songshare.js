import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import 'dotenv/config'; // Ensure environment variables are loaded
import { q } from "../db/pool.js";
import { getDominantColors } from "../helpers/imganalyser.js";
import { getFreeLyricsSmart } from "../helpers/lyricsService.js";
import { sendPush } from "../helpers/sendPush.js";

const router = Router();

async function notifyUser(userId, title, body, extraData = {}) {
    console.log("Notifying User: " + userId);
  try {
    const { rows } = await q(
      "SELECT expo_token FROM device_tokens WHERE user_id = $1 AND expo_token IS NOT NULL",
      [userId]
    );

    if (rows.length === 0) {
      console.log(`notifyUser: no devices found for user ${userId}`);
      return;
    }

    for (const row of rows) {
      await sendPush(row.expo_token, title, body, extraData);
    }
  } catch (err) {
    console.error("notifyUser error:", err);
  }
}

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

            const artistIds = track.artists.map(artist => artist.id);


            return {
                name: track.name,
                artist: artist,
                imageUrl: imageUrl,
                uri: track.uri,
                artistIds: artistIds
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

router.get("/api/music/artist-image", requireAuth, async (req, res) => {
    const artistId = req.query.artistId;

    if (!artistId || artistId.trim() === "") {
        return res.status(400).json({ error: "Artist ID is required." });
    }

    try {
        const token = await getSpotifyToken();

        // Construct the Spotify API request URL for artist details
        const artistUrl = `https://api.spotify.com/v1/artists/${artistId}`;

        const artistResponse = await fetch(artistUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!artistResponse.ok) {
            if (artistResponse.status === 404) {
                return res.status(404).json({
                    error: "Artist not found."
                });
            }
            console.error(`Spotify API failed: ${artistResponse.status} ${artistResponse.statusText}`);
            return res.status(502).json({
                error: "External API error. Could not retrieve artist data."
            });
        }

        const artistData = await artistResponse.json();

        // Get the largest available artist image (first image in the array is largest)
        const artistImageUrl = artistData.images?.[0]?.url || null;

        return res.json({
            artist: {
                id: artistData.id,
                name: artistData.name,
                imageUrl: artistImageUrl,
                genres: artistData.genres || []
            }
        });

    } catch (error) {
        console.error("Error fetching artist image from Spotify:", error);
        return res.status(500).json({
            error: error.message || "An unexpected error occurred while fetching artist image."
        });
    }
});

router.post("/api/music/suggestions", requireAuth, async (req, res) => {
    const userId = req.user?.sub;
    console.log("Saving user recomm");
    if (!userId) {
        console.log("/api/music/suggestions err no user id");
        return res.status(401).json({ error: "Authentication error: User ID not found. Try logging in again" });
    }

    const {
        name,
        artist,
        imageUrl,
        uri,
        importance,
        rating,
        bestTime,
        comment,
        isPublic,
        targetUsers,
        song_artist_cover_url,
        song_artist_genre
    } = req.body;

    if (!name || !artist || !uri) {
        return res.status(400).json({
            error: "Missing required song data (name, artist, or uri)."
        });
    }

    const targetUserIds = isPublic ? null : targetUsers;

    // --- NEW: dominant color calculation (best-effort) ---
    let overallColor = null;
    let dominantPointsArray = null;

    try {
        if (imageUrl) {
            const colorData = await getDominantColors(imageUrl);
            // colorData: { overall: "#rrggbb", points: { top_left, top_right, bottom_left, bottom_right, center } }

            if (colorData && colorData.overall) {
                overallColor = colorData.overall.toLowerCase();
            }

            if (colorData && colorData.points) {
                const p = colorData.points;
                dominantPointsArray = [
                    p.top_left || null,
                    p.top_right || null,
                    p.bottom_left || null,
                    p.bottom_right || null,
                    p.center || null
                ].map(c => c ? c.toLowerCase() : null);
            }
        }
    } catch (err) {
        console.error("Error calculating dominant colors:", err);
        // Don’t fail request just because colors failed – we keep nulls
    }

    const sql = `
        INSERT INTO song_suggestions (
            user_id,
            spotify_uri,
            song_name,
            song_artist,
            song_cover_url,
            importance,
            rating_by_user,
            visibility_public,
            comment_by_user,
            recommended_time_by_user,
            target_users,
            song_artist_cover_url,
            song_artist_genre,
            overall_dominant_color,
            dominant_colors_points
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *;
    `;

    const params = [
        userId,
        uri,
        name,
        artist,
        imageUrl,
        importance || 'neutral',
        rating ? Number(rating) : null,
        isPublic === true,
        comment || null,
        bestTime || null,
        targetUserIds,
        song_artist_cover_url,
        song_artist_genre,
        overallColor,          // $14
        dominantPointsArray    // $15
    ];

    try {
        const result = await q(sql, params);

        if (!isPublic && Array.isArray(targetUsers) && targetUsers.length > 0) {
            console.log("Notifying user about the shared music");
            const { rows: userRows } = await q(
                "SELECT user_name FROM users WHERE id = $1",
                [userId]
            );
            const recommenderName = userRows[0]?.user_name || "Someone";

            const { rows: suggestedSongRows } = await q(
                "SELECT id FROM song_suggestions WHERE user_id = $1 AND spotify_uri = $2",
                [userId, uri]
            );

            const recommendedSongID = suggestedSongRows[0]?.id || "Yikes";


            for (const targetUserId of targetUsers) {
                await notifyUser(
                    targetUserId,
                    "New music suggestion",
                    `${recommenderName} suggested: ${name} – ${artist}`,
                    {
                        suggestionId: recommendedSongID,
                        spotifyUri: uri,
                        songName: name,
                        songArtist: artist,
                    },
                    params.imageUrl
                );
            }
        }



        res.status(201).json({
            message: "Suggestion added successfully!",
            suggestion: result.rows[0]
        });

    } catch (error) {
        console.error("Error inserting song suggestion:", error);
        if (error.code === '23514') {
            return res.status(400).json({ error: "Invalid rating. Must be between 1 and 10." });
        }
        res.status(500).json({
            error: "An unexpected error occurred while saving the suggestion."
        });
    }
});


router.get("/api/music/feed", requireAuth, async (req, res) => {
    const userId = req.user?.sub;

    if (!userId) {
        return res.status(401).json({ error: "Authentication error: User ID not found." });
    }

    // 1. Get pagination parameters from query, with defaults
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // 2. Define the SQL query
    // This query fetches suggestions that are:
    //    a) Public (visibility_public = true)
    //    b) OR targeted at the current user ($1 = ANY(target_users))
    // It also JOINS with the users table to get the suggester's info.
    // It orders by date_added DESC to show the newest first.
    const sql = `
        SELECT
            s.id,
            s.song_name,
            s.song_artist,
            s.song_cover_url,
            s.spotify_uri,
            s.importance,
            s.rating_by_user,
            s.comment_by_user,
            s.recommended_time_by_user,
            s.date_added,
            s.visibility_public,
            s.song_artist_genre,
            s.song_artist_cover_url,
            s.overall_dominant_color,
            s.dominant_colors_points,
            s.user_id,
            u.user_name AS suggester_username,
            u.profile_pic_path AS suggester_avatar,
            r.song_reaction_type AS current_user_reaction
        FROM
            song_suggestions s
        JOIN
            users u ON s.user_id = u.id
        LEFT JOIN
            song_suggestion_reactions r
            ON r.suggestion_id = s.id AND r.user_id = $1 
        WHERE
            (s.visibility_public = true OR $1 = ANY(s.target_users) OR s.user_id = $1)
        ORDER BY
            s.date_added DESC
        LIMIT $2
        OFFSET $3;
    `;

    // 3. Define parameters
    const params = [userId, limit, offset];

    try {
        // 4. Execute the query
        const result = await q(sql, params);

        // 5. Send success response
        res.status(200).json({
            suggestions: result.rows
        });

    } catch (error) {
        console.error("Error fetching suggestion feed:", error);
        res.status(500).json({
            error: "An unexpected error occurred while fetching the feed."
        });
    }
});

router.get("/api/lyrics", async (req, res) => {
    const { artist, track } = req.query;

    console.log("Loading Lyrics: " + artist + "-" + track);

    if (!artist || !track) {
        return res.status(400).json({
            error: "artist and track are required",
        });
    }

    try {
        const lyrics = await getFreeLyricsSmart(artist, track);

        if (!lyrics) {
            console.log("Lyrics Not found");
            return res.status(404).json({
                error: "Lyrics not found",
            });
        }

        console.log("Lyrics found");

        res.json({ artist, track, lyrics });
    } catch (err) {
        console.log("Error fetching lyrics");
        res.status(500).json({ error: "Error fetching lyrics" });
    }
});

// New API for handling Likes, Mehs, and Dislikes
router.post("/api/music/suggestions/:id/react", requireAuth, async (req, res) => {
    const userId = req.user?.sub;
    const suggestionId = req.params.id;
    const { action } = req.body; // 'like', 'meh', 'dislike', 'remove'

    if (!userId) {
        return res.status(401).json({ error: "Authentication error: User ID not found." });
    }
    if (!['like', 'meh', 'dislike', 'remove'].includes(action)) {
        return res.status(400).json({ error: "Invalid reaction action." });
    }

    try {
        await q('BEGIN');

        // Lock existing row (if any) for this user+suggestion
        const existingRes = await q(`
            SELECT song_reaction_type
            FROM song_suggestion_reactions
            WHERE suggestion_id = $1 AND user_id = $2
            FOR UPDATE;
        `, [suggestionId, userId]);

        const existing = existingRes.rows[0]?.song_reaction_type || null;
        let newReaction = existing;

        if (action === 'remove') {
            // Explicit remove
            if (existing) {
                await q(`
                    DELETE FROM song_suggestion_reactions
                    WHERE suggestion_id = $1 AND user_id = $2;
                `, [suggestionId, userId]);
                newReaction = null;
            }
        } else {
            // like / meh / dislike
            if (!existing) {
                // no reaction -> set one
                await q(`
                    INSERT INTO song_suggestion_reactions (suggestion_id, user_id, song_reaction_type)
                    VALUES ($1, $2, $3);
                `, [suggestionId, userId, action]);
                newReaction = action;
            } else if (existing === action) {
                // same reaction clicked again -> toggle off
                await q(`
                    DELETE FROM song_suggestion_reactions
                    WHERE suggestion_id = $1 AND user_id = $2;
                `, [suggestionId, userId]);
                newReaction = null;
            } else {
                // change opinion -> update reaction
                await q(`
                    UPDATE song_suggestion_reactions
                    SET song_reaction_type = $3
                    WHERE suggestion_id = $1 AND user_id = $2;
                `, [suggestionId, userId, action]);
                newReaction = action;
            }
        }

        await q('COMMIT');

        res.status(200).json({
            message: "Reaction updated.",
            currentReaction: newReaction // 'like' | 'meh' | 'dislike' | null
        });

    } catch (error) {
        await q('ROLLBACK');
        console.error("Error processing reaction:", error);
        res.status(500).json({
            error: "An unexpected error occurred while processing reaction."
        });
    }
});


// New API to fetch comments for a suggestion
router.get("/api/music/suggestions/:id/comments", requireAuth, async (req, res) => {
    const suggestionId = req.params.id;

    const sql = `
        SELECT
            c.id,
            c.comment_text,
            c.date_added,
            u.user_name AS commenter_username,
            u.profile_pic_path AS commenter_avatar
        FROM
            song_suggestion_comments c
        JOIN
            users u ON c.user_id = u.id
        WHERE
            c.suggestion_id = $1
        ORDER BY
            c.date_added DESC;
    `;

    try {
        const result = await q(sql, [suggestionId]);

        res.status(200).json({
            comments: result.rows
        });

    } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({
            error: "An unexpected error occurred while fetching comments."
        });
    }
});

// New API to add a comment
router.post("/api/music/suggestions/:id/comments", requireAuth, async (req, res) => {
    const userId = req.user?.sub;
    const suggestionId = req.params.id;
    const { commentText } = req.body;

    if (!userId) {
        return res.status(401).json({ error: "Authentication error: User ID not found." });
    }
    if (!commentText || commentText.trim() === "") {
        return res.status(400).json({ error: "Comment text cannot be empty." });
    }

    const sql = `
        INSERT INTO song_suggestion_comments (suggestion_id, user_id, comment_text)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;

    try {
        const result = await q(sql, [suggestionId, userId, commentText.trim()]);

        res.status(201).json({
            message: "Comment added successfully!",
            comment: result.rows[0]
        });

    } catch (error) {
        console.error("Error inserting comment:", error);
        res.status(500).json({
            error: "An unexpected error occurred while saving the comment."
        });
    }
});

// 1. GET ALL REACTIONS FOR A SUGGESTION
router.get("/api/music/suggestions/:id/reactions-list", requireAuth, async (req, res) => {
    const suggestionId = req.params.id;

    const sql = `
        SELECT 
            u.user_name, 
            u.profile_pic_path, 
            r.song_reaction_type
        FROM song_suggestion_reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.suggestion_id = $1
        ORDER BY r.song_reaction_type;
    `;

    try {
        const result = await q(sql, [suggestionId]);
        res.json({ reactions: result.rows });
    } catch (err) {
        console.error("Error fetching reactions list:", err);
        res.status(500).json({ error: "Failed to fetch reactions" });
    }
});

// 2. DELETE SUGGESTION (Only Owner)
router.delete("/api/music/suggestions/:id", requireAuth, async (req, res) => {
    const userId = req.user?.sub;
    const suggestionId = req.params.id;

    try {
        // Verify ownership and delete in one go
        const result = await q(
            `DELETE FROM song_suggestions WHERE id = $1 AND user_id = $2 RETURNING *`,
            [suggestionId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ error: "Not authorized or suggestion not found." });
        }

        res.json({ message: "Suggestion deleted successfully" });
    } catch (err) {
        console.error("Delete error:", err);
        res.status(500).json({ error: "Server error deleting suggestion" });
    }
});

// 3. EDIT SUGGESTION (Only Owner)
router.put("/api/music/suggestions/:id", requireAuth, async (req, res) => {
    const userId = req.user?.sub;
    const suggestionId = req.params.id;
    const { importance, rating, comment } = req.body;

    try {
        const result = await q(
            `UPDATE song_suggestions 
             SET importance = $1, rating_by_user = $2, comment_by_user = $3
             WHERE id = $4 AND user_id = $5
             RETURNING *`,
            [importance, rating, comment, suggestionId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ error: "Not authorized or suggestion not found." });
        }

        res.json({ message: "Updated successfully", suggestion: result.rows[0] });
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ error: "Server error updating suggestion" });
    }
});


export default router;