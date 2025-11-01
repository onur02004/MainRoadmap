import 'dotenv/config';
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/auth.js";
import protectedRoutes from "./routes/protected.js";
import requireAuth from "./middleware/requireAuth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // <- this is .../src

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


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
    return res.status(404).json({ error: "not found" });
  }

  // send file
  res.sendFile(absolutePath, (err) => {
    if (err) {
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

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
