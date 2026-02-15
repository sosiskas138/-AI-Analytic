import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set — проверьте .env или переменные окружения контейнера');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // Log only slow queries (>100ms) in production
    if (duration > 100 || process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error', error);
    throw error;
  }
}
