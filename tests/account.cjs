const assert = require('node:assert/strict');
const { createApp } = require('../server/app.cjs');
const { MemoryStore } = require('./memory-store.cjs');

async function testAccount(browser) {
  const server = createApp({ store: new MemoryStore() }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const context = await browser.newContext({ timezoneId: 'Asia/Taipei' });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-09-17T04:00:00Z') });
    await page.addInitScript(() => {
      if (!localStorage.getItem('my-calendar.notes.v1')) localStorage.setItem('my-calendar.notes.v1', JSON.stringify({ '2026-09-16': '本機 A', '2026-09-17': '本機 B' }));
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForSelector('.day-button');
    assert.equal(await page.locator('#note-count').textContent(), '2');
    await page.locator('#open-account').click();
    await page.locator('#account-username').fill('browser_user');
    await page.locator('#account-password').fill('test-password-123');
    await page.locator('#account-register').click();
    await page.waitForFunction(() => document.getElementById('storage-label').textContent === '帳號記事');
    // Logging in must not upload local data without the separate import action.
    assert.equal(await page.locator('#note-count').textContent(), '0');
    await page.keyboard.press('Escape');
    await page.locator('[data-date="2026-09-17"]').click();
    await page.locator('#edit-post-it').fill('雲端 B');
    await page.locator('#note-form [type="submit"]').click();
    await page.locator('#note-dialog').waitFor({ state: 'hidden' });
    await page.locator('#open-account').click();
    await page.locator('#account-import').click();
    await page.waitForFunction(() => document.getElementById('account-error').textContent.includes('已匯入 1 筆'));
    assert.match(await page.locator('#account-error').textContent(), /1 筆日期已有/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#note-count').textContent(), '2');
    await page.reload();
    await page.waitForSelector('.day-button');
    assert.equal(await page.locator('#storage-label').textContent(), '帳號記事');
    assert.match(await page.locator('#month-notes').textContent(), /雲端 B/);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('my-calendar.notes.v1'))), { '2026-09-16': '本機 A', '2026-09-17': '本機 B' });
    await page.locator('#open-account').click();
    for (const width of [344, 390, 1440]) {
      await page.setViewportSize({ width, height: 882 });
      const box = await page.locator('#account-dialog').boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.locator('#account-logout').click();
    await page.waitForFunction(() => document.getElementById('storage-label').textContent === '本機記事');
    await page.keyboard.press('Escape');
    assert.match(await page.locator('#month-notes').textContent(), /本機 B/);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
  }
}
module.exports = { testAccount };
