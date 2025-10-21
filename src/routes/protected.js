import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";

const router = Router();

router.get("/dashboard", requireAuth, (req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Dashboard</title></head>
      <body style="font-family:system-ui;margin:2rem">
        <h1>Welcome, ${req.user.name || req.user.uname} 🎉</h1>
        <p>Your role: <b>${req.user.role}</b></p>
        <p>This page is protected and only visible when logged in.</p>
        <form method="post" action="/logout">
          <button type="submit">Logout</button>
        </form>
        <p><a href="/">Back to Home</a></p>
      </body>
    </html>
  `);
});

export default router;
