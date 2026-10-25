// Test double only. Production always uses MySQLStore.
const { AppError } = require('../server/errors.cjs');
class MemoryStore {
  users = new Map(); sessions = new Map(); notes = new Map();
  async createUser(username, password_hash) {
    if ([...this.users.values()].some(user => user.username === username)) throw new AppError(409, '此帳號已被使用。');
    const user = { id: this.users.size + 1, username, password_hash };
    this.users.set(user.id, user); return { ...user };
  }
  async findUser(username) { return [...this.users.values()].find(user => user.username === username); }
  async createSession(hash, userId, expires) { this.sessions.set(hash, { userId, expires }); }
  async getSession(hash) {
    const entry = this.sessions.get(hash);
    const user = entry && entry.expires > new Date() ? this.users.get(entry.userId) : null;
    return user ? { id: user.id, username: user.username } : null;
  }
  async deleteSession(hash) { this.sessions.delete(hash); }
  async getNotes(id) { return { ...this.notes.get(id) }; }
  async changeNote(id, date, value, expected) {
    const notes = this.notes.get(id) || {};
    if ((notes[date] || '') !== expected) throw new AppError(409, '記事已更新，請保留草稿後重開。', 'CONFLICT');
    if (value === null) delete notes[date]; else notes[date] = value;
    this.notes.set(id, notes); return { ...notes };
  }
  async importNotes(id, incoming) {
    const notes = this.notes.get(id) || {}; let imported = 0;
    for (const [key,value] of Object.entries(incoming)) if (!Object.hasOwn(notes,key)) { notes[key] = value; imported++; }
    this.notes.set(id, notes);
    return { notes: { ...notes }, imported, skipped: Object.keys(incoming).length - imported };
  }
}
module.exports = { MemoryStore };
