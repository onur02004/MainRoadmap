import 'dotenv/config';
import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 10,                 // small pool for demo
  idleTimeoutMillis: 10_000
});

// tiny helper for one-off queries (await q(sql, [params]))
export const q = (text, params) => pool.query(text, params);
