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

router.get('/st', requireAuth, requireFeature('st'), (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public',
        'features', 
        'sportakip.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending sportakip.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});

router.get('/wl', requireAuth, requireFeature('wl'), (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public',
        'features', 
        'wishlist.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending wishlist.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});

router.get('/simo', requireAuth, requireFeature('simo'), (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public',
        'features', 
        'simo.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending simo.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});

router.get('/olmekistemiyorum', requireAuth, requireFeature('olmekistemiyorum'), (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public',
        'features', 
        'olmekistemiyorum.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending olmekistemiyorum.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});

router.get('/ense25', requireAuth, requireFeature('ense25'), (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public',
        'features', 
        'dgkoense2025.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending dgkoense2025.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});

router.get('/dgkoense2025morepicpage', requireAuth, requireFeature('ense25'), (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public',
        'features', 
        'dgkoense2025morepicpage.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending dgkoense2025morepicpage.html:", err);
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

router.get("/song-share", requireAuth, (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public', 
        'songshare.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending songshare.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});

router.get("/file-storage", requireAuth, (req, res) => {
  const projectRoot = path.join(__dirname, '../..');

  const filePath = path.join(
        projectRoot, 
        'src', 
        'public', 
        'fileStorage.html'
    );

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error sending fileStorage.html:", err);
      res.status(500).send("Internal Server Error: Could not load page (Hata Bi sn)");
    }
  });
});


export default router;
