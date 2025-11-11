import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// project root: /src/..
const projectRoot = path.join(__dirname, "..", "..");

// Base: /src/public/media/avatars
const AVATAR_BASE = path.join(projectRoot, "src", "public", "media", "avatars");

// GET /api/avatars  -> auto-index people & images by scanning folders
router.get("/api/avatars", requireAuth, (_req, res) => {
  try {
    if (!fs.existsSync(AVATAR_BASE)) return res.json({ people: [] });

    const people = fs.readdirSync(AVATAR_BASE, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(dir => {
        const key = dir.name; // e.g., "metehan"
        const dirPath = path.join(AVATAR_BASE, key);
        const images = (fs.readdirSync(dirPath, { withFileTypes: true }) || [])
          .filter(f => f.isFile() && /\.(jpe?g|png|webp|gif)$/i.test(f.name))
          .map(f => {
            const rel = path.posix.join("avatars", key, f.name); // store relative under /media
            return {
              file: f.name,
              // URL your frontend can use directly (protected by /media/*)
              url: `/media/${rel}`
            };
          });

        return { key, name: key, images };
      });

    res.json({ people });
  } catch (err) {
    console.error("List avatars failed:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /api/me/profile-picture { path: "avatars/metehan/01.jpg" }
router.post("/api/me/profile-picture", requireAuth, async (req, res) => {
  try {
    const { path: relPath } = req.body || {};
    if (!relPath || typeof relPath !== "string") {
      return res.status(400).json({ error: "Missing path" });
    }

    // Build absolute path and make sure it lives under AVATAR_BASE
    const absolute = path.join(AVATAR_BASE, relPath.replace(/^avatars\//, ""));
    if (!absolute.startsWith(AVATAR_BASE)) {
      return res.status(400).json({ error: "Invalid path" });
    }
    if (!fs.existsSync(absolute)) {
      return res.status(404).json({ error: "Image not found" });
    }

    // save relative (e.g., "avatars/metehan/01.jpg") into users.profile_pic_path
    await q(
      `UPDATE users SET profile_pic_path = $2, updated_at = NOW() WHERE id = $1`,
      [req.user.sub, `avatars/${relPath.replace(/^avatars\//, "")}`]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Set profile picture failed:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
