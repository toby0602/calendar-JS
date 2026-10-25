const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../server/app.cjs');
const { MemoryStore } = require('./memory-store.cjs');

async function contract(store) {
  const origin = 'http://calendar.test';
  const server = createApp({ store, origin }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  const users = [];
  async function request(route, { method = 'GET', cookie, body, requestOrigin = origin } = {}) {
    const response = await fetch(url + route, { method, headers: { ...(requestOrigin ? { Origin: requestOrigin } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { response, status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  try {
    assert.equal((await request('/api/notes')).status, 401);
    assert.equal((await request('/api/auth/register', { method: 'POST', body: { username: 'bad', password: 'short' } })).status, 400);
    const suffix = randomBytes(6).toString('hex');
    const register = async name => {
      const result = await request('/api/auth/register', { method: 'POST', body: { username: name + suffix, password: 'test-password-123' } });
      assert.equal(result.status, 201); users.push(result.body.user.id);
      const cookie = result.response.headers.get('set-cookie');
      assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i);
      assert.notEqual((await store.findUser(name + suffix)).password_hash, 'test-password-123');
      return cookie.split(';')[0];
    };
    const a = await register('usera'); const b = await register('userb');
    const put = (date, value, expected = '', cookie = a) => request('/api/notes/' + date, { method: 'PUT', cookie, body: { value, expected } });
    const injectionText = "中文記事 '); DROP TABLE calendar_notes; --";
    assert.equal((await put('2026-09-17', injectionText)).status, 200);
    assert.deepEqual((await request('/api/notes', { cookie: b })).body.notes, {});
    assert.equal((await put('2026-09-17', '另一帳號', '', b)).status, 200);
    const concurrent = await Promise.all([put('2026-09-18', 'A'), put('2026-09-19', 'B')]);
    assert.ok(concurrent.every(result => result.status === 200));
    assert.equal(Object.keys((await request('/api/notes', { cookie: a })).body.notes).length, 3);
    assert.equal((await put('2026-09-17', '新版', injectionText)).status, 200);
    const conflict = await put('2026-09-17', '舊版覆蓋', injectionText);
    assert.equal(conflict.status, 409); assert.equal(conflict.body.code, 'CONFLICT');
    assert.equal((await put('2026-02-30', '不存在的日期')).status, 400);
    assert.equal((await put('2026-09-20', 'x'.repeat(2001))).status, 400);
    const imported = await request('/api/notes/import', { method: 'POST', cookie: a, body: { notes: { '2026-09-17': '不能覆蓋雲端', '2026-09-20': '本機記事' } } });
    assert.equal(imported.body.imported, 1); assert.equal(imported.body.skipped, 1);
    assert.equal(imported.body.notes['2026-09-17'], '新版');
    assert.equal((await put('2026-09-17', null, '新版')).status, 200);
    assert.equal((await request('/api/notes', { cookie: b })).body.notes['2026-09-17'], '另一帳號');
    assert.equal((await request('/api/logout', { method: 'POST', cookie: a, body: {}, requestOrigin: 'https://untrusted.example' })).status, 403);
    assert.equal((await request('/api/logout', { method: 'POST', cookie: a, body: {}, requestOrigin: null })).status, 403);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: { username: 'usera' + suffix, password: 'wrong-password' } })).status, 401);
    const login = await request('/api/auth/login', { method: 'POST', body: { username: 'usera' + suffix, password: 'test-password-123' } });
    assert.equal(login.status, 200);
    const loginCookie = login.response.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/api/session', { cookie: loginCookie })).body.user.username, 'usera' + suffix);
    await request('/api/logout', { method: 'POST', cookie: loginCookie, body: {} });
    assert.equal((await request('/api/notes', { cookie: loginCookie })).status, 401);
    for (const file of ['/.env', '/server/schema.sql', '/package.json']) assert.equal((await fetch(url + file)).status, 404);
    return users;
  } finally {
    if (store.pool) for (const id of users) await store.pool.execute('DELETE FROM calendar_users WHERE id = ?', [id]);
    await new Promise(resolve => server.close(resolve));
  }
}

test('API: login, user isolation, conflicts, import, validation and private files', () => contract(new MemoryStore()));

test('MySQL: the same API contract against real transactions', { skip: process.env.RUN_MYSQL_TESTS !== '1' }, async () => {
  if (!process.env.DB_NAME?.endsWith('_test')) throw new Error('Integration tests require a dedicated DB_NAME ending in _test');
  const { createPool, migrate } = require('../server/db.cjs');
  const { MySQLStore } = require('../server/mysql-store.cjs');
  const pool = createPool();
  try { await migrate(pool); await contract(new MySQLStore(pool)); }
  finally { await pool.end(); }
});
