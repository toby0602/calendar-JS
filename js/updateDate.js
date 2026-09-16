"use strict";

// Shared state; the app stays dependency-free and can run directly from index.html.
window.CalendarApp = (() => {
  const today = new Date();
  const state = { year: today.getFullYear(), month: today.getMonth(), notes: {}, selectedDate: null };
  const $ = (id) => document.getElementById(id);
  const dateKey = (date) => `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const parseDate = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  };
  const dateLabel = (date) => new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(date);
  let statusTimer;
  function notify(message) {
    clearTimeout(statusTimer);
    $("status-message").textContent = message;
    statusTimer = setTimeout(() => { $("status-message").textContent = ""; }, 2000);
  }
  function updateToday() {
    const now = new Date();
    $("today-date").dateTime = dateKey(now);
    $("cur-day-of-month").textContent = now.getDate();
    $("cur-year").textContent = now.getFullYear();
    $("cur-month").textContent = now.getMonth() + 1;
    $("cur-day").textContent = new Intl.DateTimeFormat("zh-TW", { weekday: "long" }).format(now);
  }
  function renderMonth() {
    $("cal-year").textContent = state.year;
    $("cal-month").textContent = `${state.month + 1} 月`;
    const english = document.createElement("small");
    english.textContent = new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(state.year, state.month, 1));
    $("cal-month").append(english);
    $("choose-month").setAttribute("aria-label", `選擇年月，目前是 ${state.year} 年 ${state.month + 1} 月`);
    $("holiday-data-hint").hidden = OfficialCalendar.hasYear(state.year);
    document.querySelector("table").setAttribute("aria-label", `${state.year} 年 ${state.month + 1} 月月曆`);
    $("previous-month").disabled = state.year === 100 && state.month === 0;
    $("next-month").disabled = state.year === 9999 && state.month === 11;
    const first = new Date(state.year, state.month, 1);
    const fragment = document.createDocumentFragment();
    const todayKey = dateKey(new Date());
    for (let week = 0; week < 6; week++) {
      const row = document.createElement("tr");
      for (let weekday = 0; weekday < 7; weekday++) {
        const date = new Date(state.year, state.month, 1 - first.getDay() + week * 7 + weekday);
        const key = dateKey(date);
        const details = CalendarDates.getDayDetails(date);
        const holiday = OfficialCalendar.getDayInfo(key);
        const cell = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.disabled = date.getFullYear() < 100 || date.getFullYear() > 9999;
        button.className = "day-button";
        button.dataset.date = key;
        button.classList.toggle("outside-month", date.getMonth() !== state.month);
        button.classList.toggle("is-today", key === todayKey);
        button.classList.toggle("has-festival", details.festivals.length > 0);
        button.classList.toggle("has-note", Boolean(state.notes[key]));
        button.classList.toggle("is-holiday", holiday?.isHoliday === true);
        button.classList.toggle("is-weekend-workday", holiday?.isWeekendWorkday === true);
        if (key === todayKey) button.setAttribute("aria-current", "date");
        button.setAttribute("aria-label", [dateLabel(date), details.lunarFull, ...details.festivals.map((item) => item.name), holiday?.isHoliday ? `休假日${holiday.note ? `，${holiday.note}` : ""}` : holiday?.isWeekendWorkday ? `上班日，${holiday.note}` : "", state.notes[key] ? "有記事" : "新增記事"].filter(Boolean).join("，"));
        const number = document.createElement("span");
        number.className = "date-number";
        number.textContent = date.getDate();
        button.append(number);
        if (holiday?.isHoliday || holiday?.isWeekendWorkday) {
          const marker = document.createElement("span");
          marker.className = holiday.isHoliday ? "holiday-marker" : "workday-marker";
          marker.textContent = holiday.isHoliday ? "休" : "班";
          marker.setAttribute("aria-hidden", "true");
          button.append(marker);
        }
        if (details.lunarLabel) {
          const lunarLabel = document.createElement("span");
          lunarLabel.className = "lunar-label";
          lunarLabel.textContent = details.lunarLabel;
          lunarLabel.setAttribute("aria-hidden", "true");
          button.append(lunarLabel);
        }
        if (details.festivals.length) {
          const festivalLabel = document.createElement("span");
          festivalLabel.className = "festival-label";
          festivalLabel.textContent = details.festivals[0].short;
          festivalLabel.setAttribute("aria-hidden", "true");
          button.append(festivalLabel);
        }
        if (state.notes[key]) {
          const preview = document.createElement("span");
          preview.className = "note-preview";
          // User text must never be parsed as markup.
          preview.textContent = state.notes[key];
          const dot = document.createElement("span");
          dot.className = "note-dot";
          dot.setAttribute("aria-hidden", "true");
          button.append(preview, dot);
        }
        cell.append(button);
        row.append(cell);
      }
      fragment.append(row);
    }
    $("table-body").replaceChildren(fragment);
    if (CalendarApp.renderNotes) CalendarApp.renderNotes();
  }
  function moveMonth(offset) {
    const next = new Date(state.year, state.month + offset, 1);
    if (next.getFullYear() < 100 || next.getFullYear() > 9999) return;
    state.year = next.getFullYear();
    state.month = next.getMonth();
    renderMonth();
  }
  function goToday() {
    const now = new Date();
    state.year = now.getFullYear();
    state.month = now.getMonth();
    updateToday();
    renderMonth();
  }
  return { state, $, dateKey, parseDate, dateLabel, notify, updateToday, renderMonth, moveMonth, goToday };
})();

document.addEventListener("DOMContentLoaded", () => {
  const app = CalendarApp;
  app.loadNotes();
  app.initTheme();
  app.updateToday();
  app.renderMonth();
  app.$("previous-month").addEventListener("click", () => app.moveMonth(-1));
  app.$("next-month").addEventListener("click", () => app.moveMonth(1));
  app.$("go-today").addEventListener("click", app.goToday);
  app.$("choose-month").addEventListener("click", () => {
    app.$("picker-year").value = app.state.year;
    document.querySelector(`input[name="month"][value="${app.state.month}"]`).checked = true;
    app.$("month-dialog").showModal();
    app.$("picker-year").focus();
  });
  app.$("month-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const year = Number(app.$("picker-year").value);
    const month = Number(new FormData(event.currentTarget).get("month"));
    if (!Number.isInteger(year) || year < 100 || year > 9999 || !Number.isInteger(month) || month < 0 || month > 11) return;
    app.state.year = year;
    app.state.month = month;
    app.renderMonth();
    app.$("month-dialog").close();
    app.$("choose-month").focus();
  });
  app.$("add-today").addEventListener("click", () => { app.goToday(); app.openNote(app.dateKey(new Date())); });
  app.$("table-body").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-date]");
    if (button) app.openNote(button.dataset.date);
  });
  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => app.$(button.dataset.close).close());
  });
  // Native modal dialogs handle Escape, focus trapping and focus restoration.
  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || document.querySelector("dialog[open]") || event.target.closest("input,textarea,select,[contenteditable]")) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const wasDate = event.target.closest(".day-button");
    const day = wasDate ? app.parseDate(wasDate.dataset.date).getDate() : null;
    app.moveMonth(event.key === "ArrowLeft" ? -1 : 1);
    if (wasDate) {
      const lastDay = new Date(app.state.year, app.state.month + 1, 0).getDate();
      const key = app.dateKey(new Date(app.state.year, app.state.month, Math.min(day, lastDay)));
      document.querySelector(`[data-date="${key}"]`).focus();
    }
  });
  let lastToday = app.dateKey(new Date());
  function refreshDay() {
    const current = app.dateKey(new Date());
    if (current !== lastToday) {
      lastToday = current;
      app.updateToday();
      if (!document.querySelector("dialog[open]")) app.renderMonth();
    }
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshDay(); });
  setInterval(refreshDay, 60000);
});
