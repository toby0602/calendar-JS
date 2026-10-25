"use strict";

// Shared state; the app stays dependency-free and can run directly from index.html.
window.CalendarApp = (() => {
  const today = new Date();
  const state = { year: today.getFullYear(), month: today.getMonth(), notes: {}, selectedDate: null };
  const $ = (id) => document.getElementById(id);
  const { dateKey, parseDate, dateLabel } = CalendarDateUtils;
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
    $("previous-month").disabled = state.year === CalendarApp.minYear && state.month === 0;
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
        button.disabled = date.getFullYear() < CalendarApp.minYear || date.getFullYear() > 9999;
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
    if (next.getFullYear() < CalendarApp.minYear || next.getFullYear() > 9999) return;
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
  return { state, minYear: 100, $, dateKey, parseDate, dateLabel, notify, updateToday, renderMonth, moveMonth, goToday };
})();
