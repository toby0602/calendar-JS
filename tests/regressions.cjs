const assert = require('node:assert/strict');

async function openPage(context, url, time = '2026-09-17T04:00:00Z') {
  const page = await context.newPage();
  await page.clock.install({ time: new Date(time) });
  await page.goto(url);
  await page.waitForSelector('.day-button');
  return page;
}

async function edit(page, date, text) {
  await page.locator(`[data-date="${date}"]`).click();
  await page.locator('#edit-post-it').fill(text);
}

async function submit(page) {
  await page.locator('#note-form [type="submit"]').click();
  await page.locator('#note-dialog').waitFor({ state: 'hidden' });
}

async function testMultiTab(browser, url) {
  const context = await browser.newContext({ timezoneId: 'Asia/Taipei' });
  try {
    const a = await openPage(context, url);
    const b = await openPage(context, url);
    await edit(a, '2026-09-16', '分頁 A');
    await edit(b, '2026-09-17', '分頁 B');
    await Promise.all([submit(a), submit(b)]);
    const read = () => a.evaluate(() => JSON.parse(localStorage.getItem('my-calendar.notes.v1')));
    assert.deepEqual(await read(), { '2026-09-16': '分頁 A', '2026-09-17': '分頁 B' });
    await edit(a, '2026-09-16', '新版記事');
    await edit(b, '2026-09-16', '不能遺失的舊分頁草稿');
    await submit(a);
    await b.locator('#note-form [type="submit"]').click();
    await b.waitForFunction(() => document.getElementById('note-error').textContent.includes('另一個分頁'));
    assert.equal(await b.locator('#note-dialog').evaluate(dialog => dialog.open), true);
    assert.equal(await b.locator('#edit-post-it').inputValue(), '不能遺失的舊分頁草稿');
    assert.equal((await read())['2026-09-16'], '新版記事');
    await b.keyboard.press('Escape');
    await b.locator('[data-date="2026-09-16"]').click();
    assert.equal(await b.locator('#edit-post-it').inputValue(), '新版記事');
    await b.locator('#delete-button').click();
    await b.locator('#note-dialog').waitFor({ state: 'hidden' });
    assert.deepEqual(await read(), { '2026-09-17': '分頁 B' });
  } finally { await context.close(); }
}

async function testMidnight(browser, url) {
  const context = await browser.newContext({ timezoneId: 'Asia/Taipei' });
  try {
    for (const trigger of ['#open-theme', '#choose-month', '#add-today']) {
      const page = await openPage(context, url, '2026-09-17T15:59:30Z');
      await page.locator(trigger).click();
      if (trigger === '#add-today') await page.locator('#edit-post-it').fill('午夜仍在編輯的草稿');
      await page.clock.runFor(61000);
      assert.equal(await page.locator('#cur-day-of-month').textContent(), '18');
      if (trigger === '#add-today') assert.equal(await page.locator('#edit-post-it').inputValue(), '午夜仍在編輯的草稿');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('[aria-current="date"]')?.dataset.date === '2026-09-18');
      await page.close();
    }
  } finally { await context.close(); }
}

module.exports = { openPage, testMultiTab, testMidnight };
