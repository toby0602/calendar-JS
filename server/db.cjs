const mysql = require('mysql2/promise');
const fs = require('node:fs');
const path = require('node:path');

function createPool(env = process.env) {
  if (!env.DB_USER || !env.DB_PASSWORD || !env.DB_NAME) throw new Error('請在 .env 設定 DB_USER、DB_PASSWORD、DB_NAME，再啟動 MySQL 模式。');
  const ssl = env.DB_SSL === 'true' ? { rejectUnauthorized: true, ...(env.DB_SSL_CA ? { ca: fs.readFileSync(env.DB_SSL_CA) } : {}) } : undefined;
  return mysql.createPool({
    host: env.DB_HOST || '127.0.0.1', port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
    charset: 'utf8mb4', dateStrings: true, timezone: 'Z',
    connectionLimit: 5, enableKeepAlive: true, ssl
  });
}

async function migrate(pool) {
  const source = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  for (const sql of source.split(';').map(value => value.trim()).filter(Boolean)) await pool.query(sql);
}

module.exports = { createPool, migrate };
