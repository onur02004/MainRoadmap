import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { q } from "../db/pool.js";
import { getJwtSecret } from "../middleware/requireAuth.js";

const router = Router();

function setAuthCookie(res, token) {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: String(process.env.COOKIE_SECURE).toLowerCase() === "true",
    maxAge: 1000 * 60 * 60 // 1h
  });
}

// POST /login
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).send("Missing credentials. <a href='/login.html'>Back</a>");
  }

  // user_name is CITEXT (case-insensitive) in your schema
  const { rows } = await q(
    `SELECT id, user_name, real_name, role, is_verified, password_hash
     FROM users
     WHERE user_name = $1
     LIMIT 1`,
    [username]
  );

  const user = rows[0];
  if (!user) {
    return res.status(401).send("Invalid credentials. <a href='/login.html'>Try again</a>");
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).send("Invalid credentials. <a href='/login.html'>Try again</a>");
  }

  // (Optional) block unverified users:
  // if (!user.is_verified) return res.status(403).send("Please verify your account.");

  const payload = {
    sub: user.id,                // uuid
    uname: user.user_name,       // login name
    name: user.real_name || "",  // display
    role: user.role              // 'user' | 'admin' | 'moderator'
  };

  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRES || "1h" });
  setAuthCookie(res, token);
  return res.redirect("/dashboard");
});

// POST /logout
router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

export default router;
