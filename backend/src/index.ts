import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import projectsRoutes from './routes/projects.js';
import callsRoutes from './routes/calls.js';
import suppliersRoutes from './routes/suppliers.js';
import importsRoutes from './routes/imports.js';
import importCsvRoutes from './routes/import-csv.js';
import reanimationRoutes from './routes/reanimation.js';
import statisticsRoutes from './routes/statistics.js';
import settingsRoutes from './routes/settings.js';
import { query } from './config/database.js';
import { hashPassword } from './config/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware: allow multiple origins (comma-separated) for dev (e.g. http://localhost,http://localhost:8080)
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost';
const corsOrigins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0] || 'http://localhost',
  credentials: true,
}));
// Increase body size limit for CSV imports
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Подсказка при открытии корня backend напрямую (интерфейс — через nginx)
app.get('/', (req, res) => {
  const host = (req.get('host') || req.get('x-forwarded-host') || 'localhost').replace(/:\d+$/, '');
  const appPort = process.env.APP_PORT || '8080';
  const appUrl = host === 'localhost' ? `http://localhost:${appPort}` : `http://${host}:${appPort}`;
  res.type('html').send(`
    <!DOCTYPE html>
    <html><body style="font-family:sans-serif;padding:2rem;max-width:520px;">
      <h1>Аналитика звонков — API</h1>
      <p>Вы открыли сервер API напрямую. Интерфейс приложения — через nginx:</p>
      <p><a href="${appUrl}">${appUrl}</a></p>
      <p><small>VPS: откройте порт ${appPort} в фаерволе. Локально: http://localhost:${appPort}</small></p>
    </body></html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Диагностика БД: подключение и количество записей в таблицах
app.get('/api/debug/db', async (_req, res) => {
  const hasUrl = !!process.env.DATABASE_URL;
  const urlSafe = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')
    : null;
  try {
    await query('SELECT 1');
    const tables = [
      'users',
      'projects',
      'project_members',
      'suppliers',
      'supplier_numbers',
      'calls',
      'import_jobs',
      'reanimation_exports',
    ];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const r = await query(`SELECT COUNT(*)::int as c FROM ${table}`);
      counts[table] = Number((r.rows[0] as { c: number }).c);
    }
    res.json({
      connected: true,
      database_url_set: hasUrl,
      database_url_preview: urlSafe,
      tables: counts,
    });
  } catch (e: any) {
    res.status(500).json({
      connected: false,
      database_url_set: hasUrl,
      database_url_preview: urlSafe,
      error: e?.message || String(e),
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/imports', importsRoutes);
app.use('/api/import-csv', importCsvRoutes);
app.use('/api/reanimation', reanimationRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler (return JSON so frontend never gets HTML error page)
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Слушаем порт сразу — иначе при медленной/недоступной БД сайт не грузится
app.listen(Number(PORT), HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  // Проверка БД и seed — асинхронно, не блокируют приём запросов
  (async function initDb() {
    try {
      await query('SELECT 1');
      console.log('Database: connected');
    } catch (e) {
      console.error('Database: connection failed', (e as Error).message);
      return;
    }
    try {
      const userCount = await query('SELECT COUNT(*)::text as count FROM users');
      const count = parseInt(String((userCount.rows[0] as any)?.count || '0'), 10);
      if (count === 0) {
        const email = 'admin@app.local';
        const hash = await hashPassword('admin1');
        await query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
          [email, hash]
        );
        await query(
          `INSERT INTO profiles (user_id, full_name)
           SELECT id, 'Administrator' FROM users WHERE email = $1
           ON CONFLICT (user_id) DO NOTHING`,
          [email]
        );
        await query(
          `INSERT INTO user_roles (user_id, role)
           SELECT id, 'admin'::app_role FROM users WHERE email = $1
           ON CONFLICT (user_id, role) DO NOTHING`,
          [email]
        );
        console.log('Database: seed admin created (login: admin, password: admin1)');
      }
    } catch (e) {
      console.error('Database: seed failed', (e as Error).message);
    }
  })();
});
