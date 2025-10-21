import jwt from "jsonwebtoken";
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

export const getJwtSecret = () => JWT_SECRET;

export default function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send("Not authorized Token Yok. <a href='/login.html'>Login</a>");
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).send("Session expired. <a href='/login.html'>Login again</a>");
  }
}
