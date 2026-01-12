import 'dotenv/config';
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { exec as execLED } from "node:child_process";

import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import protectedRoutes from "./routes/protected.js";
import requireAuth from "./middleware/requireAuth.js";
import deviceRoutes from "./routes/devices.js";
import fitnessRoutes from "./routes/fitnessRoutes.js";
import avatarsRoutes from "./routes/avatars.js";
import songshareRoutes from "./routes/songshare.js";
import userRoutes from "./routes/userRoutes.js";
import wishlistRouter from './routes/wishlistRoutes.js'; 
import { trackActivity } from "./middleware/activityTracker.js";
import notificationHelper from "./helpers/notificationHelper.js";
import { sendEmail } from "./helpers/emailHelper.js";
import storageRoutes from "./routes/storage.js";
import publicShareRoutes from "./routes/publicShare.js";
import notificationsRoute from "./routes/notifications.js";
import moodRoutes from "./routes/moodRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // <- this is .../src

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(fitnessRoutes);
app.use(deviceRoutes); 
app.use(adminRoutes);
app.use(avatarsRoutes);
app.use(songshareRoutes);
app.use(userRoutes);
app.use(wishlistRouter);
app.use(trackActivity);
app.use(notificationHelper);
app.use(storageRoutes);
app.use(publicShareRoutes);
app.use(notificationsRoute);
app.use(moodRoutes);

//PROTECTED
//PROTECTED
app.get("/media/*", requireAuth, (req, res) => {
  const relativePath = req.params[0]; // "zen.jpg" or "some/folder/file.png"

  // Absolute path to /src/public/media
  const mediaBase = path.join(__dirname, "public", "media");
  const absolutePath = path.join(mediaBase, relativePath);

  // prevent ../../ escape
  if (!absolutePath.startsWith(mediaBase)) {
    return res.status(400).json({ error: "invalid path" });
  }

  // check exists
  if (!fs.existsSync(absolutePath)) {
  // Instead of: return res.status(404).json({ error: "not found" });
  return res.status(404).sendFile(path.join(__dirname, "public", "error.html"));
}

  // send file
  res.sendFile(absolutePath, (err) => {
    if (err) {
      // 1. If the client stopped the download (paused video/closed tab), ignore it.
      if (err.code === 'ECONNABORTED') {
        return; 
      }

      // 2. If headers were already sent (partial download), we can't send a JSON error.
      if (res.headersSent) {
        console.error("Headers already sent. Cannot send 500 error for:", err.message);
        return;
      }

      // 3. Only send a 500 response if the connection is still open
      console.error("Error sending media file:", err);
      return res.status(500).json({ error: "internal error" });
    }
  });
});

//public herkes icin
app.use(
  "/content",
  express.static(path.join(__dirname, "public", "content"))
);
app.use(
  "/features",
  express.static(path.join(__dirname, "public", "features"))
);


app.use(express.static(path.join(__dirname, "public")));


app.use(authRoutes);
app.use(protectedRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mainsite.html"));
});




app.get("/adjustled", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adjustled.html"));
});

app.post("/api/led", (req, res) => {
  const { mode, color } = req.body;

  let cmd;
  if (mode === "color" && color) {
    const [r, g, b] = color.split(",").map(Number);
    cmd = `sudo python3 src/led_control.py color ${r} ${g} ${b}`;
  } else if (mode === "rainbow") {
    cmd = `sudo python3 src/led_control.py rainbow`;
  } else {
    return res.status(400).json({ error: "Invalid mode" });
  }

  execLED(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(stderr);
      return res.status(500).json({ error: "LED command failed" });
    }
    res.json({ ok: true, stdout });
  });
});




app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});

// 404 Handler (Placed after all other routes)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "error.html"));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).sendFile(path.join(__dirname, "public", "error.html"));
});

//setInterval(async () => {
//    try {
//        console.log("Running daily log cleanup...");
//        await q("DELETE FROM user_activity WHERE created_at < NOW() - INTERVAL '10 days'");
//    } catch (err) {
//        console.error("Cleanup failed:", err);
//    }
//}, 864000);