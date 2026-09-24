import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const base = 'http://127.0.0.1:3793/docs/mockups/filme-mobile-v2/index.html';
const out = new URL('./verification/', import.meta.url).pathname;
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const report = { mode: 'Headless Chrome viewport emulation; not real iPhone Safari', checks: [], geometry: [], screenshots: [], failures: [], pageErrors: [], fontErrors: [] };
page.on('pageerror', error => report.pageErrors.push(String(error)));
page.on('response', response => {
  if (/\.(?:woff2?|ttf)(?:\?|$)/i.test(response.url()) && response.status() >= 400)
    report.fontErrors.push(`${response.status()} ${response.url()}`);
});
page.on('requestfailed', request => {
  if (/\.(?:woff2?|ttf)(?:\?|$)/i.test(request.url()))
    report.fontErrors.push(`${request.failure()?.errorText} ${request.url()}`);
});

async function click(selector, label) {
  const handle = await page.waitForSelector(selector, { visible: true });
  assert(handle, `Missing ${label || selector}`);
  await handle.scrollIntoView();
  await page.waitForFunction(sel => {
    const el = document.querySelector(sel);
    if (!el || el.disabled) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const x = Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2));
    return el.contains(document.elementFromPoint(x, y));
  }, {}, selector);
  await handle.click();
}

async function clickText(label, root = 'body') {
  const handle = await page.evaluateHandle((rootSelector, text) =>
    [...document.querySelector(rootSelector).querySelectorAll('button')]
      .find(el => el.textContent.trim() === text || el.getAttribute('aria-label') === text), root, label);
  const element = handle.asElement();
  assert(element, `Missing ${label} under ${root}`);
  await element.scrollIntoView();
  await page.waitForFunction((rootSelector, text) => {
    const el = [...document.querySelector(rootSelector).querySelectorAll('button')]
      .find(node => node.textContent.trim() === text || node.getAttribute('aria-label') === text);
    if (!el || el.disabled) return false;
    const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    return r.width > 0 && r.height > 0 && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight
      && el.contains(document.elementFromPoint(x, y));
  }, {}, root, label);
  await element.click();
  await handle.dispose();
}

async function shot(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: `${out}v7-regression-${name}.png` });
  report.screenshots.push(`v7-regression-${name}.png`);
}

async function fresh(width, height) {
  await page.setViewport({ width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.evaluate(() => { localStorage.setItem('filme-mockup-v2',JSON.stringify({fields:{title:'먼 바다',original:'THE FAR SEA',release:'2025-11-19',reissue:'',actors:'윤재이, Élodie Marchand-Vasseur',runtime:'118',date:'2026-02-14',time:'19:40',theater:'메가박스 코엑스',screen:'Dolby Cinema관',seat:'H열 12번',booking:'',rating:'4.5',signature:'지윤',quote:''},design:{}}));localStorage.removeItem('filme-mockup-v2-autosave'); });
  await page.reload({ waitUntil: 'networkidle0' });
  await click('.landing-resume');
  await page.waitForSelector('.stage .ticket-natural');
  await page.evaluate(() => document.fonts.ready);
}

async function closeDialog() {
  await page.$eval('[role="dialog"]', async el => {
    await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const rect = await page.$eval('[role="dialog"]', el => {
    const r = el.getBoundingClientRect();
    return { fullscreen:el.classList.contains('fullscreen'), left:r.left, right:r.right, top:r.top, bottom:r.bottom, centerX:(r.left+r.right)/2, centerY:(r.top+r.bottom)/2, width:innerWidth, height:innerHeight };
  });
  if (!rect.fullscreen) {
    assert(rect.left >= 11 && rect.top >= 11 && rect.right <= rect.width - 11 && rect.bottom <= rect.height - 11, JSON.stringify(rect));
    assert(Math.abs(rect.centerX - rect.width/2) <= 2 && Math.abs(rect.centerY - rect.height/2) <= 2, JSON.stringify(rect));
  }
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
}

async function field(group, label, id) {
  if (!await page.$('.info-inspector')) await clickText('정보', '.tool-grid');
  await page.waitForSelector('.info-inspector');
  await clickText(group, '.info-groups');
  await page.waitForSelector(`.info-inspector #${id}`);
  assert((await page.$$('.info-inspector .field')).length > 1);
  assert((await page.$eval(`.info-inspector #${id}`, el => el.closest('.field').querySelector('.field-label label').textContent.trim())).startsWith(label));
  assert.equal((await page.$$('.info-inspector .field-rail')).length, 0);
  await click(`.info-inspector #${id}`);
}

async function closeInfo() {
  if (await page.$('.info-inspector')) {
    await clickText('도구 닫기', '.info-inspector');
    await page.waitForSelector('.info-inspector', { hidden:true });
  }
}

async function setInput(selector, value) {
  await click(selector);
  await page.$eval(selector, el => el.select());
  await page.keyboard.type(value);
  await page.waitForFunction((sel, expected) => document.querySelector(sel)?.value === expected, {}, selector, value);
}

async function run() {
  const tools = ['정보', '사진', '디자인', '색상', '질감', '로고'];
  for (const [width, height] of [[320, 568], [375, 667], [393, 659], [414, 736], [768, 900]]) {
    await fresh(width, height);
    const baseline = await page.evaluate(() => ({
      tools: [...document.querySelectorAll('.tool-grid button')].map(el => el.dataset.tool),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      headerButtons: [...document.querySelectorAll('.topbar button')].map(el => el.getAttribute('aria-label')),
      canvasButtons: [...document.querySelectorAll('.canvas-actions button')].map(el => el.getAttribute('aria-label')),
      duplicateBar: !!document.querySelector('.document-bar'),
    }));
    assert.deepEqual(baseline.tools, tools);
    assert(!baseline.duplicateBar && baseline.headerButtons.includes('정보 가져오기') && baseline.canvasButtons.includes('되돌리기') && baseline.canvasButtons.includes('다시 실행'));
    assert(baseline.scrollWidth <= baseline.viewportWidth + 1, JSON.stringify({ width, baseline }));
    report.geometry.push({ width, height, baseline });
    await shot(`${width}-baseline`);

    for (const label of ['정보', '사진', '디자인', '색상', '질감', '로고']) {
      await clickText(label, '.tool-grid');
      await page.waitForSelector('.inline-panel');
      await page.waitForFunction(() => {
        const ticket = document.querySelector('.stage .ticket-paper')?.getBoundingClientRect();
        const stage = document.querySelector('.stage')?.getBoundingClientRect();
        return ticket && stage && ticket.height > 0 && ticket.top >= stage.top - 1 && ticket.bottom <= stage.bottom + 1;
      }, { timeout: 4000 });
      const geometry = await page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top:r.top, bottom:r.bottom, height:r.height }; };
        const buttons = [...document.querySelectorAll('.inline-panel button')].filter(el => {
          const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
        });
        return { ticket:rect('.stage .ticket-paper'), stage:rect('.stage'), panel:rect('.inline-panel'),
          minTargetHeight:Math.min(...buttons.map(el => el.getBoundingClientRect().height)),
          scrollWidth:document.documentElement.scrollWidth, viewportWidth:innerWidth };
      });
      assert(geometry.ticket.height > 0 && geometry.ticket.top >= geometry.stage.top - 1 && geometry.ticket.bottom <= geometry.stage.bottom + 1, JSON.stringify({ width, label, geometry }));
      assert(geometry.panel.bottom <= height + 1 && geometry.scrollWidth <= geometry.viewportWidth + 1, JSON.stringify({ width, label, geometry }));
      assert(geometry.minTargetHeight >= 36, JSON.stringify({ width, label, geometry }));
      report.geometry.push({ width, label, ...geometry });
      if (width === 393) await shot(`393-${label}`);
      await clickText('도구 닫기', '.inline-panel');
      await page.waitForSelector('.inline-panel', { hidden:true });
    }
    report.checks.push(`${width}×${height}: six tools and contextual inline panels, unified header, no horizontal overflow`);
  }

  await fresh(393, 659);
  await clickText('색상', '.tool-grid');
  await page.$eval('input[aria-label="사용자 지정 색상"]', input => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '#234567');
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
  });
  await page.waitForFunction(() => document.querySelector('.custom-color')?.dataset.selected === 'true');
  assert.equal(await page.$eval('input[aria-label="사용자 지정 색상"]', input => document.getElementById(input.getAttribute('aria-describedby'))?.textContent), '선택됨');
  await clickText('도구 닫기', '.inline-panel');
  report.checks.push('Custom color exposes its selected state to visual and screen reader users');
  await clickText('디자인', '.tool-grid');
  for (const [id, dimensions] of [
    ['minimal',[960,1534]], ['criterion',[960,1534]], ['35mm',[960,1534]],
    ['editorial',[1534,960]], ['stub',[960,1534]], ['35mm-landscape',[1534,960]],
  ]) {
    const label = id === '35mm-landscape' ? '35mm Wide' : id === '35mm' ? '35mm' : id[0].toUpperCase() + id.slice(1);
    await clickText(label, '[aria-label="티켓 디자인 목록"] > div:last-child');
    await page.waitForFunction(mood => document.querySelector('.stage .live-ticket')?.dataset.layout === mood, {}, id);
    const actual = await page.$eval('.stage .ticket-natural', el => [el.offsetWidth, el.offsetHeight]);
    assert.deepEqual(actual, dimensions, id);
    await shot(`393-mood-${id}`);
  }
  await clickText('도구 닫기', '.inline-panel');
  report.checks.push('Six production moods render at natural pixel dimensions');

  await clickText('디자인', '.tool-grid');
  await clickText('Minimal', '[aria-label="티켓 디자인 목록"] > div:last-child');
  const posterStyles = await page.evaluate(() => {
    const stage = document.querySelector('.stage .ticket-natural img[src*="sample-pier"]');
    const thumb = document.querySelector('[aria-label="티켓 디자인 목록"] button[aria-label="Minimal"] .ticket-natural img[src*="sample-pier"]');
    if (!stage || !thumb) return null;
    const style = el => { const css = getComputedStyle(el); return { width:css.width, height:css.height, objectFit:css.objectFit }; };
    return { stage:style(stage), thumb:style(thumb) };
  });
  assert(posterStyles && posterStyles.stage.width !== '0px' && posterStyles.stage.height !== '0px', JSON.stringify(posterStyles));
  assert.deepEqual(posterStyles.thumb, posterStyles.stage);
  await clickText('도구 닫기', '.inline-panel');
  await click('.stage [data-field-tap="title"]', 'ticket title');
  await page.waitForSelector('.info-inspector #title');
  await page.waitForFunction(() => document.activeElement === document.querySelector('.info-inspector #title'));
  await setInput('.info-inspector #title', '직접 쓴 제목');
  await page.waitForFunction(() => document.querySelector('.info-inspector #title')?.closest('.field')?.querySelector('.source-badge')?.textContent === '직접 입력');
  assert.deepEqual(await page.$$eval('.info-inspector .field input', inputs => inputs.map(input => input.id)), ['title','release','reissue','runtime','original','actors']);
  assert.equal(await page.$eval('.info-inspector #title', el => el.closest('.field').querySelector('.field-label .source-badge').textContent), '직접 입력');
  assert.equal((await page.$$('.stage .ticket-natural .info-inspector')).length, 0);
  await click('.info-inspector #release');
  assert.equal(await page.$eval('.info-inspector #release', el => document.activeElement === el), true);
  await click('.info-inspector #title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement === document.querySelector('.info-inspector #release'));
  await shot('393-direct-title');
  await closeInfo();
  report.checks.push('Ticket title tap opens grouped native inputs with provenance and Enter navigation');

  await click('.stage [data-poster-tap]', 'loaded poster');
  await page.waitForFunction(() => document.querySelector('.tool-grid [aria-pressed="true"]')?.dataset.tool === '사진');
  assert.equal((await page.$$('[role="dialog"]')).length, 0);
  assert.equal((await page.$$('.inline-panel .poster-preview')).length, 0);
  await shot('393-photo-inline');
  await clickText('자르기', '.inline-panel');
  await page.waitForFunction(() => document.querySelector('[role="dialog"] h2')?.textContent === '이미지 자르기');
  await shot('393-photo-crop');
  await closeDialog();
  assert.equal(await page.$eval('.tool-grid [aria-pressed="true"]', el => el.dataset.tool), '사진');
  await clickText('도구 닫기', '.inline-panel');
  report.checks.push('Loaded poster tap opens inline photo tools; crop returns to photo tools');

  assert.equal((await page.$$('.quick-actions')).length, 0);
  await clickText('정보 가져오기', '.topbar');
  await page.waitForSelector('[role="dialog"]');
  assert.equal(await page.$eval('[role="dialog"] h2', el => el.textContent), '가져오기');
  await clickText('영화 검색', '[role="dialog"]');
  assert.equal((await page.$$('.search-form input[aria-label="영화 검색어"]')).length, 1);
  await clickText('OCR', '[role="dialog"]');
  await clickText('예매 내역 이미지 선택', '[role="dialog"]');
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some(el => el.textContent.trim() === '5개 항목 반영'));
  await clickText('5개 항목 반영', '[role="dialog"]');
  await page.waitForSelector('[role="dialog"]', { hidden:true });
  await field('관람', '좌석', 'seat');
  await page.waitForFunction(() => document.querySelector('#seat')?.closest('.field')?.querySelector('.source-badge')?.textContent === 'OCR');
  await setInput('#seat', 'K열 1번');
  await page.waitForFunction(() => document.querySelector('#seat')?.closest('.field')?.querySelector('.source-badge')?.textContent === 'OCR · 수정');
  await closeInfo();
  await click('.canvas-actions button[aria-label="되돌리기"]');
  await field('관람', '좌석', 'seat');
  assert.equal(await page.$eval('#seat', el => el.value), 'H열 12번');
  assert.equal(await page.$eval('#seat', el => el.closest('.field').querySelector('.source-badge').textContent), 'OCR');
  await shot('393-ocr-undo');
  await closeInfo();
  report.checks.push('Sample OCR import, provenance after manual correction, grouped undo restoration');

  await field('영화', '재개봉일', 'reissue');
  await page.$eval('#reissue', el => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '2026-01-01');
    el.dispatchEvent(new Event('input', { bubbles:true }));
    el.dispatchEvent(new Event('change', { bubbles:true }));
  });
  await page.waitForFunction(() => document.querySelector('.stage .ticket-natural')?.textContent.includes('2026-01-01'));
  await clickText('재개봉일 표시 설정', '.info-inspector');
  await page.waitForFunction(() => document.querySelector('[role="dialog"] h2')?.textContent === '필드 옵션');
  await clickText('영화명만 표시', '[role="dialog"]');
  await page.waitForFunction(() => !document.querySelector('.stage .ticket-natural')?.textContent.includes('2026-01-01'));
  await page.waitForSelector('.info-inspector #reissue');
  await clickText('재개봉일 표시 설정', '.info-inspector');
  await clickText('모두 표시', '[role="dialog"]');
  await page.waitForFunction(() => document.querySelector('.stage .ticket-natural')?.textContent.includes('2026-01-01'));
  await page.waitForSelector('.info-inspector #reissue');
  await closeInfo();
  report.checks.push('Reissue date renders, bulk visibility toggles preserve the active inline field');

  await clickText('질감', '.tool-grid');
  await clickText('종이', '.inline-panel');
  await click('.inline-panel input[aria-label="소재 강도"]');
  await page.keyboard.press('End');
  await clickText('코팅', '.mini-segments');
  await clickText('메탈', '.inline-panel');
  await click('.inline-panel input[aria-label="코팅 강도"]');
  await page.keyboard.press('Home');
  await page.waitForFunction(() => {
    const el = document.querySelector('.stage [data-material="artpaper"][data-coating="metal"]');
    return el?.dataset.materialIntensity === '1' && el?.dataset.coatingIntensity === '0';
  });
  await shot('393-independent-texture');
  await clickText('도구 닫기', '.inline-panel');
  report.checks.push('Material and coating intensities remain independent in the production poster');

  const beforeLogo = await page.evaluate(() => document.querySelector('.stage .ticket-natural')?.textContent || '');
  assert(beforeLogo.includes('IMAX') && !beforeLogo.includes('WATCHED'));
  assert.equal((await page.$$('.tool-grid button[data-tool="스탬프"]')).length, 0);
  report.checks.push('Format logo is IMAX; fake stamp tool and WATCHED label are absent');
  await clickText('로고', '.tool-grid');
  await clickText('극장', '.mini-segments');
  await clickText('극장 로고 이미지 편집', '.inline-panel');
  await page.waitForSelector('[role="dialog"]');
  const logoPath = new URL('../../../public/assets/chains/cgv.png', import.meta.url).pathname;
  const chooserPromise = page.waitForFileChooser();
  await clickText('이미지 업로드', '[role="dialog"]');
  const chooser = await chooserPromise;
  await chooser.accept([logoPath]);
  await page.waitForSelector('[role="dialog"] .ReactCrop');
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"] .ReactCrop__crop-selection'));
  await clickText('적용', '[role="dialog"]');
  await page.waitForSelector('[role="dialog"] .ReactCrop', { hidden:true });
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"] .logo-preview img[src^="data:image/png"]'));
  await page.waitForFunction(() => !!document.querySelector('.stage .ticket-natural img[src^="data:image/png"]'));
  await shot('393-logo-upload');
  await closeDialog();
  await click('.canvas-actions button[aria-label="되돌리기"]');
  await page.waitForFunction(() => !document.querySelector('.stage .ticket-natural img[src^="data:image/png"]'));
  await click('.canvas-actions button[aria-label="다시 실행"]');
  await page.waitForFunction(() => !!document.querySelector('.stage .ticket-natural img[src^="data:image/png"]'));
  await page.waitForFunction(() => {
    try { return JSON.parse(localStorage.getItem('filme-mockup-v2'))?.design?.chainImage?.startsWith('data:image/png'); } catch { return false; }
  });
  await page.reload({ waitUntil:'networkidle0' });
  await click('.landing-resume');
  await page.waitForFunction(() => !!document.querySelector('.stage .ticket-natural img[src^="data:image/png"]'));
  await shot('393-logo-reloaded');
  report.checks.push('Native logo file choice, crop, PNG render, undo/redo, and local reload persistence');

  await field('기록', '이름', 'signature');
  await clickText('이름 표시 설정', '.info-inspector');
  await page.waitForFunction(() => document.querySelector('[role="dialog"] h2')?.textContent === '필드 옵션');
  for (const [font, family] of [['brush','Nanum Brush Script'],['eunyoung','KCCeunyoung'],['coolguy','CoolGuy'],['flower','SangSangFlowerRoad']]) {
    await page.select('select[aria-label="이름 서체"]', font);
    await page.evaluate(() => document.fonts.ready);
    const computed = await page.evaluate(expected => [...document.querySelectorAll('.stage .ticket-natural *')]
      .find(el => el.textContent === '지윤' && getComputedStyle(el).fontFamily.includes(expected))?.tagName || null, family);
    assert(computed, `Missing font family ${family}`);
  }
  await closeDialog();
  await closeInfo();
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.fontErrors, []);
  report.checks.push('Brush, Eunyoung, CoolGuy and Flower font families load without errors');
}

try {
  await run();
} catch (error) {
  report.failures.push(String(error.stack || error));
  try { await shot('failure'); } catch {}
} finally {
  await Bun.write(`${out}redesign-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ checks:report.checks.length, failures:report.failures, pageErrors:report.pageErrors, fontErrors:report.fontErrors, screenshots:report.screenshots.length }));
if (report.failures.length || report.pageErrors.length || report.fontErrors.length) process.exitCode = 1;
