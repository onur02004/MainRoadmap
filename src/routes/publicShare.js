import express from "express";
import path from "node:path";
import fs from "node:fs";
import { q } from "../db/pool.js";

const router = express.Router();

// Define path to templates
const TEMPLATE_DIR = path.join(process.cwd(), 'src', 'templates');

// --- Helper: Verify Subtree Access ---
async function isDescendantOrSelf(targetId, rootId) {
  if (targetId === rootId) return true;
  let current = targetId;
  while (current) {
    if (current === rootId) return true;
    const { rows } = await q(`SELECT parent_id FROM storage_items WHERE id=$1`, [current]);
    if (!rows.length) return false;
    current = rows[0].parent_id;
  }
  return false;
}

// --- API: List Shared Folder ---
router.get("/api/public-share/:token/list", async (req, res) => {
  const token = req.params.token;
  const folderId = req.query.folderId; 

  const { rows: linkRows } = await q(
    `SELECT item_id, expires_at, allow_subtree FROM storage_share_links WHERE token=$1`,
    [token]
  );
  if (!linkRows.length) return res.status(404).json({ error: "invalid link" });

  const link = linkRows[0];
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: "link expired" });
  }

  const rootId = link.item_id;

  // determine what to list
  const toListId = folderId || rootId;

  // Security checks
  if (!link.allow_subtree && toListId !== rootId) {
    return res.status(403).json({ error: "subtree not allowed" });
  }
  const ok = await isDescendantOrSelf(toListId, rootId);
  if (!ok) return res.status(403).json({ error: "outside shared folder" });

  // Get Folder Info
  const { rows: folderRows } = await q(
    `SELECT id, is_folder, name FROM storage_items WHERE id=$1`,
    [toListId]
  );
  if (!folderRows.length) return res.status(404).json({ error: "folder not found" });

  // Get Children
  const { rows: items } = await q(
    `SELECT id, parent_id, is_folder, name, mime_type, size_bytes
       FROM storage_items
      WHERE parent_id=$1
      ORDER BY is_folder DESC, name ASC`,
    [toListId]
  );

  res.json({
    rootId,
    folder: folderRows[0],
    items,
  });
});

// --- API: Download/Preview Shared File ---
router.get("/api/public-share/:token/file/:fileId", async (req, res) => {
  const token = req.params.token;
  const fileId = req.params.fileId;
  const isPreview = req.query.preview === '1';

  const { rows: linkRows } = await q(
    `SELECT item_id, expires_at, allow_subtree FROM storage_share_links WHERE token=$1`,
    [token]
  );
  if (!linkRows.length) return res.status(404).json({ error: "invalid link" });

  const link = linkRows[0];
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: "link expired" });
  }

  const rootId = link.item_id;

  const ok = await isDescendantOrSelf(fileId, rootId);
  if (!ok) return res.status(403).json({ error: "outside shared scope" });

  const { rows } = await q(
    `SELECT id, is_folder, name, storage_path, mime_type FROM storage_items WHERE id=$1`,
    [fileId]
  );
  if (!rows.length) return res.status(404).json({ error: "not found" });
  const item = rows[0];

  if (item.is_folder) return res.status(400).json({ error: "cannot download folder" });
  if (!item.storage_path || !fs.existsSync(item.storage_path)) return res.status(404).json({ error: "file missing on server" });

  res.setHeader("Content-Type", item.mime_type || "application/octet-stream");
  const disposition = isPreview ? 'inline' : 'attachment';
  res.setHeader("Content-Disposition", `${disposition}; filename="${encodeURIComponent(item.name)}"`);
  res.sendFile(path.resolve(item.storage_path));
});

// --- ROUTE: Serve HTML based on Item Type ---
router.get("/s/:token", async (req, res) => {
  const token = req.params.token;

  try {
    const { rows: linkRows } = await q(
      `SELECT item_id, expires_at FROM storage_share_links WHERE token=$1`,
      [token]
    );
    if (!linkRows.length) return res.status(404).send("Invalid link");
    
    if (linkRows[0].expires_at && new Date(linkRows[0].expires_at).getTime() < Date.now()) {
        return res.status(410).send("Link expired");
    }

    const itemId = linkRows[0].item_id;

    const { rows: itemRows } = await q(
      `SELECT id, is_folder, name, size_bytes, mime_type FROM storage_items WHERE id=$1`,
      [itemId]
    );
    if (!itemRows.length) return res.status(404).send("Shared item not found");

    const item = itemRows[0];

    // Load template logic
    if (item.is_folder) {
        const templatePath = path.join(TEMPLATE_DIR, 'sharedFolder.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // Inject variables
        html = html.replace(/{{TOKEN}}/g, token)
                   .replace(/{{FOLDER_NAME}}/g, item.name);
                   
        res.send(html);
    } else {
        const templatePath = path.join(TEMPLATE_DIR, 'sharedFile.html');
        let html = fs.readFileSync(templatePath, 'utf8');
        
        // Calculate variables
        const fileSize = fmtSize(item.size_bytes);
        const downloadUrl = `/api/public-share/${token}/file/${item.id}`;
        const { previewHtml, cardWidth } = getPreviewData(token, item);

        // Inject variables
        html = html.replace(/{{FILENAME}}/g, item.name)
                   .replace(/{{FILESIZE}}/g, fileSize)
                   .replace(/{{DOWNLOAD_URL}}/g, downloadUrl)
                   .replace('{{PREVIEW_HTML}}', previewHtml)
                   .replace('{{CARD_WIDTH}}', cardWidth);
                   
        res.send(html);
    }

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// --- Helpers ---

function getPreviewData(token, item) {
    const mime = item.mime_type || "";
    const fileUrl = `/api/public-share/${token}/file/${item.id}?preview=1`;
    
    let previewHtml = '';
    let cardWidth = '400px';

    if (mime.startsWith('image/')) {
        previewHtml = `<img src="${fileUrl}" class="preview-media" alt="${item.name}">`;
        cardWidth = '600px';
    } else if (mime.startsWith('video/')) {
        previewHtml = `<video controls class="preview-media"><source src="${fileUrl}" type="${mime}">Your browser does not support video.</video>`;
        cardWidth = '700px';
    } else if (mime.startsWith('audio/')) {
        previewHtml = `<audio controls class="preview-audio"><source src="${fileUrl}" type="${mime}">Your browser does not support audio.</audio>`;
    } else if (mime === 'application/pdf') {
        previewHtml = `<iframe src="${fileUrl}" class="preview-pdf"></iframe>`;
        cardWidth = '800px';
    } else {
        previewHtml = `<div class="file-icon"><i class="fas fa-file-alt"></i></div>`;
    }
    
    return { previewHtml, cardWidth };
}

function fmtSize(bytes) {
    if (bytes == null) return "";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = Number(bytes);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (i === 0 ? v : v.toFixed(1)) + " " + u[i];
}

export default router;