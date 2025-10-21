import 'dotenv/config';
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/auth.js";
import protectedRoutes from "./routes/protected.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// serve only the files in /public
app.use(express.static(path.join(__dirname, "public")));

app.use(authRoutes);
app.use(protectedRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
