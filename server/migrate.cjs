const { createPool, migrate } = require('./db.cjs');
(async () => {
  const pool = createPool();
  try { await migrate(pool); console.log('資料表已建立（既有資料保留）。'); }
  finally { await pool.end(); }
})().catch(error => { console.error('初始化失敗：', error.code || error.message); process.exitCode = 1; });
