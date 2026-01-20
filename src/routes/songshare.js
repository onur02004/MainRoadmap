import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import 'dotenv/config'; // Ensure environment variables are loaded
import { q } from "../db/pool.js";
import { getDominantColors } from "../helpers/imganalyser.js";
import { getFreeLyricsSmart } from "../helpers/lyricsService.js";
import { sendPush } from "../helpers/sendPush.js";
import { notifyUserByType } from "../helpers/notificationHelper.js";
import { NotificationType } from "../constants/notificationTypes.js";
import yts from 'yt-search';
import axios from 'axios';


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
                artistIds: artistIds,
                duration_ms: track.duration_ms
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

        // if (!isPublic && Array.isArray(targetUsers) && targetUsers.length > 0) {
        //     console.log("Notifying user about the shared music");
        //     const { rows: userRows } = await q(
        //         "SELECT user_name FROM users WHERE id = $1",
        //         [userId]
        //     );
        //     const recommenderName = userRows[0]?.user_name || "Someone";

        //     const { rows: suggestedSongRows } = await q(
        //         "SELECT id FROM song_suggestions WHERE user_id = $1 AND spotify_uri = $2",
        //         [userId, uri]
        //     );

        //     const recommendedSongID = suggestedSongRows[0]?.id || "Yikes";
        //     const trimmedComment = typeof comment === "string" ? comment.trim() : "";
        //     const commentPart = trimmedComment ? ` || With Comment: ${trimmedComment}` : "";


        //     for (const targetUserId of targetUsers) {
        //         await notifyUserByType({
        //             userId: targetUserId,
        //             type: NotificationType.DIRECT_SHARE,
        //             title: "New music suggestion",
        //             body: `${recommenderName} suggested: ${name} – ${artist}${commentPart}`,
        //             data: {
        //                 suggestionId: recommendedSongID,
        //                 spotifyUri: uri,
        //             },
        //             imageUrl: imageUrl || "https://pi.330nur.org/content/deafult.jpg"
        //         });
        //     }
        // }

        const newPost = result.rows[0];

        const { rows: senderRows } = await q("SELECT user_name FROM users WHERE id = $1", [req.user.sub]);
        const senderName = senderRows[0]?.user_name || "Someone";

        // SCENARIO 1: Private Post (Direct Share)
        if (!isPublic && Array.isArray(targetUsers)) {
            for (const targetId of targetUsers) {
                await notifyUserByType({
                    userId: targetId,
                    type: 'direct_share', // Matches DB column 'push_direct_share' / 'email_direct_share'
                    title: "New Private Suggestion",
                    body: `${senderName} sent you a song: ${name}`,
                    data: { suggestionId: newPost.id },
                    imageUrl: imageUrl
                });
            }
        }

        // SCENARIO 2: Public Post
        if (isPublic) {
            // Notify all active users (who are not the sender)
            const { rows: allUsers } = await q("SELECT id FROM users WHERE id != $1 AND is_verified = true", [req.user.sub]);

            for (const user of allUsers) {
                await notifyUserByType({
                    userId: user.id,
                    type: 'public_share', // Matches DB column 'push_public_share'
                    title: "New Public Post",
                    body: `${senderName} shared a new song with everyone: ${name}`,
                    data: { suggestionId: newPost.id },
                    imageUrl: imageUrl
                });
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
        s.*,
        u.user_name AS suggester_username,
        u.profile_pic_path AS suggester_avatar,
        r.song_reaction_type AS current_user_reaction,
        -- Count total comments
        (SELECT COUNT(*) FROM song_suggestion_comments WHERE suggestion_id = s.id) AS comment_count,
        -- Count total reactions (likes, mehs, dislikes)
        (SELECT COUNT(*) FROM song_suggestion_reactions WHERE suggestion_id = s.id) AS reaction_count
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

        if (newReaction) { // Only notify if a reaction was added, not removed
            try {
                // 1. Get the original suggestion owner and song title
                const { rows: sugRows } = await q(
                    "SELECT user_id, song_name FROM song_suggestions WHERE id = $1",
                    [suggestionId]
                );
                const suggestionOwnerId = sugRows[0]?.user_id;
                const songName = sugRows[0]?.song_name;

                // 2. Get the name of the person reacting (current user)
                const { rows: userRows } = await q(
                    "SELECT user_name FROM users WHERE id = $1",
                    [userId]
                );
                const reactorName = userRows[0]?.user_name || "Someone";

                // 3. Notify owner if they aren't the one reacting
                if (suggestionOwnerId && suggestionOwnerId !== userId) {
                    await notifyUserByType({
                        userId: suggestionOwnerId,
                        type: NotificationType.REACTION, // Ensure this exists in your constants
                        title: "New Reaction!",
                        body: `${reactorName} reacted with ${action} to your suggestion: ${songName}`,
                        data: { suggestionId, action }
                    });
                }
            } catch (notifyErr) {
                console.error("Failed to send reaction notification:", notifyErr);
            }
        }

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

        try {
            // 1. Get the original suggestion owner and song title
            const { rows: sugRows } = await q(
                "SELECT user_id, song_name FROM song_suggestions WHERE id = $1",
                [suggestionId]
            );
            const suggestionOwnerId = sugRows[0]?.user_id;
            const songName = sugRows[0]?.song_name;

            // 2. Get the name of the person commenting
            const { rows: userRows } = await q(
                "SELECT user_name FROM users WHERE id = $1",
                [userId]
            );
            const commenterName = userRows[0]?.user_name || "Someone";

            // 3. Notify the owner (if it's not their own comment)
            if (suggestionOwnerId && suggestionOwnerId !== userId) {
                await notifyUserByType({
                    userId: suggestionOwnerId,
                    type: NotificationType.COMMENT, // Ensure this exists in your constants
                    title: "New Comment!",
                    body: `${commenterName} commented on ${songName}: "${commentText.substring(0, 50)}"`,
                    data: { suggestionId }
                });
            }
        } catch (notifyErr) {
            console.error("Failed to send comment notification:", notifyErr);
        }

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

router.get("/api/user/my-suggestions", requireAuth, async (req, res) => {
    const userId = req.user.sub;

    const sql = `
        SELECT
            s.*,
            u.user_name AS suggester_username,
            u.profile_pic_path AS suggester_avatar,
            r.song_reaction_type AS current_user_reaction
        FROM song_suggestions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN song_suggestion_reactions r ON r.suggestion_id = s.id AND r.user_id = $1
        WHERE s.user_id = $1
        ORDER BY s.date_added DESC
    `;

    try {
        const result = await q(sql, [userId]);
        res.json({ suggestions: result.rows });
    } catch (err) {
        console.error("My history error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// [NEW] Get Target Users for a Suggestion (Who it was shared with)
router.get("/api/music/suggestions/:id/targets", requireAuth, async (req, res) => {
    const suggestionId = req.params.id;

    const sql = `
        SELECT u.user_name, u.real_name, u.profile_pic_path
        FROM users u
        WHERE u.id = ANY (
            SELECT UNNEST(target_users) 
            FROM song_suggestions 
            WHERE id = $1
        )
    `;

    try {
        const result = await q(sql, [suggestionId]);
        res.json({ users: result.rows });
    } catch (err) {
        console.error("Error fetching target users:", err);
        res.status(500).json({ error: "Failed to fetch shared users" });
    }
});


// Search shared songs (public OR targeted OR owner)
router.get("/api/music/search-shared", requireAuth, async (req, res) => {
    const userId = req.user?.sub;
    const qText = (req.query.q || "").trim();

    if (!userId) {
        return res.status(401).json({ error: "Authentication error: User ID not found." });
    }

    if (qText.length < 2) {
        return res.status(400).json({ error: "Query must be at least 2 characters." });
    }

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
      u.profile_pic_path AS suggester_avatar
    FROM song_suggestions s
    JOIN users u ON s.user_id = u.id
    WHERE
      (s.visibility_public = true OR $1 = ANY(s.target_users) OR s.user_id = $1)
      AND (
        s.song_name ILIKE '%' || $2 || '%'
        OR s.song_artist ILIKE '%' || $2 || '%'
        OR u.user_name ILIKE '%' || $2 || '%'
      )
    ORDER BY s.date_added DESC
    LIMIT 30;
  `;

    try {
        const result = await q(sql, [userId, qText]);
        res.json({ suggestions: result.rows });
    } catch (err) {
        console.error("Error searching shared songs:", err);
        res.status(500).json({ error: "Failed to search songs." });
    }
});


// DELETE /api/comments/:id
router.delete("/api/comments/:id", requireAuth, async (req, res) => {
    const commentId = req.params.id;
    const userId = req.user.sub;

    // 1) Find comment + owner
    const { rows } = await q("SELECT user_id FROM song_suggestion_comments WHERE id = $1", [commentId]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    const c = rows[0];

    // 2) Check permission
    const isAdmin = req.user.role?.toLowerCase?.().includes("admin"); // adapt to your auth
    if (!isAdmin && c.user_id !== userId) return res.status(403).json({ error: "Forbidden" });

    // 3) Delete
    await q("DELETE FROM song_suggestion_comments WHERE id = $1", [commentId]);
    res.json({ ok: true, songId: c.song_id });
});


// POST /api/music/suggestions/:id/play-notify
router.post("/api/music/suggestions/:id/play-notify", requireAuth, async (req, res) => {
    const userId = req.user?.sub; // ID of person playing the song
    const suggestionId = req.params.id;

    try {
        // 1. Find the original sharer and the song title
        const { rows: sugRows } = await q(
            "SELECT user_id, song_name FROM song_suggestions WHERE id = $1",
            [suggestionId]
        );

        if (sugRows.length === 0) return res.status(404).json({ error: "Suggestion not found" });

        const sharerId = sugRows[0].user_id;
        const songName = sugRows[0].song_name;

        // 2. Identify the player
        const { rows: userRows } = await q(
            "SELECT user_name FROM users WHERE id = $1",
            [userId]
        );
        const playerName = userRows[0]?.user_name || "Someone";

        // 3. Notify the sharer
        if (sharerId && sharerId !== userId) {
            await notifyUserByType({
                userId: sharerId,
                type: NotificationType.PLAY_EVENT, // Now defined in constants!
                title: "Listening Now!",
                body: `${playerName} is PROBABLY playing your suggestion: ${songName}`,
                data: { suggestionId }
            });
        }

        res.json({ ok: true });
    } catch (err) {
        console.error("Play notification error:", err);
        res.status(500).json({ error: "Failed to send notification" });
    }
});


function parseLRC(lrcText) {
    if (!lrcText) return [];
    return lrcText.split('\n').map(line => {
        const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
        if (match) {
            return {
                time: (parseInt(match[1]) * 60) + parseFloat(match[2]),
                words: match[3].trim()
            };
        }
        return null;
    }).filter(l => l && l.words);
}

router.get('/api/auto-sync', async (req, res) => {
    const { track, artist } = req.query;
    
    if (!track || !artist) {
        return res.status(400).json({ error: "Track and artist are required" });
    }

    try {
        // 1. Search YouTube for a lyrics-focused video ID
        const searchResult = await yts(`${track} ${artist} official audio lyrics`);
        const videoId = searchResult.videos[0]?.videoId;

        if (!videoId) return res.status(404).json({ error: "YouTube video not found" });

        // 2. Fetch Synced Lyrics from LRCLIB
        const lyricsResp = await axios.get('https://lrclib.net/api/get', {
            params: { track_name: track, artist_name: artist }
        }).catch(() => null);

        let lyrics = [];
        if (lyricsResp && lyricsResp.data.syncedLyrics) {
            // Use your existing parseLRC function
            lyrics = parseLRC(lyricsResp.data.syncedLyrics); 
        }

        res.json({ 
            videoId, 
            lyrics, 
            plainLyrics: lyricsResp?.data?.plainLyrics || "" 
        });
    } catch (e) {
        console.error("Auto-sync error:", e);
        res.status(500).json({ error: "Search failed" });
    }
});

// GET /api/music/song-details?track=...&artist=...
router.get("/api/music/song-details", requireAuth, async (req, res) => {
    const { track, artist } = req.query;

    // FIX: Only require track, as the artist is likely part of the track string
    if (!track) return res.status(400).json({ error: "Missing track name" });

    try {
        const token = await getSpotifyToken();
        
        // FIX: Construct a query that works whether artist is separate or bundled
        const query = (artist && artist.trim() !== "") ? `track:${track} artist:${artist}` : track;
        const searchUrl = `${SPOTIFY_SEARCH_URL}?q=${encodeURIComponent(query)}&type=track&limit=1`;
        
        const response = await fetch(searchUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        const item = data.tracks?.items[0];

        if (!item) return res.status(404).json({ error: "Not found" });

        const imageUrl = item.album.images[0]?.url;
        const colorData = imageUrl ? await getDominantColors(imageUrl) : null;

        res.json({
            name: item.name,
            artist: item.artists.map(a => a.name).join(', '),
            imageUrl: imageUrl,
            colors: colorData
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/api/users/:id", requireAuth, async (req, res) => {
    try {
        const { rows } = await q(
            "SELECT id, user_name, real_name, profile_pic_path FROM users WHERE id = $1",
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// GET /api/users/:id/suggestions - Fetch songs shared by a specific user
router.get("/api/users/:id/suggestions", requireAuth, async (req, res) => {
    const targetUserId = req.params.id;
    const currentUserId = req.user.sub;

    const sql = `
        SELECT
            s.*,
            u.user_name AS suggester_username,
            u.profile_pic_path AS suggester_avatar,
            r.song_reaction_type AS current_user_reaction
        FROM song_suggestions s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN song_suggestion_reactions r ON r.suggestion_id = s.id AND r.user_id = $2
        WHERE s.user_id = $1
          AND (s.visibility_public = true OR $2 = ANY(s.target_users))
        ORDER BY s.date_added DESC
    `;

    try {
        const result = await q(sql, [targetUserId, currentUserId]);
        res.json({ suggestions: result.rows });
    } catch (err) {
        console.error("Error fetching user history:", err);
        res.status(500).json({ error: "Server error" });
    }
});

export default router;