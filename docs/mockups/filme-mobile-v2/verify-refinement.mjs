import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const base = 'http://127.0.0.1:3793/docs/mockups/filme-mobile-v2/index.html';
const output = new URL('./verification/', import.meta.url).pathname;
const key = 'filme-mockup-v2';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const report = { mode: 'Headless Chrome viewport emulation, not iPhone Safari', checks: [], geometry: [], screenshots: [], failures: [], pageErrors: [] };
let page;

async function fresh(width = 393, height = 659, draft) {
  const context = await browser.createBrowserContext();
  page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(String(error)));
  await page.setViewport({ width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.evaluate((name, raw) => {
    localStorage.clear();
    if (raw) localStorage.setItem(name, raw);
  }, key, draft);
  await page.reload({ waitUntil: 'networkidle0' });
  return context;
}

async function button(label, root = 'body') {
  const handle = await page.evaluateHandle((selector, text) =>
    [...(document.querySelector(selector)?.querySelectorAll('button') || [])]
      .find(el => el.textContent.trim() === text || el.getAttribute('aria-label') === text), root, label);
  const element = handle.asElement();
  assert(element, `Missing ${label} in ${root}`);
  await element.scrollIntoView();
  await element.click();
  await handle.dispose();
}

async function shot(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.getAnimations()].map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: `${output}v7-${name}.png` });
  report.screenshots.push(`v7-${name}.png`);
}

async function menu() {
  await button('서비스 메뉴', '.topbar');
  await page.waitForSelector('[role="dialog"] .menu-row');
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="dialog"]');
    return el && el.getAnimations().every(animation => animation.playState === 'finished');
  });
}

async function closeMenu() {
  await page.click('[role="dialog"] .sheet-close');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
}

async function switchState() {
  return page.$eval('[role="dialog"] [role="switch"]', el => ({
    checked: el.checked,
    name: el.getAttribute('aria-label') || el.closest('label')?.textContent.trim() || '',
  }));
}

async function toggleAutosave(expected) {
  const before = await switchState();
  assert(before.name.includes('자동 저장'), JSON.stringify(before));
  await page.click('[role="dialog"] [role="switch"]');
  await page.waitForFunction(value => document.querySelector('[role="dialog"] [role="switch"]')?.checked === value, {}, expected);
  assert.equal((await switchState()).checked, expected);
}

async function editTitle(value) {
  await button('정보', '.tool-grid');
  await page.waitForSelector('.info-inspector #title');
  await page.$eval('.info-inspector #title', el => el.select());
  await page.type('.info-inspector #title', value);
  await page.waitForFunction(title => document.querySelector('.info-inspector #title')?.value === title, {}, value);
}

async function run() {
  const original = JSON.stringify({ fields: { title: '저장된 제목' }, design: { mood: 'minimal' }, unknown: { preserve: 'exact raw value' } });
  let context = await fresh(393, 659, original);
  await page.click('.landing-resume');
  await page.waitForSelector('.workspace');
  await menu();
  assert.equal((await switchState()).checked, true);
  const savedBeforeOff = await page.evaluate(name => localStorage.getItem(name), key);
  await toggleAutosave(false);
  assert.equal(await page.evaluate(name => localStorage.getItem(name), key), savedBeforeOff);
  await closeMenu();
  await editTitle('저장하지 않을 제목');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(await page.evaluate(name => localStorage.getItem(name), key), savedBeforeOff);
  await page.reload({ waitUntil: 'networkidle0' });
  assert((await page.$eval('.landing-resume', el => el.textContent)).includes('저장된 제목'));
  assert.equal(await page.evaluate(name => localStorage.getItem(name), key), savedBeforeOff);
  report.checks.push('Autosave off preserves exact prior draft through edit, pagehide, debounce interval, and reload');
  await page.click('.landing-resume');
  await editTitle('다시 켠 현재 제목');
  await menu();
  await toggleAutosave(true);
  await page.waitForFunction(name => JSON.parse(localStorage.getItem(name) || 'null')?.fields?.title === '다시 켠 현재 제목', {}, key);
  assert.equal(JSON.parse(await page.evaluate(name => localStorage.getItem(name), key)).fields.title, '다시 켠 현재 제목');
  report.checks.push('Turning autosave back on writes the current document');
  await context.close();

  context = await fresh(393, 659, original);
  await page.click('.landing-resume');
  await page.waitForSelector('.workspace');
  await button('정보', '.tool-grid');
  await page.waitForSelector('.info-inspector #title');
  await menu();
  const savedBeforePendingEdit = await page.evaluate(name => localStorage.getItem(name), key);
  await page.evaluate(() => {
    const input = document.querySelector('.info-inspector #title');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '대기 중인 수정');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('[role="dialog"] [role="switch"]').click();
  });
  await page.waitForFunction(() => document.querySelector('[role="dialog"] [role="switch"]')?.checked === false);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(await page.evaluate(name => localStorage.getItem(name), key), savedBeforePendingEdit);
  report.checks.push('Turning autosave off cancels an edit pending in its debounce interval');
  await context.close();

  context = await fresh();
  await page.evaluate(name => localStorage.setItem(`${name}-autosave`, 'off'), key);
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.evaluate(name => localStorage.getItem(name), key), null);
  await page.click('.landing-start');
  await page.waitForSelector('.workspace');
  await editTitle('초안 없는 시작');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(await page.evaluate(name => localStorage.getItem(name), key), null);
  report.checks.push('Starting without a draft while autosave is off creates no draft');
  await context.close();

  for (const [width, height] of [[320, 568], [375, 667], [393, 659], [414, 736]]) {
    context = await fresh(width, height, original);
    await page.click('.landing-resume');
    await page.waitForSelector('.workspace');
    await menu();
    const menuGeometry = await page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right }; };
      const rows = [...document.querySelectorAll('[role="dialog"] .menu-row')].slice(0, 3);
      const close = document.querySelector('[role="dialog"] .sheet-close');
      const details = document.querySelector('[role="dialog"] details');
      const summary = details?.querySelector('summary');
      return {
        rows: rows.map(row => ({ row: rect(row), icon: rect(row.querySelector('.icon')), name: rect(row.querySelector('span')), trailing: rect(row.lastElementChild) })),
        close: rect(close), closeBackground: getComputedStyle(close).backgroundColor,
        details: !!details, summary: summary?.getAttribute('aria-label'), collapsed: !details?.open,
        notice: details?.textContent || '', previous: details?.querySelector('a')?.getAttribute('href'),
        brand: rect(document.querySelector('[role="dialog"] .menu-brand')),
        scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
      };
    });
    assert.equal(menuGeometry.rows.length, 3);
    for (const { row, icon, name, trailing } of menuGeometry.rows) {
      assert(icon.x < name.x && name.x < trailing.x && row.right <= width + 1, JSON.stringify(menuGeometry));
    }
    assert(menuGeometry.close.width >= 44 && menuGeometry.close.height >= 44, JSON.stringify(menuGeometry.close));
    assert(menuGeometry.closeBackground === 'rgba(0, 0, 0, 0)' || menuGeometry.closeBackground === 'transparent', menuGeometry.closeBackground);
    assert(menuGeometry.details && menuGeometry.summary === '목업 안내' && menuGeometry.collapsed);
    await page.click('[role="dialog"] details summary');
    const notice = await page.$eval('[role="dialog"] details', el => el.textContent);
    assert(notice.includes('샘플') && notice.includes('이전 목업 보기'));
    assert(menuGeometry.previous?.includes('filme-mobile-v1'));
    assert(menuGeometry.scrollWidth <= width + 1);
    report.geometry.push({ width, height, menu: menuGeometry });
    await shot(`${width}-menu`);
    await closeMenu();

    await button('색상', '.tool-grid');
    await page.waitForSelector('.color-inspector');
    const color = await page.evaluate(() => {
      const panel = document.querySelector('.color-inspector');
      const stage = document.querySelector('.stage .ticket-paper');
      const rect = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
      return { panel: rect(panel), ticket: rect(stage), label: panel.textContent,
        picker: !!panel.querySelector('.custom-color .icon'), indicator: !!panel.querySelector('.custom-color [style], .custom-color .color-indicator'),
        heading: !!panel.querySelector('.inline-body > h3, .inline-header h2:not(.sr-only)'),
        scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    assert(color.panel.height <= 220 && color.panel.bottom <= height + 1, JSON.stringify({ width, color }));
    assert(color.ticket.height > 0 && color.label.includes('잉크·배경 톤'));
    assert(color.picker && color.indicator && !color.heading);
    assert(color.scrollWidth <= width + 1);
    report.geometry.push({ width, height, color });
    await shot(`${width}-color`);
    await button('도구 닫기', '.inline-panel');
    await button('디자인', '.tool-grid');
    await button('Editorial', '[aria-label="티켓 디자인 목록"] > div:last-child');
    await button('도구 닫기', '.inline-panel');
    await button('색상', '.tool-grid');
    assert((await page.$eval('.color-inspector', el => el.textContent)).includes('강조색'));
    await button('도구 닫기', '.inline-panel');
    await button('디자인', '.tool-grid');
    await button('Criterion', '[aria-label="티켓 디자인 목록"] > div:last-child');
    await button('도구 닫기', '.inline-panel');
    await button('색상', '.tool-grid');
    assert((await page.$eval('.color-inspector', el => el.textContent)).includes('고정 색상 디자인'));
    const fixed = await page.$eval('.color-inspector', el => {
      const panel = el.getBoundingClientRect();
      const opacity = el.querySelector('input[aria-label="텍스트·로고 불투명도"]');
      const control = opacity.getBoundingClientRect();
      const x = control.x + control.width / 2, y = control.y + control.height / 2;
      return { height: panel.height, bottom: panel.bottom, opacityVisible: opacity.contains(document.elementFromPoint(x, y)) };
    });
    assert(fixed.height <= 150 && fixed.bottom <= height + 1 && fixed.opacityVisible, JSON.stringify({ width, fixed }));
    report.geometry.push({ width, height, fixedColor: fixed });
    if (width === 393) await shot('393-fixed-color');
    await button('도구 닫기', '.inline-panel');
    report.checks.push(`${width}×${height}: menu alignment, switch, close target, compact color modes, no horizontal overflow`);
    await context.close();
  }

  context = await fresh();
  await page.click('.landing-start');
  await page.waitForSelector('.workspace');
  assert(await page.$('.empty-photo-button'));
  await button('디자인', '.tool-grid');
  assert.equal((await page.$$('.empty-photo-button')).length, 0);
  await button('도구 닫기', '.inline-panel');
  await button('사진', '.tool-grid');
  assert.equal((await page.$$('.empty-photo-button')).length, 0);
  assert(await page.$('.photo-empty button'));
  await button('도구 닫기', '.inline-panel');
  await menu();
  await button('새 티켓', '[role="dialog"]');
  await page.waitForFunction(() => document.querySelector('[role="dialog"] h2')?.textContent === '새 티켓');
  const copy = await page.$eval('[role="dialog"] .panel-body', el => el.textContent);
  assert(copy.includes('사진') && copy.includes('입력') && copy.includes('꾸미기'));
  assert(copy.includes('취소'));
  await shot('393-new-ticket');
  report.checks.push('Photo CTA yields to tools; photo tool remains; new-ticket confirmation names photo, input, and decoration');
  await context.close();
}

try {
  await run();
} catch (error) {
  report.failures.push(error.stack || String(error));
} finally {
  await browser.close();
  await writeFile(`${output}refinement-report.json`, JSON.stringify(report, null, 2) + '\n');
}
assert.deepEqual(report.pageErrors, []);
assert.deepEqual(report.failures, []);
console.log(JSON.stringify({ checks: report.checks.length, geometry: report.geometry.length, screenshots: report.screenshots.length }));
process.exit(0);
