const express = require('express');
const path = require('node:path');
const { randomBytes, createHash, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { AppError } = require('./errors.cjs');
const derive = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');
const sessionAge = 7 * 24 * 60 * 60 * 1000;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await derive(password, salt, 64)).toString('hex');
}
async function verifyPassword(password, encoded) {
  const [salt, hash] = encoded.split(':');
  const derived = await derive(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
function validDate(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || Number(key.slice(0, 4)) < 1000) return false;
  const date = new Date(key + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === key;
}
function validNote(note) { return typeof note === 'string' && note.trim().length > 0 && note.length <= 2000; }

function createApp({ store = null, origin, production = false, allowRegistration = true } = {}) {
  const app = express();
  const root = path.resolve(__dirname, '..');
  const attempts = new Map();
  const dummyHash = hashPassword(randomBytes(32).toString('hex'));
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const allowedOrigin = origin || `http://${req.get('host')}`;
        if (req.get('origin') !== allowedOrigin) return res.status(403).json({ error: '請從網站本身送出操作。' });
        if (!req.is('application/json')) return res.status(415).json({ error: '請使用 JSON 格式。' });
      }
    }
    next();
  });
  app.use('/api', express.json({ limit: '3mb' }));
  app.get('/js/config.js', (_req, res) => res.type('js').set('Cache-Control', 'no-store').send(`window.CalendarConfig = ${JSON.stringify({ apiBase: store ? '/api' : '' })};`));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', storage: store ? 'mysql' : 'local' }));
  app.use('/api', (req, res, next) => {
    if (!store) return res.status(503).json({ error: 'MySQL 模式尚未啟用。' });
    next();
  });
  const tokenOf = req => {
    const token = (req.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith('calendar_session='))?.slice('calendar_session='.length);
    return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
  };
  const currentUser = async req => { const token = tokenOf(req); return token ? store.getSession(digest(token)) : null; };
  const issueSession = async (res, user) => {
    const token = randomBytes(32).toString('hex');
    await store.createSession(digest(token), user.id, new Date(Date.now() + sessionAge));
    res.cookie('calendar_session', token, { httpOnly: true, secure: production, sameSite: 'lax', maxAge: sessionAge, path: '/' });
  };
  const requireUser = async (req, _res, next) => {
    req.user = await currentUser(req);
    if (!req.user) throw new AppError(401, '登入已過期，請重新登入。');
    if (req.get('X-Calendar-User') && req.get('X-Calendar-User') !== String(req.user.id)) throw new AppError(409, '此瀏覽器已切換帳號。請先複製草稿，再重新整理並登入。', 'ACCOUNT_CHANGED');
    next();
  };
  const rateLimit = (req, _res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    const key = req.ip;
    const attempt = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    if (attempt.count >= 20 || attempts.size >= 10000) throw new AppError(429, '登入嘗試過於頻繁，請稍後再試。');
    attempt.count++;
    attempts.set(key, attempt);
    next();
  };
  app.get('/api/session', async (req, res) => res.json({ user: (await currentUser(req)) || null }));
  app.post('/api/auth/:action', rateLimit, async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,32}$/.test(username) || typeof password !== 'string' || password.length < 10 || password.length > 128) throw new AppError(400, '帳號需為 3–32 位英數字或底線，密碼需為 10–128 個字元。');
    const name = username.toLowerCase();
    let user;
    if (req.params.action === 'register') {
      if (!allowRegistration) throw new AppError(403, '目前暫停註冊。');
      user = await store.createUser(name, await hashPassword(password));
    } else if (req.params.action === 'login') {
      user = await store.findUser(name);
      const valid = await verifyPassword(password, user?.password_hash || await dummyHash);
      if (!user || !valid) throw new AppError(401, '帳號或密碼不正確。');
    } else throw new AppError(404, '找不到此操作。');
    // Rotate the current session if one is already present.
    const oldToken = tokenOf(req);
    if (oldToken) await store.deleteSession(digest(oldToken));
    await issueSession(res, user);
    res.status(req.params.action === 'register' ? 201 : 200).json({ user: { id: user.id, username: user.username } });
  });
  app.post('/api/logout', async (req, res) => {
    const token = tokenOf(req);
    if (token) await store.deleteSession(digest(token));
    res.clearCookie('calendar_session', { path: '/', httpOnly: true, secure: production, sameSite: 'lax' });
    res.status(204).end();
  });
  app.get('/api/notes', requireUser, async (req, res) => res.json({ notes: await store.getNotes(req.user.id) }));
  app.put('/api/notes/:date', requireUser, async (req, res) => {
    const { value, expected } = req.body || {};
    if (!validDate(req.params.date) || (value !== null && !validNote(value)) || typeof expected !== 'string' || expected.length > 2000) throw new AppError(400, '日期或記事內容不正確；每筆記事最多 2,000 字元，年份需介於 1000–9999。');
    res.json({ notes: await store.changeNote(req.user.id, req.params.date, value === null ? null : value.trim(), expected) });
  });
  app.post('/api/notes/import', requireUser, async (req, res) => {
    const notes = req.body?.notes;
    if (!notes || typeof notes !== 'object' || Array.isArray(notes) || Object.keys(notes).length > 1000 || Object.entries(notes).some(([key,value]) => !validDate(key) || !validNote(value))) throw new AppError(400, '匯入資料不正確；每次最多 1,000 筆記事。');
    res.json(await store.importNotes(req.user.id, Object.fromEntries(Object.entries(notes).map(([key,value]) => [key,value.trim()]))));
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: '找不到此 API。' }));
  for (const directory of ['css', 'js', 'images']) app.use('/' + directory, express.static(path.join(root, directory), { dotfiles: 'deny', index: false }));
  app.get(['/', '/index.html'], (_req, res) => res.sendFile(path.join(root, 'index.html')));
  app.use((_req, res) => res.sendStatus(404));
  app.use((error, _req, res, _next) => {
    const status = error.status || 500;
    if (status === 500) console.error('API error:', error.code || error.name);
    res.status(status).json({ error: status >= 500 ? '伺服器暫時無法處理，請稍後再試。' : error.type === 'entity.parse.failed' ? 'JSON 格式不正確。' : error.message, code: error.code });
  });
  return app;
}
module.exports = { createApp };
