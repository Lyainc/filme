// Visual/interaction evidence for the cream UI; Chrome emulation is not iPhone Safari.
// bun scripts/verify-mobile-ui.mjs http://127.0.0.1:3714 docs/verification/mobile-ui-2026-09-20
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const url = process.argv[2] ?? 'http://127.0.0.1:3714';
const output = process.argv[3] ?? '/tmp/filme-mobile-ui';
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const rows = [];
const longTitle = '아주 긴 영화 제목과 부제: 우리가 함께 기억하는 어느 여름날의 이야기';
try {
  for (const [width, height] of [[320,568], [375,667], [393,659], [414,736]]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluateOnNewDocument(() => localStorage.setItem('phototicket:theme', 'dark'));
    const shot = name => page.screenshot({ path: `${output}/ui-${width}-${name}.png` });
    const inspect = () => page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return { bg: s.getPropertyValue('--bg').trim(), scheme: s.colorScheme,
        overflow: document.documentElement.scrollWidth > innerWidth,
        darkPanels: document.querySelectorAll('.chrome-dark,.theme-dark,.chrome-ambient').length,
        font: getComputedStyle(document.querySelector('[data-font-root]')).fontFamily };
    });
    const tap = async selector => {
      console.log(width, selector);
      await page.waitForSelector(selector, { visible: true, timeout: 5000 });
      await page.$eval(selector, e => e.scrollIntoView({ block: 'nearest' }));
      await sleep(120);
      const point = await page.$eval(selector, e => {
        const r = e.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        return { x, y, hit: e.contains(document.elementFromPoint(x, y)) };
      });
      assert(point.hit, `blocked control: ${selector} at ${width}`);
      await page.touchscreen.tap(point.x, point.y);
      await sleep(250);
    };
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.evaluate(() => document.fonts.ready);
    await shot('landing-reduced');
    const reducedLanding = await inspect();
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }, { name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.reload({ waitUntil: 'networkidle2' });
    await shot('landing');
    const row = { width, height, reducedLanding, landing: await inspect() };
    await page.evaluate(title => localStorage.setItem('filme:phototicket:v1', JSON.stringify({
      movieInfo: { title, titleOg: 'A VERY LONG ORIGINAL FILM TITLE', releaseDate: '2026-09-20', theater: '아주 긴 이름을 가진 영화관 특별 상영관', signature: '테스트' },
      components: { layout: 'minimal' }, fieldVisibility: {},
    })), longTitle);
    await page.reload({ waitUntil: 'networkidle2' });
    await tap('[data-testid="landing-restore"]');
    await shot('editor');
    row.editor = await inspect();
    await tap('button[aria-label="티켓 항목 목록"]');
    await shot('fields');
    row.fields = await inspect();
    await tap('button[aria-label="제목 편집"]');
    const input = await page.waitForSelector('input[aria-label="제목"]');
    assert.equal(await input.evaluate(e => e.value), longTitle);
    row.input = await input.evaluate(e => ({ fontSize: getComputedStyle(e).fontSize, color: getComputedStyle(e).color, background: getComputedStyle(e).backgroundColor, height: e.getBoundingClientRect().height }));
    assert.equal(row.input.fontSize, '16px');
    assert.equal(row.input.color, 'rgb(13, 1, 41)');
    assert(row.input.height >= 44);
    assert(await input.evaluate(e => { const r = e.getBoundingClientRect(); return [.1,.5,.9].every(f => document.elementFromPoint(r.left + r.width*f, r.top + r.height/2) === e); }), `input obscured at ${width}`);
    await shot('long-title');
    await tap('button[aria-label="편집 완료"]');
    await page.evaluate(() => [...document.querySelectorAll('header button')].find(e => e.textContent.includes('완료')).click());
    await page.waitForSelector('[data-testid="result-stage"]', { visible: true });
    await sleep(400);
    await shot('result');
    row.result = await inspect();
    row.save = await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find(e => e.textContent.includes('사진에 저장'));
      button.scrollIntoView({ block: 'nearest' });
      const r = button.getBoundingClientRect();
      return { enabled: !button.disabled, visible: r.top >= 0 && r.bottom <= innerHeight, fill: getComputedStyle(button).backgroundColor };
    });
    assert(row.save.enabled && row.save.visible, `save inaccessible: ${width}`);
    for (const state of [row.landing, row.editor, row.fields, row.result]) {
      assert.equal(state.bg, '#fffcf7'); assert.equal(state.scheme, 'light');
      assert.equal(state.darkPanels, 0); assert.equal(state.overflow, false);
    }
    rows.push(row);
    await page.close();
  }
  fs.writeFileSync(`${output}/ui-flow.json`, JSON.stringify(rows, null, 2));
  console.log(rows);
} finally { await browser.close(); }
