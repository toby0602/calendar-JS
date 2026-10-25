const { createApp } = require('./app.cjs');
const { createPool } = require('./db.cjs');
const { MySQLStore } = require('./mysql-store.cjs');

(async () => {
  const production = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);
  const origin = process.env.APP_ORIGIN || `http://localhost:${port}`;
  if (production && !origin.startsWith('https://')) throw new Error('正式環境需設定 HTTPS APP_ORIGIN。');
  const mysqlEnabled = process.env.STORAGE_MODE === 'mysql' || process.argv.includes('--mysql');
  const pool = mysqlEnabled ? createPool() : null;
  if (pool) {
    try { await pool.query('SELECT 1 FROM calendar_users LIMIT 1'); }
    catch (error) { await pool.end(); throw error; }
  }
  const app = createApp({ store: pool ? new MySQLStore(pool) : null, origin, production, allowRegistration: process.env.ALLOW_REGISTRATION !== 'false' });
  const server = app.listen(port, production ? '0.0.0.0' : '127.0.0.1', () => console.log(`Calendar: ${origin} (${mysqlEnabled ? 'MySQL' : 'local browser storage'})`));
  const stop = () => server.close(async () => { if (pool) await pool.end(); });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
})().catch(error => { console.error('啟動失敗：', error.code || error.message); process.exitCode = 1; });
