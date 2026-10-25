"use strict";

(() => {
  const app = CalendarApp;
  const { $, state } = app;
  app.notesStore = CalendarLocalNotes;
  let baseNote = "";
  let saving = false;
  async function loadNotes() {
    try {
      state.notes = await app.notesStore.read();
      return true;
    } catch {
      app.notify("無法讀取記事。請檢查儲存設定或連線；現有資料不會被覆寫。");
      return false;
    }
  }
  async function saveNote(value) {
    if (saving) return;
    saving = true;
    $("note-form").querySelectorAll("button").forEach(button => { button.disabled = true; });
    try {
      state.notes = await app.notesStore.change(state.selectedDate, value, baseNote);
      finish(value === null ? "記事已刪除。" : "記事已儲存。");
    } catch (error) {
      $("note-error").textContent = error.code === "CONFLICT" ? error.message : "儲存失敗，請檢查儲存空間、權限或連線。你的文字仍保留在這裡。";
    } finally {
      saving = false;
      $("note-form").querySelectorAll("button").forEach(button => { button.disabled = false; });
    }
  }
  async function openNote(key) {
    await loadNotes();
    state.selectedDate = key;
    baseNote = state.notes[key] || "";
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
    saveNote(note);
  });
  $("delete-button").addEventListener("click", () => {
    saveNote(null);
  });
  $("note-dialog").addEventListener("cancel", event => { if (saving) event.preventDefault(); });
  window.addEventListener("storage", async event => {
    if (app.notesStore !== CalendarLocalNotes || (event.key !== CalendarLocalNotes.storageKey && event.key !== null)) return;
    if (!await loadNotes()) return;
    if ($("note-dialog").open) {
      if ((state.notes[state.selectedDate] || "") !== baseNote) $("note-error").textContent = "另一個分頁已更新此記事。儲存前請先複製草稿，再重新開啟記事。";
      app.renderNotes();
    } else if (!document.querySelector("dialog[open]")) app.renderMonth();
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
