import jwt from "jsonwebtoken";
import 'dotenv/config';
import { q } from "../db/pool.js";
import { logUserActivity } from "../db/activity.js"; // <--- Import the helper

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export const getJwtSecret = () => JWT_SECRET;

export default function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
      return res.redirect("/login");
  }
  
  try {
    // 1. Verify Token
    req.user = jwt.verify(token, JWT_SECRET);
    // console.log("User authenticated:", req.user);

    next();
    return;
  } catch (err) {
    return res.status(401).send("Session expired. <a href='/login.html'>Login again</a>");
  }
}

export function requireFeature(featureKey) {
  return async (req, res, next) => {
    // Check if user has the specific feature
    const { rows } = await q(
      `SELECT 1
         FROM user_features uf
         JOIN features f ON f.id = uf.feature_id
        WHERE uf.user_id=$1 AND f.key=$2
        LIMIT 1`,
      [req.user.sub, featureKey]
    );

    if (!rows.length) {
      logUserActivity(req.user.sub, 'FEATURE_DENIED', req);
      return res.status(403).json({ error: 'Feature not allowed' });
    }

    // Optional: Log the successful feature access
    // logUserActivity(req.user.sub, `FEATURE_${featureKey.toUpperCase()}`, req);
    
    next();
  };
}

export function canAccessOWNFile(req, res, next) {
  const requester = req.user; 
  const targetUser = req.params.username;

  if (requester.username === targetUser) {
    return next();
  }
  
  // Log unauthorized file access attempt
  logUserActivity(requester.sub, 'FILE_ACCESS_DENIED', req);
  
  return res.status(403).json({ error: "forbidden" });
}