"use strict";

(() => {
  const app = CalendarApp;
  const { $, state } = app;
  const apiBase = window.CalendarConfig?.apiBase;
  let user = null;
  let busy = false;
  async function request(route, method = "GET", body) {
    const response = await fetch(apiBase + route, {
      method, credentials: "same-origin", cache: "no-store",
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(route.startsWith("/notes") && user ? { "X-Calendar-User": String(user.id) } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const data = response.status === 204 ? {} : await response.json();
    if (!response.ok) {
      const error = new Error(data.error || "同步失敗，請稍後再試。");
      error.code = data.code || (response.status === 401 ? "SESSION_EXPIRED" : "API_ERROR");
      throw error;
    }
    return data;
  }
  const cloudStore = {
    read: async () => (await request("/notes")).notes,
    change: async (date, value, expected) => (await request("/notes/" + encodeURIComponent(date), "PUT", { value, expected })).notes,
    importNotes: notes => request("/notes/import", "POST", { notes })
  };
  async function activate(nextUser) {
    // Fetch before replacing the displayed account; never show one user's notes under another identity.
    const previousUser = user;
    user = nextUser;
    let notes;
    try { notes = nextUser ? await cloudStore.read() : CalendarLocalNotes.read(); }
    catch (error) { user = previousUser; throw error; }
    app.notesStore = nextUser ? cloudStore : CalendarLocalNotes;
    app.minYear = nextUser ? 1000 : 100;
    $("picker-year").min = app.minYear;
    if (state.year < app.minYear) { state.year = new Date().getFullYear(); state.month = new Date().getMonth(); }
    state.notes = notes;
    $("storage-label").textContent = nextUser ? "帳號記事" : "本機記事";
    $("open-account").textContent = nextUser ? "同步帳號" : "登入同步";
    app.renderMonth();
    renderAccount();
  }
  function renderAccount() {
    $("account-fields").hidden = Boolean(user);
    $("account-login").hidden = Boolean(user);
    $("account-register").hidden = Boolean(user);
    $("account-logout").hidden = !user;
    $("account-summary").textContent = user ? `已登入 ${user.username}。記事儲存在此帳號，主題偏好仍保存在目前瀏覽器。` : "登入後，記事會儲存在 MySQL 帳號資料中。未登入時可繼續使用本機記事。";
    let count = 0;
    try { count = Object.keys(CalendarLocalNotes.read()).length; } catch { /* Invalid local data must never be uploaded. */ }
    $("account-import").hidden = !user || count === 0;
    $("account-import").textContent = `匯入 ${count} 筆本機記事至此帳號`;
    $("account-import-hint").hidden = !user || count === 0;
    for (const input of $("account-fields").querySelectorAll("input")) input.disabled = Boolean(user);
  }
  async function action(callback) {
    if (busy) return;
    busy = true;
    $("account-error").textContent = "";
    $("account-form").querySelectorAll("button").forEach(button => { button.disabled = true; });
    try { await callback(); }
    catch (error) { $("account-error").textContent = error.message || "無法連線，請稍後再試。"; }
    finally {
      busy = false;
      $("account-form").querySelectorAll("button").forEach(button => { button.disabled = false; });
    }
  }
  app.initAccount = async () => {
    if (!apiBase) return;
    $("open-account").hidden = false;
    $("open-account").addEventListener("click", () => {
      renderAccount(); $("account-error").textContent = "";
      $("account-dialog").showModal();
    });
    $("account-dialog").addEventListener("cancel", event => { if (busy) event.preventDefault(); });
    $("account-form").addEventListener("submit", event => {
      event.preventDefault();
      const mode = event.submitter?.value || "login";
      action(async () => {
        const result = await request("/auth/" + mode, "POST", { username: $("account-username").value, password: $("account-password").value });
        await activate(result.user);
        $("account-password").value = "";
        app.notify("已登入，正在使用帳號記事。");
      });
    });
    $("account-logout").addEventListener("click", () => action(async () => {
      await request("/logout", "POST", {});
      // Discard account data in memory even if local storage has become unreadable.
      user = null; state.notes = {}; app.notesStore = CalendarLocalNotes; app.minYear = 100;
      $("picker-year").min = 100;
      await app.loadNotes();
      $("storage-label").textContent = "本機記事"; $("open-account").textContent = "登入同步";
      app.renderMonth(); renderAccount();
      app.notify("已登出，回到本機記事。");
    }));
    $("account-import").addEventListener("click", () => action(async () => {
      const result = await request("/notes/import", "POST", { notes: CalendarLocalNotes.read() });
      state.notes = result.notes; app.renderMonth(); renderAccount();
      $("account-error").textContent = `已匯入 ${result.imported} 筆；${result.skipped} 筆日期已有帳號記事，已略過。本機原始記事仍保留。`;
    }));
    try {
      const session = await request("/session");
      if (session.user) await activate(session.user);
    } catch { app.notify("無法連接同步服務，目前使用本機記事。"); }
    document.addEventListener("visibilitychange", async () => {
      if (document.hidden || document.querySelector("dialog[open]")) return;
      try {
        const session = await request("/session");
        if (session.user?.id !== user?.id || user) await activate(session.user);
      } catch { /* Keep the current screen; a save failure retains the draft. */ }
    });
  };
})();
