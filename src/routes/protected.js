import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { requireFeature } from "../middleware/requireAuth.js";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import fs from "node:fs";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get("/account", requireAuth, (req, res) => {
  /*
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
  */

  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public', 
        'account.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending account.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});


// Example protected endpoint only users with feature 'x' can call:
router.get('/kt', requireAuth, requireFeature('kt'), (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public',
        'features', 
        'kaloritakip.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending KaloriTakip.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});



router.get("/remote-control", requireAuth, (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public', 
        'remotecontrol.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending remotecontrol.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});




export default router;
