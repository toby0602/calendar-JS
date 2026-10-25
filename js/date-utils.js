"use strict";

window.CalendarDateUtils = (() => {
  const dateKey = (date) => `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function parseDate(key) {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }
  const dateLabel = (date) => new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(date);
  const validKey = (key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(parseDate(key)) === key && Number(key.slice(0, 4)) >= 100;
  return { dateKey, parseDate, dateLabel, validKey };
})();
