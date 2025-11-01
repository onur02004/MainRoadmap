import jwt from "jsonwebtoken";
import 'dotenv/config';
import { q } from "../db/pool.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export const getJwtSecret = () => JWT_SECRET;

export default function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
      return res.redirect("/login");
    //return res.status(401).send("Not authorized Token Yok. <a href='/login.html'>Login</a>");
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    console.log("User authenticated:", req.user);
    next();
    return;
  } catch {
    return res.status(401).send("Session expired. <a href='/login.html'>Login again</a>");
  }
}

export function requireFeature(featureKey) {
  return async (req, res, next) => {
    const { rows } = await q(
      `SELECT 1
         FROM user_features uf
         JOIN features f ON f.id = uf.feature_id
        WHERE uf.user_id=$1 AND f.key=$2
        LIMIT 1`,
      [req.user.sub, featureKey]
    );
    console.log('user id: ' + req.user.sub);
    if (!rows.length) return res.status(403).json({ error: 'Feature not allowed' });
    next();
  };
}


export function canAccessOWNFile(req, res, next) {
  //SADECE KENDI DOSYASINA ULASABILIR
  //orn: app.get("/content/:username/:fileName", requireAuth, canAccessFile, (req, res) => {}

  const requester = req.user;        // e.g. { username: "onur", role: "admin" }
  const targetUser = req.params.username;

  if (requester.username === targetUser) {
    return next();
  }

  return res.status(403).json({ error: "forbidden" });
}


