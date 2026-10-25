"use strict";

// The UI depends on read/change rather than on localStorage itself.
window.CalendarLocalNotes = (() => {
  const storageKey = "my-calendar.notes.v1";
  function read() {
    const raw = localStorage.getItem(storageKey);
    const data = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid notes");
    const notes = {};
    for (const [key, value] of Object.entries(data)) {
      if (!CalendarDateUtils.validKey(key) || typeof value !== "string" || value.length > 2000) throw new Error("Invalid note");
      if (value.trim()) notes[key] = value;
    }
    return notes;
  }
  async function change(key, value, expected) {
    const commit = () => {
      const notes = read();
      if ((notes[key] || "") !== expected) {
        const error = new Error("此日期的記事已在另一個分頁更新。請先複製目前文字，再關閉並重新開啟記事，以查看最新內容。");
        error.code = "CONFLICT";
        throw error;
      }
      if (value === null) delete notes[key];
      else notes[key] = value;
      localStorage.setItem(storageKey, JSON.stringify(notes));
      return notes;
    };
    // Web Locks serialize simultaneous writes across tabs on HTTPS/localhost.
    if (navigator.locks?.request) return navigator.locks.request(storageKey, commit);
    return commit();
  }
  return { read, change, storageKey };
})();
