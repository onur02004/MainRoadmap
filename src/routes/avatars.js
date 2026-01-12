import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import requireAuth from "../middleware/requireAuth.js";
import { q } from "../db/pool.js";
import { sendEmail } from "../helpers/emailHelper.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


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

// POST /api/me/update-password
router.post("/api/me/update-password", requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });

  try {
    // In a real app, hash the password. 
    // Given the '12345' preference, we still hash for database safety.
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    await q(
      `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
      [req.user.sub, hash]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update password" });
  }
});

// POST /api/me/confirm-email (The "Is this email correct?" prompt)
router.post("/api/me/confirm-email-by-user-prompt", requireAuth, async (req, res) => {
  const { confirmed } = req.body; // true or false
  try {
    await q(
      `UPDATE users SET email_confirmed_by_user = $2, updated_at = NOW() WHERE id = $1`,
      [req.user.sub, confirmed]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to confirm email" });
  }
});

router.post("/api/me/update-email", requireAuth, async (req, res) => {
  const { newEmail } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!newEmail || !emailRegex.test(newEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    const userEmail = newEmail.toLowerCase().trim();

    await q(
      `UPDATE users 
       SET email = $2, 
           email_verified = false, 
           email_confirmed_by_user = NULL, 
           updated_at = NOW() 
       WHERE id = $1`,
      [req.user.sub, userEmail]
    );

    // Generate a temporary token (expires in 24 hours)
    const verificationToken = jwt.sign(
      { sub: req.user.sub, type: 'email-verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Construct the link (Replace with your actual domain)
    const verificationLink = `https://330nur.org/api/verify-email?token=${verificationToken}`;

    // Send the email with a styled button
    await sendEmail(
      userEmail,
      "Verify your roadmap access",
      `<h1>Identity Confirmation</h1>
       <p>Click the link below to activate your roadmap path:</p>
       <a href="${verificationLink}" style="padding: 10px 20px; background: #52c471; color: #131313; text-decoration: none; font-weight: bold;">
         VERIFY EMAIL
       </a>
       <p>If the button doesn't work, copy and paste this: ${verificationLink}</p>`
    );

    res.json({ ok: true, message: "Email updated. Please check your inbox for the verification link." });

  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: "This email is already in use" });
    }
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/api/verify-email", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Verification token is missing.");
  }

  try {
    // 1. Verify the token using your existing JWT secret
    // We import jwt here or at the top of the file
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.sub; // Using 'sub' to match your requireAuth.js pattern

    // 2. Update the database to verify the user
    const result = await q(
      `UPDATE users SET email_verified = true, updated_at = NOW(), email_confirmed_by_user = true WHERE id = $1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).send("User not found.");
    }

    // 3. Serve the success HTML file
    // This assumes verification-success.html is in /src/public/
    const successPagePath = path.join(projectRoot, "src", "public", "verification-success.html");
    return res.sendFile(successPagePath);

  } catch (err) {
    console.error("Verification error:", err);
    return res.status(400).send("The verification link is invalid or has expired.");
  }
});

export default router;
