import jwt from "jsonwebtoken";
import { getJwtSecret } from "./requireAuth.js"; 
import { logUserActivity } from "../db/activity.js";

export const trackActivity = async (req, res, next) => {
  const token = req.cookies?.token;

  // 1. FILTERING: Exclude Images & Static Assets
  const ignoredPrefixes = [
      '/content',   // Public CSS/JS folder
      '/features',  // Public Features folder
      '/media',     
      '/favicon.ico',
      '/health',
      '/meinfo',
      '/api/session'
  ];

  const ignoredExtensions = [
      // Images
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', 
      // Code & Fonts
      '.css', '.js', '.map', '.woff', '.woff2', '.ttf'          
  ];

  const path = req.path.toLowerCase();

  // Check if path is in the ignore list
  const isIgnoredPath = ignoredPrefixes.some(prefix => path.startsWith(prefix));
  const isIgnoredExt  = ignoredExtensions.some(ext => path.endsWith(ext));

  if (isIgnoredPath || isIgnoredExt) {
    return next(); // Skip logging, pass to next handler
  }

  // 2. LOGGING: Only log if User is Authenticated
  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      if (decoded && decoded.sub) {
        
        // Optional: Filter out "GET /api/..." if you ONLY want Page Views
        // if (path.startsWith('/api') && req.method === 'GET') return next();

        const type = req.method === 'GET' ? 'VIEW' : 'ACTION';
        logUserActivity(decoded.sub, type, req);
      }
    } catch (err) {
      // Invalid token, just skip
    }
  }

  next();
};