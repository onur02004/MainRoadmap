import jwt from "jsonwebtoken";
import 'dotenv/config';
import { q } from "../db/pool.js";
import { logUserActivity } from "../db/activity.js";

const JWT_SECRET = process.env.JWT_SECRET;

export const getJwtSecret = () => JWT_SECRET;

export default function requireAuth(req, res, next) {
  let token = req.cookies?.token;

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring("Bearer ".length).trim();
  }

  if (!token) {
    // If it's an API call, return JSON 401 instead of redirect
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Not authorized" });
    }

    // Normal web routes → redirect to login
    return res.redirect("/login");
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    console.log("User authenticated:", req.user);
    next();
  } catch {
    // For simplicity: JSON 401 for APIs, plain 401 for others
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ error: "Session expired or invalid token" });
    }
    return res.status(401).send("Session expired or invalid token");
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