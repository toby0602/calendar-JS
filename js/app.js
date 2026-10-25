"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const app = CalendarApp;
  await app.loadNotes();
  app.initTheme();
  await app.initAccount();
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
    if (!Number.isInteger(year) || year < app.minYear || year > 9999 || !Number.isInteger(month) || month < 0 || month > 11) return;
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
  let pendingDayRefresh = false;
  function refreshDay() {
    const current = app.dateKey(new Date());
    if (current !== lastToday) {
      lastToday = current;
      pendingDayRefresh = true;
      app.updateToday();
    }
    if (pendingDayRefresh && !document.querySelector("dialog[open]")) {
      const focusedDate = document.activeElement?.dataset.date;
      pendingDayRefresh = false;
      app.renderMonth();
      if (focusedDate) document.querySelector(`[data-date="${focusedDate}"]`)?.focus();
    }
  }
  document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("close", refreshDay));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshDay(); });
  setInterval(refreshDay, 60000);
});
