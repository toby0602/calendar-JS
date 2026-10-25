const { AppError } = require('./errors.cjs');

class MySQLStore {
  constructor(pool) { this.pool = pool; }
  async createUser(username, passwordHash) {
    try {
      const [result] = await this.pool.execute('INSERT INTO calendar_users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
      return { id: result.insertId, username };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw new AppError(409, '此帳號已被使用。');
      throw error;
    }
  }
  async findUser(username) {
    const [rows] = await this.pool.execute('SELECT id, username, password_hash FROM calendar_users WHERE username = ?', [username]);
    return rows[0];
  }
  async createSession(tokenHash, userId, expires) {
    await this.pool.execute('DELETE FROM calendar_sessions WHERE expires_at < UTC_TIMESTAMP(3)');
    await this.pool.execute('INSERT INTO calendar_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [tokenHash, userId, expires]);
  }
  async getSession(tokenHash) {
    const [rows] = await this.pool.execute('SELECT u.id, u.username FROM calendar_sessions s JOIN calendar_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3)', [tokenHash]);
    return rows[0];
  }
  async deleteSession(tokenHash) { await this.pool.execute('DELETE FROM calendar_sessions WHERE token_hash = ?', [tokenHash]); }
  async getNotes(userId, connection = this.pool) {
    const [rows] = await connection.execute('SELECT note_date, content FROM calendar_notes WHERE user_id = ? ORDER BY note_date', [userId]);
    return Object.fromEntries(rows.map(row => [row.note_date, row.content]));
  }
  async transaction(userId, callback) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      // Lock the owner even when a date has no row yet, preventing concurrent inserts.
      const [owners] = await connection.execute('SELECT id FROM calendar_users WHERE id = ? FOR UPDATE', [userId]);
      if (!owners.length) throw new AppError(401, '請重新登入。');
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async changeNote(userId, date, value, expected) {
    return this.transaction(userId, async connection => {
      const [rows] = await connection.execute('SELECT content FROM calendar_notes WHERE user_id = ? AND note_date = ? FOR UPDATE', [userId, date]);
      if ((rows[0]?.content || '') !== expected) throw new AppError(409, '這筆記事已在其他分頁或裝置更新。請先複製草稿，再重新開啟記事。', 'CONFLICT');
      if (value === null) await connection.execute('DELETE FROM calendar_notes WHERE user_id = ? AND note_date = ?', [userId, date]);
      else await connection.execute('INSERT INTO calendar_notes (user_id, note_date, content) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE content = ?', [userId, date, value, value]);
      return this.getNotes(userId, connection);
    });
  }
  async importNotes(userId, incoming) {
    return this.transaction(userId, async connection => {
      const existing = await this.getNotes(userId, connection);
      let imported = 0;
      for (const [date, content] of Object.entries(incoming)) {
        if (Object.hasOwn(existing, date)) continue;
        await connection.execute('INSERT INTO calendar_notes (user_id, note_date, content) VALUES (?, ?, ?)', [userId, date, content]);
        imported++;
      }
      return { notes: await this.getNotes(userId, connection), imported, skipped: Object.keys(incoming).length - imported };
    });
  }
}
module.exports = { MySQLStore };
