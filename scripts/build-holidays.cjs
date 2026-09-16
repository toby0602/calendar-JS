// Convert the downloaded DGPA CSV files into a compact, browser-ready data file.
// Run: node scripts/build-holidays.cjs
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'data');
const files = fs.readdirSync(dataDir).filter((file) => /^dgpa-\d{4}\.csv$/.test(file)).sort();
if (!files.length) throw new Error('No DGPA CSV files found in data/');

const years = {};
for (const file of files) {
  const year = Number(file.slice(5, 9));
  const content = fs.readFileSync(path.join(dataDir, file), 'utf8').replace(/^\uFEFF/, '').trim();
  const lines = content.split(/\r?\n/);
  if (lines.shift() !== '西元日期,星期,是否放假,備註') throw new Error(`Unexpected CSV headers in ${file}`);
  const holiday = {};
  const workday = {};
  const dates = new Set();
  for (const line of lines) {
    const [rawDate, weekday, flag, ...remarkParts] = line.split(',');
    const remark = remarkParts.join(',').trim();
    if (!/^\d{8}$/.test(rawDate) || !['0', '2'].includes(flag)) throw new Error(`Invalid row in ${file}: ${line}`);
    const y = Number(rawDate.slice(0, 4));
    const month = Number(rawDate.slice(4, 6));
    const day = Number(rawDate.slice(6, 8));
    const date = new Date(Date.UTC(y, month - 1, day));
    if (y !== year || date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) throw new Error(`Invalid date in ${file}: ${rawDate}`);
    const key = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    if (dates.has(key)) throw new Error(`Duplicate date in ${file}: ${key}`);
    dates.add(key);
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    if (flag === '2') holiday[key] = remark;
    else if (isWeekend) workday[key] = remark || '補行上班';
  }
  const daysInYear = new Date(Date.UTC(year + 1, 0, 1)) - new Date(Date.UTC(year, 0, 1));
  if (dates.size !== daysInYear / 86400000) throw new Error(`${file} does not contain every day of ${year}`);
  years[year] = { holiday, workday };
}

const output = [
  '"use strict";',
  '// Generated from the downloaded DGPA office-calendar CSV files by scripts/build-holidays.cjs.',
  'window.OfficialCalendar = (() => {',
  `  const years = ${JSON.stringify(years)};`,
  '  function hasYear(year) { return Object.prototype.hasOwnProperty.call(years, year); }',
  '  function getDayInfo(key) {',
  '    const data = years[key.slice(0, 4)];',
  '    if (!data) return null;',
  '    if (Object.prototype.hasOwnProperty.call(data.holiday, key)) return { isHoliday: true, note: data.holiday[key] };',
  '    if (Object.prototype.hasOwnProperty.call(data.workday, key)) return { isHoliday: false, note: data.workday[key], isWeekendWorkday: true };',
  '    return { isHoliday: false, note: "" };',
  '  }',
  '  return { hasYear, getDayInfo, years: Object.keys(years).map(Number) };',
  '})();',
  ''
].join('\n');
fs.writeFileSync(path.join(root, 'js', 'holidays.js'), output);
console.log(`Generated js/holidays.js for ${Object.keys(years).join(', ')}`);
