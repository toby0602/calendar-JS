"use strict";

// Calendar annotations are dates and observances, not an official day-off schedule.
window.CalendarDates = (() => {
  let lunarFormatter;
  try {
    const formatter = new Intl.DateTimeFormat("zh-TW-u-ca-chinese", {
      timeZone: "Asia/Taipei", month: "long", day: "numeric"
    });
    if (formatter.resolvedOptions().calendar === "chinese") lunarFormatter = formatter;
  } catch { /* Keep the Gregorian calendar usable on older browsers. */ }
  const solarFestivals = new Map([
    ["1-1", ["元旦"]], ["2-28", ["和平紀念日", "二二八"]],
    ["3-8", ["婦女節"]], ["3-12", ["植樹節"]], ["3-29", ["青年節"]],
    ["4-4", ["兒童節"]],
    ["5-1", ["勞動節"]], ["8-8", ["父親節"]],
    ["8-1", ["原住民族日"]], ["9-28", ["教師節"]],
    ["10-10", ["國慶日"]],
    ["10-25", ["臺灣光復暨金門古寧頭大捷紀念日", "光復節"]],
    ["12-10", ["人權日"]], ["12-25", ["行憲紀念日", "行憲日"]]
  ]);
  const lunarFestivals = new Map([
    ["正月-1", "春節"], ["正月-15", "元宵節"],
    ["四月-8", "佛誕日"], ["五月-5", "端午節"],
    ["七月-7", "七夕"], ["七月-15", "中元節"],
    ["八月-15", "中秋節"], ["九月-9", "重陽節"]
  ]);
  const lunarDays = [
    "", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"
  ];
  function lunarDate(date) {
    if (!lunarFormatter) return null;
    try {
      // 04:00 UTC is noon in Taiwan on the requested civil date.
      const taipeiNoon = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 4));
      const parts = lunarFormatter.formatToParts(taipeiNoon);
      const month = parts.find((part) => part.type === "month")?.value;
      const day = Number(parts.find((part) => part.type === "day")?.value);
      return month && lunarDays[day] ? { month, day, dayName: lunarDays[day] } : null;
    } catch {
      return null;
    }
  }
  function getDayDetails(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const lunar = lunarDate(date);
    const festivals = [];
    const fixed = solarFestivals.get(`${month}-${day}`);
    if (fixed) festivals.push({ name: fixed[0], short: fixed[1] || fixed[0] });
    // Qingming is a solar term. This 21st-century calculation matches the 2026 DGPA calendar.
    if (year >= 2000 && year <= 2099 && month === 4 && day === Math.floor((year % 100) * 0.2422 + 4.81) - Math.floor((year % 100) / 4)) {
      festivals.push({ name: "清明節", short: "清明節" });
    }
    if (month === 5 && date.getDay() === 0 && day >= 8 && day <= 14) {
      festivals.push({ name: "母親節", short: "母親節" });
    }
    if (lunar && !lunar.month.startsWith("閏")) {
      const festival = lunarFestivals.get(`${lunar.month}-${lunar.day}`);
      if (festival) festivals.push({ name: festival, short: festival });
      if (lunar.month === "臘月") {
        const next = lunarDate(new Date(year, month - 1, day + 1));
        const afterNext = lunarDate(new Date(year, month - 1, day + 2));
        if (next?.month === "正月" && next.day === 1) festivals.push({ name: "除夕", short: "除夕" });
        else if (afterNext?.month === "正月" && afterNext.day === 1) festivals.push({ name: "小年夜", short: "小年夜" });
      }
    }
    return {
      lunarLabel: lunar ? (lunar.day === 1 ? lunar.month : lunar.dayName) : "",
      lunarFull: lunar ? `農曆${lunar.month}${lunar.dayName}` : "",
      festivals
    };
  }
  return { getDayDetails };
})();
