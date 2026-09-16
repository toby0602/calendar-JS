/* Run with Node.js and Playwright available on NODE_PATH. No production dependencies. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    res.end(content);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForSelector('.day-button');
    assert.equal(await page.locator('.day-button').count(), 42);
    assert.equal(await page.locator('#note-dialog .eyebrow').count(), 0);
    const officialDays = await page.evaluate(() => [
      OfficialCalendar.getDayInfo('2026-02-20'),
      OfficialCalendar.getDayInfo('2026-09-26'),
      OfficialCalendar.getDayInfo('2025-02-08'),
      OfficialCalendar.getDayInfo('2028-01-01')
    ]);
    assert.deepEqual(officialDays[0], { isHoliday: true, note: '補假' });
    assert.equal(officialDays[1].isHoliday, true);
    assert.equal(officialDays[2].isWeekendWorkday, true);
    assert.equal(officialDays[3], null);
    const holidayCounts = await page.evaluate(() => [2026, 2027].map(year => {
      let count = 0;
      for (let month = 0; month < 12; month++) {
        const days = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= days; day++) {
          const key = CalendarApp.dateKey(new Date(year, month, day));
          if (OfficialCalendar.getDayInfo(key)?.isHoliday) count++;
        }
      }
      return count;
    }));
    assert.deepEqual(holidayCounts, [120, 121]);
    await page.evaluate(() => { Object.assign(CalendarApp.state, { year: 2026, month: 1 }); CalendarApp.renderMonth(); });
    assert.equal(await page.locator('[data-date="2026-02-20"]').getAttribute('class').then(value => value.includes('is-holiday')), true);
    assert.equal(await page.locator('[data-date="2026-02-20"] .holiday-marker').textContent(), '休');
    await page.locator('[data-date="2026-02-20"]').click();
    assert.match(await page.locator('#note-date').textContent(), /休假日（補假）/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { Object.assign(CalendarApp.state, { year: 2025, month: 1 }); CalendarApp.renderMonth(); });
    assert.equal(await page.locator('[data-date="2025-02-08"] .workday-marker').textContent(), '班');
    await page.evaluate(() => { Object.assign(CalendarApp.state, { year: 2028, month: 0 }); CalendarApp.renderMonth(); });
    assert.equal(await page.locator('#holiday-data-hint').isVisible(), true);
    assert.equal(await page.locator('.is-holiday:not(.outside-month)').count(), 0);
    const annotations = await page.evaluate(() => [
      CalendarDates.getDayDetails(new Date(2026, 1, 16)),
      CalendarDates.getDayDetails(new Date(2026, 1, 17)),
      CalendarDates.getDayDetails(new Date(2026, 5, 19)),
      CalendarDates.getDayDetails(new Date(2026, 8, 25)),
      CalendarDates.getDayDetails(new Date(2026, 3, 5)),
      CalendarDates.getDayDetails(new Date(2025, 6, 25))
    ]);
    assert.ok(annotations[0].festivals.some(item => item.name === '除夕'));
    assert.ok(annotations[1].festivals.some(item => item.name === '春節'));
    assert.ok(annotations[2].festivals.some(item => item.name === '端午節'));
    assert.ok(annotations[3].festivals.some(item => item.name === '中秋節'));
    assert.ok(annotations[4].festivals.some(item => item.name === '清明節'));
    assert.match(annotations[5].lunarFull, /閏六月/);
    assert.equal(annotations[5].festivals.length, 0);
    await page.evaluate(() => { Object.assign(CalendarApp.state, { year: 2026, month: 8 }); CalendarApp.renderMonth(); });
    assert.equal(await page.locator('[data-date="2026-09-25"] .festival-label').textContent(), '中秋節');
    assert.match(await page.locator('[data-date="2026-09-25"]').getAttribute('aria-label'), /農曆八月十五，中秋節/);
    const blueHoliday = await page.locator('[data-date="2026-09-26"]').evaluate(day => ({
      background: getComputedStyle(day).backgroundColor,
      markerBorder: getComputedStyle(day.querySelector('.holiday-marker')).borderColor,
      markerColor: getComputedStyle(day.querySelector('.holiday-marker')).color
    }));
    const outsideHoliday = page.locator('[data-date="2026-10-10"]');
    const outsideHolidayBackground = await outsideHoliday.evaluate(day => getComputedStyle(day).backgroundColor);
    await outsideHoliday.hover();
    await page.waitForFunction(before => getComputedStyle(document.querySelector('[data-date="2026-10-10"]')).backgroundColor !== before, outsideHolidayBackground);
    assert.equal(await page.locator('#current-day-info .local-badge').count(), 1);
    assert.equal(await page.locator('#calendar-title').count(), 0);
    // Date rollover, Gregorian leap years, and neighboring month cells.
    for (const [year, month, count] of [[2024, 1, 29], [2025, 1, 28], [2100, 1, 28], [2000, 1, 29], [2026, 11, 31]]) {
      await page.evaluate(({year, month}) => { Object.assign(CalendarApp.state, { year, month }); CalendarApp.renderMonth(); }, { year, month });
      assert.equal(await page.locator('.day-button:not(.outside-month)').count(), count);
    }
    await page.locator('#next-month').click();
    assert.equal(await page.locator('#cal-year').textContent(), '2027');
    await page.locator('#previous-month').click();
    assert.equal(await page.locator('#cal-year').textContent(), '2026');
    await page.locator('#go-today').click();
    assert.equal(await page.locator('[aria-current="date"]').count(), 1);
    const startingMonth = await page.locator('#cal-month').textContent();
    await page.locator('.calendar-card').dispatchEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    assert.equal(await page.locator('#cal-month').textContent(), startingMonth);
    await page.locator('#choose-month').click();
    assert.equal(await page.locator('#picker-year').inputValue(), String(new Date().getFullYear()));
    await page.locator('#picker-year').fill('2032');
    await page.locator('#picker-months label').filter({ hasText: '4 月' }).click();
    await page.locator('#month-form [type="submit"]').click();
    assert.equal(await page.locator('#cal-year').textContent(), '2032');
    assert.match(await page.locator('#cal-month').textContent(), /^4 月/);
    await page.locator('#choose-month').click();
    await page.locator('#picker-year').fill('2050');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#cal-year').textContent(), '2032');
    await page.locator('#go-today').click();
    const today = await page.locator('[aria-current="date"]').getAttribute('data-date');
    await page.locator('[aria-current="date"]').click();
    const payload = '<img src=x onerror="window.injected=true"> 開會與日常記事';
    await page.locator('#edit-post-it').fill(payload);
    const month = await page.locator('#cal-month').textContent();
    await page.locator('#edit-post-it').press('ArrowLeft');
    assert.equal(await page.locator('#cal-month').textContent(), month);
    await page.locator('#edit-post-it').dispatchEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    assert.equal(await page.locator('#cal-month').textContent(), month);
    assert.equal(await page.locator('#note-dialog').evaluate(d => d.open), true);
    await page.locator('#edit-post-it').press('Control+Enter');
    assert.equal(await page.locator('#note-count').textContent(), '1');
    assert.equal(await page.locator('.note-item p').textContent(), payload);
    const notePlacement = await page.locator(`[data-date="${today}"]`).evaluate(day => {
      const cell = day.getBoundingClientRect();
      const preview = day.querySelector('.note-preview').getBoundingClientRect();
      const lunar = day.querySelector('.lunar-label').getBoundingClientRect();
      return { rightGap: cell.right - preview.right, previewTop: preview.top, previewLeft: preview.left, lunarTop: lunar.top, lunarRight: lunar.right, lunarBottom: lunar.bottom };
    });
    assert.ok(notePlacement.rightGap >= 0 && notePlacement.rightGap <= 12, 'Note preview should sit on the right');
    assert.ok(notePlacement.previewTop > notePlacement.lunarTop, 'Note preview should sit below the lunar date');
    assert.ok(notePlacement.previewLeft >= notePlacement.lunarRight + 4 || notePlacement.previewTop >= notePlacement.lunarBottom + 3, 'Long note preview should not touch the lunar date');
    const noteStyles = await page.evaluate(todayKey => {
      const inMonth = [...document.querySelectorAll('.day-button:not(.is-today):not(.outside-month):not(.has-festival)')][0];
      const outsideMonth = [...document.querySelectorAll('.day-button.outside-month:not(.has-festival)')][0];
      CalendarApp.state.notes[inMonth.dataset.date] = '本月另一則記事';
      CalendarApp.state.notes[outsideMonth.dataset.date] = '跨月記事';
      CalendarApp.renderMonth();
      const styles = date => {
        const style = getComputedStyle(document.querySelector(`[data-date="${date}"] .note-preview`));
        return [style.backgroundColor, style.borderColor, style.borderRightColor, style.fontWeight];
      };
      const result = [styles(todayKey), styles(inMonth.dataset.date), styles(outsideMonth.dataset.date)];
      delete CalendarApp.state.notes[inMonth.dataset.date];
      delete CalendarApp.state.notes[outsideMonth.dataset.date];
      CalendarApp.renderMonth();
      return result;
    }, today);
    assert.deepEqual(noteStyles[0], noteStyles[1], 'Notes in the displayed month should use the same style');
    assert.notDeepEqual(noteStyles[0], noteStyles[2], 'Notes outside the displayed month should be visually distinct');
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.equal(await page.locator('#month-notes img').count(), 0);
    await page.reload();
    assert.equal(await page.locator('.note-item p').textContent(), payload);
    await page.locator('.note-item').click();
    await page.locator('#edit-post-it').fill('更新後的記事\n第二行');
    await page.locator('#note-form [type="submit"]').click();
    assert.equal(await page.locator('#note-count').textContent(), '1');
    await page.locator('.note-item').click();
    await page.locator('#edit-post-it').fill('   ');
    await page.locator('#note-form [type="submit"]').click();
    assert.ok(await page.locator('#note-error').textContent());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#note-dialog').evaluate(d => d.open), false);
    await page.locator('.outside-month').first().click();
    assert.equal(await page.locator('#edit-post-it').inputValue(), '');
    assert.equal(await page.locator('#delete-button').isVisible(), false);
    await page.keyboard.press('Escape');
    await page.locator('#open-theme').click();
    await page.locator('.color-option').filter({ hasText: '森林綠' }).click();
    await page.locator('#theme-form [type="submit"]').click();
    await page.reload();
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--primary')), '#286047');
    await page.evaluate(() => { Object.assign(CalendarApp.state, { year: 2026, month: 8 }); CalendarApp.renderMonth(); });
    const greenHoliday = await page.locator('[data-date="2026-09-26"]').evaluate(day => ({
      background: getComputedStyle(day).backgroundColor,
      markerBorder: getComputedStyle(day.querySelector('.holiday-marker')).borderColor,
      markerColor: getComputedStyle(day.querySelector('.holiday-marker')).color
    }));
    assert.notEqual(greenHoliday.background, blueHoliday.background);
    assert.notEqual(greenHoliday.markerBorder, blueHoliday.markerBorder);
    assert.notEqual(greenHoliday.markerColor, blueHoliday.markerColor);
    await page.locator('#open-theme').click();
    await page.locator('.color-option').filter({ hasText: '靜謐藍' }).click();
    await page.locator('#theme-form [type="submit"]').click();
    const screenshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-qa-'));
    for (const [width, height] of [[320, 640], [375, 812], [390, 844], [480, 800], [768, 1024], [800, 600], [844, 390], [1024, 768], [1440, 1000], [1920, 1080]]) {
      await page.setViewportSize({ width, height });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}x${height}`);
      if (width === 390) {
        const currentMonth = await page.locator('#cal-month').textContent();
        await page.locator('.calendar-card').dispatchEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
        assert.equal(await page.locator('#cal-month').textContent(), currentMonth);
      }
      for (const id of ['note-dialog', 'theme-dialog', 'month-dialog']) {
        await page.locator(id === 'note-dialog' ? '#add-today' : id === 'theme-dialog' ? '#open-theme' : '#choose-month').click();
        const bounds = await page.locator('#' + id).boundingBox();
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1, `Dialog outside viewport: ${width}x${height} ${id}`);
        assert.ok(await page.locator('#' + id).evaluate(d => d.scrollWidth <= d.clientWidth), `Dialog horizontal overflow: ${width} ${id}`);
        if (width === 390 && id === 'month-dialog') await page.screenshot({ path: path.join(screenshotDir, '390-picker.png') });
        await page.keyboard.press('Escape');
      }
      if ([320, 390, 768, 1024, 1440].includes(width)) {
        await page.locator('#open-theme').click();
        await page.locator('#theme-form [type="submit"]').click();
        const toast = await page.locator('#status-message').boundingBox();
        assert.ok(Math.abs(toast.x + toast.width / 2 - width / 2) <= 1 && Math.abs(toast.y + toast.height / 2 - height / 2) <= 1, `Status message is not centered at ${width}x${height}`);
        await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); document.getElementById('status-message').textContent = ''; });
        await page.screenshot({ path: path.join(screenshotDir, `${width}.png`), fullPage: true });
      }
    }
    await page.locator(`[data-date="${today}"]`).click();
    await page.locator('#delete-button').click();
    await page.reload();
    assert.equal(await page.locator('#note-count').textContent(), '0');
    // Storage failures must retain the draft and must not report success.
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; });
    await page.locator('#add-today').click();
    await page.locator('#edit-post-it').fill('不能遺失的草稿');
    await page.locator('#note-form [type="submit"]').click();
    assert.equal(await page.locator('#edit-post-it').inputValue(), '不能遺失的草稿');
    assert.ok(await page.locator('#note-error').textContent());
    await page.reload();
    await page.evaluate(() => localStorage.setItem('my-calendar.notes.v1', '{broken'));
    await page.reload();
    assert.equal(await page.locator('.day-button').count(), 42);
    assert.equal(await page.evaluate(() => localStorage.getItem('my-calendar.notes.v1')), '{broken');
    assert.deepEqual(errors, []);
    console.log('PASS: 10 viewports, lunar dates, Taiwan festivals, DGPA holidays and workdays, month picker, modal bounds, leap years, year rollover, note CRUD/persistence, text safety, theme persistence, and storage failures.');
    console.log('Screenshots: ' + screenshotDir);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
