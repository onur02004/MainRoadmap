import express from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";

import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";

import sharp from "sharp";

const router = express.Router();

const UPLOAD_BASE = path.join(process.cwd(), "src", "data", "uploads");
fs.mkdirSync(UPLOAD_BASE, { recursive: true });

// Store uploads as random filenames; keep original name in DB.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_BASE),
    filename: (_req, file, cb) => {
      const id = crypto.randomUUID();
      const safeExt = path.extname(file.originalname).slice(0, 20);
      cb(null, `${id}${safeExt}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB basic limit
});

// List items in a folder (owner-only for now; we’ll expand later)
router.get("/api/storage/list", requireAuth, async (req, res) => {
  const parentId = req.query.parentId || null;
  const userId = req.user.sub;

  // Select items owned by user OR shared with user via ACL
  const query = `
    SELECT i.id, i.parent_id, i.is_folder, i.name, i.mime_type, i.size_bytes, i.created_at,
           CASE WHEN i.owner_user_id = $1 THEN true ELSE false END as is_owner
      FROM storage_items i
      LEFT JOIN storage_item_acl acl ON i.id = acl.item_id
     WHERE (i.owner_user_id = $1 OR acl.grantee_user_id = $1)
       AND (i.parent_id IS NOT DISTINCT FROM $2)
     ORDER BY i.is_folder DESC, i.name ASC
  `;

  const { rows } = await q(query, [userId, parentId]);
  res.json({ parentId, items: rows });
});

// Create folder
router.post("/api/storage/folder", requireAuth, async (req, res) => {
  const { parentId = null, name } = req.body || {};
  if (!name || typeof name !== "string") return res.status(400).json({ error: "name required" });

  const { rows } = await q(
    `INSERT INTO storage_items (owner_user_id, parent_id, is_folder, name)
     VALUES ($1, $2, true, $3)
     RETURNING id, parent_id, is_folder, name, created_at`,
    [req.user.sub, parentId, name.trim()]
  );

  res.json({ folder: rows[0] });
});

// Upload files into a folder
router.post("/api/storage/upload", requireAuth, upload.array("files", 20), async (req, res) => {
  const parentId = req.body.parentId || null;

  if (!req.files?.length) return res.status(400).json({ error: "no files uploaded" });

  const inserted = [];
  for (const f of req.files) {
    const { rows } = await q(
      `INSERT INTO storage_items
         (owner_user_id, parent_id, is_folder, name, storage_path, mime_type, size_bytes)
       VALUES ($1, $2, false, $3, $4, $5, $6)
       RETURNING id, parent_id, is_folder, name, mime_type, size_bytes, created_at`,
      [
        req.user.sub,
        parentId,
        f.originalname,
        f.path,               // full path on server disk
        f.mimetype,
        f.size,
      ]
    );
    inserted.push(rows[0]);
  }

  res.json({ uploaded: inserted });
});


// Download/preview a file (owner-only)
router.get("/api/storage/file/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const isPreview = req.query.preview === '1';
  const width = req.query.w ? parseInt(req.query.w) : null; // Get width param

  const { rows } = await q(
    `SELECT id, owner_user_id, is_folder, name, storage_path, mime_type
       FROM storage_items
      WHERE id=$1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });

  const item = rows[0];
  if (item.is_folder) return res.status(400).json({ error: "not a file" });
  if (item.owner_user_id !== req.user.sub) return res.status(403).json({ error: "forbidden" });

  if (!item.storage_path || !fs.existsSync(item.storage_path)) {
    return res.status(404).json({ error: "file missing on disk" });
  }

  // OPTIMIZATION: If 'w' param is present and it's an image, resize it
  if (width && !isNaN(width) && item.mime_type && item.mime_type.startsWith("image/")) {
      res.setHeader("Content-Type", item.mime_type);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(item.name)}"`);

      // Create a resizing pipeline
      const resizeTransform = sharp()
          .resize({ width: width, withoutEnlargement: true })
          .rotate(); // Auto-rotate based on EXIF data

      // Stream: Disk -> Sharp -> Response
      fs.createReadStream(path.resolve(item.storage_path))
          .pipe(resizeTransform)
          .pipe(res)
          .on('error', (err) => {
              console.error("Streaming error:", err);
              // Only end if headers haven't been sent
              if (!res.headersSent) res.status(500).send("Image processing error");
          });
          
      return; 
  }

  // Standard serve (Full resolution)
  res.setHeader("Content-Type", item.mime_type || "application/octet-stream");
  const disposition = isPreview ? 'inline' : 'attachment';
  res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(item.name)}"`);
  res.sendFile(path.resolve(item.storage_path));
});


router.post("/api/storage/share/:id", requireAuth, async (req, res) => {
  const id = req.params.id;

  const { rows } = await q(
    `SELECT id, owner_user_id
       FROM storage_items
      WHERE id=$1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  if (rows[0].owner_user_id !== req.user.sub) return res.status(403).json({ error: "forbidden" });

  // If you want: reuse existing share link instead of creating new every time
  const { rows: existing } = await q(
    `SELECT token FROM storage_share_links WHERE item_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  );
  if (existing.length) {
    return res.json({ token: existing[0].token, url: `/s/${existing[0].token}` });
  }

  const token = crypto.randomBytes(24).toString("hex");
  const { rows: linkRows } = await q(
    `INSERT INTO storage_share_links (item_id, token, allow_subtree)
     VALUES ($1, $2, true)
     RETURNING token`,
    [id, token]
  );

  res.json({ token: linkRows[0].token, url: `/s/${linkRows[0].token}` });
});

router.delete("/api/storage/item/:id", requireAuth, async (req, res) => {
  const id = req.params.id;

  const { rows } = await q(
    `SELECT id, owner_user_id, is_folder, storage_path
       FROM storage_items
      WHERE id=$1`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });

  const item = rows[0];
  if (item.owner_user_id !== req.user.sub) return res.status(403).json({ error: "forbidden" });

  // If it's a file, remove from disk first (best effort)
  if (!item.is_folder && item.storage_path) {
    try { if (fs.existsSync(item.storage_path)) fs.unlinkSync(item.storage_path); } catch {}
  }

  // DB delete (folder cascade removes children + share links via FK if set)
  await q(`DELETE FROM storage_items WHERE id=$1`, [id]);

  res.json({ ok: true });
});

// Share with an internal user by username
router.post("/api/storage/share-internal", requireAuth, async (req, res) => {
  const { itemId, username } = req.body;
  
  // 1. Find the target user ID
  const { rows: users } = await q("SELECT id FROM users WHERE user_name=$1", [username]);
  if (!users.length) return res.status(404).json({ error: "User not found" });
  const targetUserId = users[0].id;

  if (targetUserId === req.user.sub) return res.status(400).json({ error: "Cannot share with yourself" });

  // 2. Verify you own the item
  const { rows: items } = await q("SELECT id FROM storage_items WHERE id=$1 AND owner_user_id=$2", [itemId, req.user.sub]);
  if (!items.length) return res.status(403).json({ error: "Item not found or denied" });

  // 3. Insert into ACL using your existing table structure
  await q(
    `INSERT INTO storage_item_acl (item_id, grantee_user_id, can_read)
     VALUES ($1, $2, true)
     ON CONFLICT (item_id, grantee_user_id) DO NOTHING`,
    [itemId, targetUserId]
  );

  res.json({ ok: true });
});

// Add this route to your Express app
router.get("/api/searchUsers", requireAuth, async (req, res) => {
    const query = req.query.q || '';
    
    if (query.length < 2) {
        return res.json([]);
    }
    
    const { rows } = await q(
        `SELECT id, user_name, real_name, profile_pic_path 
         FROM users 
         WHERE user_name ILIKE $1 OR real_name ILIKE $1 
         LIMIT 20`,
        [`%${query}%`]
    );
    
    res.json(rows);
});

export default router;
