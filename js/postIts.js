"use strict";

(() => {
  const app = CalendarApp;
  const { $, state } = app;
  const storageKey = "my-calendar.notes.v1";
  let storageInvalid = false;
  function loadNotes() {
    try {
      const raw = localStorage.getItem(storageKey);
      const data = raw ? JSON.parse(raw) : {};
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid notes");
      const notes = {};
      for (const [key, value] of Object.entries(data)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || app.dateKey(app.parseDate(key)) !== key || typeof value !== "string" || value.length > 2000) throw new Error("Invalid note");
        if (value.trim()) notes[key] = value;
      }
      state.notes = notes;
      storageInvalid = false;
    } catch {
      storageInvalid = true;
      app.notify("無法讀取本機記事。請檢查瀏覽器儲存設定；現有資料不會被覆寫。");
    }
  }
  function saveNotes(next) {
    try {
      if (storageInvalid) throw new Error("Storage unavailable");
      localStorage.setItem(storageKey, JSON.stringify(next));
      state.notes = next;
      return true;
    } catch {
      $("note-error").textContent = "儲存失敗，請檢查瀏覽器儲存空間或權限。你的文字仍保留在這裡。";
      return false;
    }
  }
  function openNote(key) {
    state.selectedDate = key;
    $("note-title").textContent = state.notes[key] ? "編輯每日記事" : "新增每日記事";
    const date = app.parseDate(key);
    const details = CalendarDates.getDayDetails(date);
    const holiday = OfficialCalendar.getDayInfo(key);
    const dayOff = holiday?.isHoliday ? `休假日${holiday.note ? `（${holiday.note}）` : ""}` : holiday?.isWeekendWorkday ? `上班日（${holiday.note}）` : "";
    $("note-date").textContent = [app.dateLabel(date), details.lunarFull, ...details.festivals.map((item) => item.name), dayOff].filter(Boolean).join(" · ");
    $("edit-post-it").value = state.notes[key] || "";
    $("note-length").textContent = `${$("edit-post-it").value.length} / 2000`;
    $("note-error").textContent = "";
    $("delete-button").hidden = !state.notes[key];
    $("note-dialog").showModal();
    $("edit-post-it").focus();
  }
  function finish(message) {
    const key = state.selectedDate;
    $("note-dialog").close();
    const focusedDate = document.activeElement?.dataset.date;
    app.renderMonth();
    if (focusedDate) document.querySelector(`[data-date="${key}"]`)?.focus();
    else if (document.activeElement === document.body) $("go-today").focus();
    app.notify(message);
  }
  function renderNotes() {
    const prefix = `${state.year}-${String(state.month + 1).padStart(2, "0")}-`;
    const notes = Object.entries(state.notes).filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
    $("note-count").textContent = notes.length;
    const container = $("month-notes");
    container.replaceChildren();
    if (!notes.length) {
      container.className = "empty-notes";
      const icon = document.createElement("span");
      icon.className = "empty-icon";
      icon.textContent = "▤";
      icon.setAttribute("aria-hidden", "true");
      const text = document.createElement("div");
      const heading = document.createElement("h4");
      heading.textContent = "留一筆，給未來的自己。";
      const hint = document.createElement("p");
      hint.textContent = "這個月還沒有記事，點選日期開始記錄吧。";
      text.append(heading, hint);
      container.append(icon, text);
      return;
    }
    container.className = "note-list";
    for (const [key, note] of notes) {
      const button = document.createElement("button");
      button.className = "note-item";
      button.type = "button";
      const date = document.createElement("time");
      date.dateTime = key;
      date.textContent = `${Number(key.slice(5, 7))} 月 ${Number(key.slice(8))} 日`;
      const text = document.createElement("p");
      text.textContent = note;
      const arrow = document.createElement("span");
      arrow.textContent = "↗";
      arrow.setAttribute("aria-hidden", "true");
      button.append(date, text, arrow);
      button.addEventListener("click", () => openNote(key));
      container.append(button);
    }
  }
  Object.assign(app, { loadNotes, openNote, renderNotes });
  $("note-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const note = $("edit-post-it").value.trim();
    if (!note) {
      $("note-error").textContent = "請先寫下一點內容，再儲存記事。";
      $("edit-post-it").focus();
      return;
    }
    if (saveNotes({ ...state.notes, [state.selectedDate]: note })) finish("記事已儲存在此瀏覽器。");
  });
  $("delete-button").addEventListener("click", () => {
    const next = { ...state.notes };
    delete next[state.selectedDate];
    if (saveNotes(next)) finish("記事已刪除。");
  });
  $("edit-post-it").addEventListener("input", () => {
    $("note-length").textContent = `${$("edit-post-it").value.length} / 2000`;
    $("note-error").textContent = "";
  });
  $("edit-post-it").addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      $("note-form").requestSubmit();
    }
  });
})();
