import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const dir = dirname(fileURLToPath(import.meta.url));
const base = process.env.FILME_MOCKUP_URL || pathToFileURL(resolve(dir, 'index.html')).href;
const output = resolve(dir, 'verification');
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', err => errors.push(String(err)));
const statesOnly = process.argv.includes('--states');
const report = { base, mode: 'Chrome viewport emulation, not real iPhone Safari', checks: [], screenshots: [] };
const click = async text => {
  await page.waitForFunction(t => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === t && b.getBoundingClientRect().width > 0), {}, text);
  const handle = await page.evaluateHandle(t => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === t && b.getBoundingClientRect().width > 0), text);
  await handle.asElement().click(); await handle.dispose();
};
const waitPage = p => page.waitForSelector(`[data-page="${p}"]`);
const waitPanel = () => page.waitForSelector('[role="dialog"]');
const closePanel = async () => { await page.keyboard.press('Escape'); await page.waitForSelector('[role="dialog"]', { hidden: true }); };
const shot = async name => {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))));
  await page.screenshot({ path: resolve(output, name + '.png'), fullPage: false }); report.screenshots.push(name + '.png');
};
try {
  if (!statesOnly) {
  for (const [width, height] of [[320,568],[375,667],[393,659],[414,736],[768,900]]) {
    await page.setViewport({ width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: 'networkidle0' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    await shot(`${width}-home`);
    await click('티켓 만들기'); await waitPage('info');
    await click('디자인 고르기');
    assert.equal(await page.$eval('#title', e => e.getAttribute('aria-invalid')), 'true');
    await page.type('#title', '먼 바다'); await page.type('#year', '2025');
    await shot(`${width}-info`);
    await click('디자인 고르기'); await waitPage('design');
    await shot(`${width}-design`);
    const geometry = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth, width: innerWidth,
      frameWidth: document.querySelector('.app-frame').getBoundingClientRect().width,
      missingImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src),
      primaryHit: (() => { const e=document.querySelector('.bottom-bar .primary-button'); const r=e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })(),
      font: getComputedStyle(document.querySelector('h1')).fontFamily,
    }));
    assert(geometry.scrollWidth <= width, JSON.stringify(geometry)); assert(geometry.frameWidth <= 430); assert.equal(geometry.missingImages.length, 0); assert(geometry.primaryHit);
    report.checks.push({ width, height, ...geometry });
    await page.click('[aria-label="미리보기 확대"]'); await waitPanel();
    await shot(`${width}-preview`); await closePanel();
    await click('티켓 완성'); await waitPage('result');
    await shot(`${width}-result`);
  }
  await page.setViewport({ width: 393, height: 659, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.click('[aria-label="목업 안내"]'); await waitPanel();
  await page.goBack(); await page.waitForSelector('[role="dialog"]', { hidden: true });
  await waitPage('home'); assert(page.url().startsWith(base));
  await page.goto(base + '?scene=info', { waitUntil: 'networkidle0' });
  await click('영화 검색'); await waitPanel();
  await page.click('button[aria-label="검색"]');
  await page.waitForSelector('.spinner'); await shot('393-search-loading');
  await page.waitForSelector('.search-result'); await shot('393-search');
  await page.click('.search-result'); await waitPage('info');
  assert.equal(await page.$eval('#title', e => e.value), '먼 바다');
  await click('디자인 고르기'); await waitPage('design');
  await page.click('.mood-picker-trigger'); await waitPanel(); await shot('393-moods');
  await page.goBack(); await page.waitForSelector('[role="dialog"]', { hidden: true }); await waitPage('design');
  await page.click('.mood-picker-trigger'); await waitPanel(); await page.click('.mood-option:nth-child(2)'); await page.waitForSelector('[role="dialog"]', { hidden: true });
  assert.equal(await page.$eval('.mood-picker-trigger', e => e.textContent), 'Criterion');
  await page.click('[aria-label="실행 취소"]');
  assert.equal(await page.$eval('.mood-picker-trigger', e => e.textContent), 'Minimal');
  await page.click('[aria-label="다시 실행"]');
  assert.equal(await page.$eval('.mood-picker-trigger', e => e.textContent), 'Criterion');
  await page.$eval('.option-row:nth-child(2)', e => e.scrollIntoView({ block: 'center' })); await page.click('.option-row:nth-child(2)'); await waitPanel();
  await click('아트지'); await shot('393-settings');
  await closePanel();
  await page.$eval('.option-row:nth-child(2)', e => e.scrollIntoView({ block: 'center' })); await page.click('.option-row:nth-child(2)'); await waitPanel();
  assert.equal(await page.$eval('.choice.selected', e => e.textContent), '원본');
  await click('아트지'); await click('적용');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  await page.$eval('.option-row:nth-child(2)', e => e.scrollIntoView({ block: 'center' })); await page.click('.option-row:nth-child(2)'); await waitPanel();
  assert.equal(await page.$eval('.choice.selected', e => e.textContent), '아트지');
  await closePanel();
  await page.click('[aria-label="뒤로 가기"]'); await waitPage('info');
  const longTitle = '아주 긴 영화 제목과 부제: 우리가 함께 기억하는 어느 여름날의 이야기';
  await page.$eval('#title', el => { el.select(); }); await page.type('#title', longTitle);
  await click('디자인 고르기'); await waitPage('design');
  await page.goBack(); await waitPage('info');
  assert.equal(await page.$eval('#title', e => e.value), longTitle);
  await click('디자인 고르기'); await waitPage('design');
  await page.reload({ waitUntil: 'networkidle0' });
  await waitPage('design');
  await page.click('[aria-label="목업 안내"]'); await waitPanel();
  await page.select('#scenario', 'error'); await click('확인');
  await page.click('[aria-label="뒤로 가기"]'); await waitPage('info');
  await click('스크린샷 입력'); await waitPanel(); await click('샘플 스크린샷 선택');
  await page.waitForSelector('.failure'); await shot('393-ocr-error');
  await closePanel();
  await page.click('[aria-label="목업 안내"]'); await waitPanel(); await page.select('#scenario', 'success'); await click('확인');
  await click('스크린샷 입력'); await waitPanel(); await click('샘플 스크린샷 선택');
  await page.waitForSelector('.summary-list'); await shot('393-ocr-review'); await click('정보 확인하기');
  await click('디자인 고르기'); await waitPage('design'); await click('티켓 완성'); await waitPage('result');
  await click('이미지 저장'); await waitPanel(); await click('저장 시연');
  await page.waitForSelector('.spinner'); await shot('393-save-loading');
  await page.waitForFunction(() => document.querySelector('.feedback-state h3')?.textContent.includes('완료')); await shot('393-save-complete');
  await closePanel();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  assert.equal(await page.$eval('html', e => getComputedStyle(e).colorScheme), 'light');
  assert.equal(errors.length, 0, errors.join('\n'));
  report.checks.push({ interactions: 'required fields, selection, undo/redo, cancel/apply, back state, sample search, OCR success/error, save loading/success, OS dark, reduced motion', passed: true });
  } else {
    await page.setViewport({ width: 393, height: 659, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await page.goto(base + '?scene=design', { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    assert(await page.evaluate(() => document.fonts.check('16px Pretendard')));
    for (let i = 1; i <= 6; i++) {
      await page.click('.mood-picker-trigger'); await waitPanel();
      await page.$eval(`.mood-option:nth-child(${i})`, e => e.scrollIntoView({ block: 'center' }));
      await page.click(`.mood-option:nth-child(${i})`);
      await page.waitForSelector('[role="dialog"]', { hidden: true });
      assert(await page.$eval('.preview-ticket-button img', i => i.complete && i.naturalWidth > 0));
    }
    await shot('393-landscape');
    await page.click('.mood-picker-trigger'); await waitPanel();
    await page.keyboard.press('Tab');
    assert(await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))));
    await closePanel();
    await page.waitForFunction(() => document.activeElement.classList.contains('mood-picker-trigger'));
    assert(await page.evaluate(() => document.activeElement.classList.contains('mood-picker-trigger')));
    report.checks.push({ allSixDesigns: true, modalFocus: true, fontLoaded: true });
    await page.click('[aria-label="목업 안내"]'); await waitPanel(); await page.select('#scenario', 'empty'); await click('확인'); await page.waitForSelector('[role="dialog"]', { hidden: true });
    await page.click('[aria-label="뒤로 가기"]'); await waitPage('info'); await click('영화 검색'); await waitPanel();
    await page.click('button[aria-label="검색"]'); await page.waitForSelector('.feedback-state h3');
    await page.waitForFunction(() => document.querySelector('.feedback-state h3')?.textContent.includes('결과가 없어요'));
    await shot('393-search-empty'); await closePanel();
    await page.click('[aria-label="목업 안내"]'); await waitPanel(); await page.select('#scenario', 'success'); await click('확인'); await page.waitForSelector('[role="dialog"]', { hidden: true });
    await click('디자인 고르기'); await waitPage('design'); await click('티켓 완성'); await waitPage('result');
    await click('공유'); await waitPanel(); await click('링크 복사 시연');
    await page.waitForFunction(() => document.querySelector('.feedback-state h3')?.textContent.includes('복사 완료')); await shot('393-share'); await closePanel();
    await page.setViewport({ width: 320, height: 480, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await page.click('[aria-label="뒤로 가기"]'); await waitPage('design');
    await page.$eval('.option-row:nth-child(2)', e => e.scrollIntoView({ block: 'center' })); await page.click('.option-row:nth-child(2)'); await waitPanel();
    await shot('320-short-settings');
    assert(await page.$eval('.sheet-footer button', e => { const r=e.getBoundingClientRect(); return r.bottom<=innerHeight && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }));
    report.checks.push({ emptySearch: true, shareSimulation: true, shortViewportSheet: true });
    await closePanel();
    if (base.startsWith('http')) {
      await page.goto(new URL('comparison.html', base).href, { waitUntil: 'networkidle0' });
      assert.equal(await page.evaluate(() => [...document.images].filter(i => !i.complete || !i.naturalWidth).length), 0);
      report.checks.push({ comparisonPage: true });
    }
    assert.equal(errors.length, 0, errors.join('\n'));
  }
  await Bun.write(resolve(output, statesOnly ? 'states-report.json' : 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks.length, screenshots: report.screenshots.length, errors }));
} finally { await browser.close(); }
