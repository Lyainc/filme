import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const url = 'http://127.0.0.1:3793/docs/mockups/filme-mobile-v2/index.html';
const output = new URL('./verification/', import.meta.url).pathname;
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  if (location.origin !== 'http://127.0.0.1:3793') return;
  localStorage.removeItem('filme-mockup-v2');
  localStorage.removeItem('filme-mockup-v2-autosave');
});
const report = { mode: 'Headless Chrome mobile emulation; not iPhone Safari', checks: [], geometry: [], screenshots: [], failures: [], pageErrors: [] };
page.on('pageerror', error => report.pageErrors.push(String(error)));

async function settled(selector) {
  await page.waitForSelector(selector, { visible: true });
  await page.$eval(selector, async element => {
    await document.fonts.ready;
    await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.playState !== 'infinite').map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function button(label, root = 'body') {
  const selector = `${root} button`;
  const handle = await page.evaluateHandle((sel, text) => [...document.querySelectorAll(sel)].find(element => element.textContent.trim() === text || element.getAttribute('aria-label') === text), selector, label);
  const element = handle.asElement();
  assert(element, `Missing button ${label} in ${root}`);
  await element.scrollIntoView();
  await page.waitForFunction((sel, text) => {
    const element = [...document.querySelectorAll(sel)].find(node => node.textContent.trim() === text || node.getAttribute('aria-label') === text);
    if (!element || element.disabled) return false;
    const r = element.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    return r.width >= 1 && r.height >= 1 && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && element.contains(document.elementFromPoint(x, y));
  }, {}, selector, label);
  await element.click();
  await handle.dispose();
}
async function shot(name) {
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  await page.screenshot({ path: `${output}v7-${name}.png` });
  report.screenshots.push(`v7-${name}.png`);
}
async function fresh(width, height, reduce = false) {
  await page.setViewport({ width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
  await page.goto(url, { waitUntil: 'networkidle0' });
  await settled('.landing-shell');
}
async function geometry() {
  return page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
    return { viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }, ticket: document.querySelector('.ticket-paper') && rect('.ticket-paper'), stage: document.querySelector('.stage') && rect('.stage'), panel: document.querySelector('.inline-panel') && rect('.inline-panel'), cta: document.querySelector('.landing-start') && rect('.landing-start') };
  });
}
async function closeDialog() {
  await page.$eval('[role="dialog"]', async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const dialog = await page.$eval('[role="dialog"]', element => {
    const r = element.getBoundingClientRect();
    const fullscreen = element.classList.contains('fullscreen');
    const close = element.querySelector('.sheet-close')?.getBoundingClientRect();
    return { fullscreen, top: r.top, bottom: r.bottom, left: r.left, right: r.right, centerX: (r.left+r.right)/2, centerY: (r.top+r.bottom)/2, closeTop: close?.top - r.top, width: innerWidth, height: innerHeight };
  });
  if (!dialog.fullscreen) {
    assert(dialog.top >= 11 && dialog.left >= 11 && dialog.bottom <= dialog.height - 11 && dialog.right <= dialog.width - 11, JSON.stringify(dialog));
    assert(Math.abs(dialog.centerX - dialog.width/2) <= 2 && Math.abs(dialog.centerY - dialog.height/2) <= 2, JSON.stringify(dialog));
    assert(dialog.closeTop >= 13, JSON.stringify(dialog));
  }
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
}

try {
  for (const [width, height] of [[320,568], [375,667], [393,659], [414,736], [768,900]]) {
    await fresh(width, height);
    const landing = await geometry();
    assert(landing.viewport.scrollWidth <= width + 1 && landing.viewport.scrollHeight <= height + 1 && landing.cta.top >= 0 && landing.cta.bottom <= height + 1, JSON.stringify(landing));
    if (width === 768) {
      const frame = await page.$eval('.landing-shell', element => ({ width: element.getBoundingClientRect().width, outline: getComputedStyle(element).outlineWidth, inside: getComputedStyle(element).backgroundColor, outside: getComputedStyle(document.body).backgroundColor }));
      assert(frame.width <= 430 && frame.outline === '1px' && frame.inside !== frame.outside, JSON.stringify(frame));
    }
    assert((await page.$eval('.landing-card[style*="opacity: 1"] img', element => element.getAttribute('src'))).includes('hero-minimal'));
    assert.equal((await page.$$('.landing-brand')).length, 1);
    assert.equal((await page.$$('.landing-headline')).length, 0);
    const brand = await page.$eval('.landing-brand', element => { const r = element.getBoundingClientRect(); return (r.left + r.right)/2; });
    assert(Math.abs(brand - width/2) <= 2, JSON.stringify({ width, brand }));
    const carousel = await page.$eval('.landing-carousel', element => { const r = element.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const initialCard = await page.$eval('.landing-card[style*="opacity: 1"] img', element => element.getAttribute('src'));
    await page.mouse.move(carousel.x, carousel.y);
    await page.mouse.down();
    await page.mouse.move(carousel.x - 50, carousel.y, { steps: 4 });
    await page.mouse.up();
    await page.mouse.click(carousel.x, carousel.y);
    assert.equal(await page.$eval('.landing-card[style*="opacity: 1"] img', element => element.getAttribute('src')), initialCard);
    assert.equal((await page.$$('.landing-card button, button.landing-card')).length, 0);
    if ([320,393,768].includes(width)) await shot(`${width}-landing`);
    await button('티켓 만들기', '.landing-bottom');
    await settled('.workspace');
    assert.equal(await page.$eval('.stage .live-ticket', element => element.dataset.layout), 'minimal');
    assert.equal((await page.$$('.landing-brand')).length, 0);
    assert.equal((await page.$$('.tool-grid button')).length, 6);
    assert.equal((await page.$$('.result-share')).length, 0);
    assert.equal(await page.$eval('.stage .ticket-natural', element => element.textContent.includes('먼 바다')), false);
    if ([320,393,768].includes(width)) await shot(`${width}-editor`);
    await button('사진 추가', '.stage');
    await settled('.inline-panel');
    assert.equal((await page.$$('[role="dialog"]')).length, 0);
    assert.equal((await page.$$('.inline-panel .poster-preview')).length, 0);
    assert.equal((await page.$$('.photo-empty button')).length, 2);
    assert.equal((await page.$$('.photo-actions, [aria-label="사진 배치"], input[aria-label="사진 불투명도"]')).length, 0);
    await button('샘플 사용', '.inline-panel');
    assert.equal((await page.$$('.empty-photo-button')).length, 0);
    assert.deepEqual(await page.$$eval('[aria-label="사진 배치"] button', buttons => buttons.map(button => button.textContent.trim())), ['전체 보기','영역 채우기']);
    assert.deepEqual(await page.$$eval('.photo-actions button', buttons => buttons.map(button => button.textContent.trim())), ['교체','자르기','제거','샘플']);
    if (width === 393) {
      await button('자르기', '.inline-panel');
      await page.waitForFunction(() => document.querySelector('[role="dialog"] h2')?.textContent === '이미지 자르기');
      await settled('[role="dialog"]');
      await shot('393-photo-crop');
      await closeDialog();
      assert.equal((await page.$$('.inline-panel')).length, 1);
      assert.equal(await page.$eval('.tool-grid [aria-pressed="true"]', element => element.dataset.tool), '사진');
    }
    await button('도구 닫기', '.inline-panel');
    await page.waitForSelector('.inline-panel', { hidden: true });

    await button('정보', '.tool-grid');
    await settled('.info-inspector');
    assert.equal((await page.$$('[role="dialog"]')).length, 0);
    assert.deepEqual(await page.$$eval('.info-inspector .field input', inputs => inputs.map(input => input.id)), ['title','release','reissue','runtime','original','actors']);
    assert.equal((await page.$$('.info-inspector .field-rail, .info-inspector .field-navigation')).length, 0);
    assert.equal((await page.$$('.info-groups button')).length, 3);
    assert.equal((await page.$$('.stage .ticket-natural .inline-panel')).length, 0);
    await page.click('.info-inspector #actors');
    assert.equal(await page.$eval('.info-inspector #actors', element => document.activeElement === element), true);
    assert.equal(await page.$eval('.info-inspector #actors', element => element.closest('.field').dataset.active), 'true');
    await button('영화명 표시 설정', '.info-inspector');
    await page.waitForSelector('[role="dialog"]', { visible: true });
    await closeDialog();
    assert.equal(await page.$eval('.info-inspector .field input', element => element.id), 'title');
    await page.click('.info-inspector #title');
    assert.equal(await page.$eval('.info-inspector #title', element => document.activeElement === element), true);
    if ([320,393].includes(width)) await shot(`${width}-info`);
    if (width === 393) {
      await page.evaluate(() => { Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => innerHeight - 220 }); visualViewport.dispatchEvent(new Event('resize')); });
      await page.waitForSelector('.workspace.is-keyboard .live-ticket.field-focused');
      await shot('393-keyboard');
      const compact = await page.evaluate(() => {
        const input = document.querySelector('.info-inspector #title').getBoundingClientRect();
        const ticket = document.querySelector('.ticket-paper').getBoundingClientRect();
        const stage = document.querySelector('.stage').getBoundingClientRect();
        const title = document.querySelector('.stage [data-field-tap="title"]').getBoundingClientRect();
        return { inputBottom: input.bottom, ticketHeight: ticket.height, visibleHeight: visualViewport.height, panelHeight: document.querySelector('.info-inspector').getBoundingClientRect().height, headerHidden: getComputedStyle(document.querySelector('.topbar')).display === 'none', titleVisible: title.top >= stage.top - 1 && title.bottom <= stage.bottom + 1 };
      });
      assert(compact.inputBottom <= compact.visibleHeight + 1 && compact.ticketHeight >= 100 && compact.panelHeight <= 208 && compact.headerHidden && compact.titleVisible, JSON.stringify(compact));
      await page.evaluate(() => { delete visualViewport.height; visualViewport.dispatchEvent(new Event('resize')); });
      await page.waitForFunction(() => !document.querySelector('.workspace.is-keyboard'));
    }
    await button('도구 닫기', '.info-inspector');
    await page.waitForSelector('.info-inspector', { hidden: true });
    if (width === 393) {
      await page.click('.stage [data-field-tap="title"]');
      await page.waitForSelector('.info-inspector #title', { visible: true });
      assert.equal(await page.$eval('.info-inspector #title', element => document.activeElement === element), true);
      assert.equal((await page.$$('[role="dialog"]')).length, 0);
      await button('도구 닫기', '.info-inspector');
      await page.waitForSelector('.info-inspector', { hidden: true });
    }

    const panelHeights = [];
    for (const tool of ['정보','사진','디자인','색상','질감','로고']) {
      await button(tool, '.tool-grid');
      await settled('.inline-panel');
      const g = await geometry();
      const ui = await page.evaluate(() => {
        const panel = document.querySelector('.inline-panel'), tools = document.querySelector('.tools');
        const style = getComputedStyle(panel), toolStyle = getComputedStyle(tools);
        const panelTop = panel.getBoundingClientRect().top;
        return { panelRadius: style.borderTopLeftRadius, toolRadius: toolStyle.borderTopLeftRadius, panelShadow: style.boxShadow, toolShadow: toolStyle.boxShadow, animation: style.animationDuration, selectedToolRadius: getComputedStyle(document.querySelector('.tool-grid [aria-pressed="true"]')).borderTopLeftRadius, headerButtons: [...panel.querySelectorAll('.inline-header button')].map(b => ({ label: b.getAttribute('aria-label'), top: b.getBoundingClientRect().top - panelTop, height: b.getBoundingClientRect().height })) };
      });
      assert(g.ticket.height >= 100 && g.ticket.top >= g.stage.top - 1 && g.ticket.bottom <= g.stage.bottom + 1, JSON.stringify({ width, tool, g }));
      assert(g.panel.bottom <= height + 1 && g.viewport.scrollWidth <= width + 1 && g.viewport.scrollHeight <= height + 1, JSON.stringify({ width, tool, g }));
      assert(Number.parseFloat(ui.panelRadius) >= 18 && Number.parseFloat(ui.selectedToolRadius) >= 10 && Number.parseFloat(ui.animation) > 0, JSON.stringify({ width, tool, ui }));
      assert(ui.headerButtons.every(b => b.height >= 36 && b.top >= 11), JSON.stringify({ width, tool, ui }));
      panelHeights.push({height:g.panel.height,compact:tool==='색상',fixed:Boolean(await page.$('.color-fixed'))});
      assert.equal(await page.$eval('#inline-heading', element => getComputedStyle(element).position), 'absolute');
      if (tool === '디자인') {
        const rail = '[aria-label="티켓 디자인 목록"] > div:last-child';
        assert.equal(await page.$eval(`${rail} [aria-pressed="true"]`, element => element.getAttribute('aria-label')), 'Minimal');
        const before = await page.$eval('.stage .live-ticket', element => element.dataset.layout);
        await button('다음 디자인 보기', '[aria-label="티켓 디자인 목록"]');
        await page.waitForFunction(selector => document.querySelector(selector)?.scrollLeft > 0, {}, rail);
        assert.equal(await page.$eval('.stage .live-ticket', element => element.dataset.layout), before);
        await button('이전 디자인 보기', '[aria-label="티켓 디자인 목록"]');
        assert.equal(await page.$eval('.stage .live-ticket', element => element.dataset.layout), before);
        await button('Criterion', rail);
        await page.waitForFunction(() => document.querySelector('.stage .live-ticket')?.dataset.layout === 'criterion');
        assert.equal(await page.$eval(`${rail} [aria-pressed="true"]`, element => element.getAttribute('aria-label')), 'Criterion');
      }
      if (tool === '질감') assert((await page.$$('.inline-panel input[aria-label="소재 강도"]')).length === 1);
      if (tool === '로고') assert((await page.$$('.inline-panel input[aria-label="극장 로고 텍스트"]')).length === 1);
      if ([320,393].includes(width) && ['디자인','질감','로고'].includes(tool)) await shot(`${width}-${tool}`);
      report.geometry.push({ width, height, tool, ...g, ui });
      await button('도구 닫기', '.inline-panel');
      await page.waitForSelector('.inline-panel', { hidden: true });
    }
    assert(panelHeights.every(({height,compact,fixed}) => Math.abs(height - (fixed?136:compact?212:252)) < 1), JSON.stringify({ width, panelHeights }));
    await button('완료', '.topbar');
    await page.waitForSelector('.info-inspector #title', { visible: true });
    assert.equal(await page.$eval('.info-inspector #title', element => document.activeElement === element), true);
    assert.equal((await page.$$('.is-result')).length, 0);
    await page.keyboard.type(`직접 쓴 제목 ${width}`);
    await page.waitForFunction(expected => document.querySelector('.info-inspector #title')?.value === expected, {}, `직접 쓴 제목 ${width}`);
    await button('도구 닫기', '.info-inspector');
    await page.waitForSelector('.info-inspector', { hidden: true });
    await button('디자인', '.tool-grid');
    assert.deepEqual(await page.$$eval('[aria-label="티켓 디자인 목록"] > div:last-child button', (buttons, title) => buttons.map(button => button.querySelector('.live-ticket')?.textContent.includes(title)), `직접 쓴 제목 ${width}`), [true,true,true,true,true,true]);
    await button('도구 닫기', '.inline-panel');
    await button('미리보기', '.stage');
    await page.waitForSelector('[role="dialog"]', { visible: true });
    assert.equal((await page.$$('[role="dialog"] .preview-tools button')).length, 1);
    await closeDialog();
    await button('완료', '.topbar');
    await settled('.is-result');
    assert.equal((await page.$$('.tools')).length, 0);
    assert.equal((await page.$$('.info-inspector')).length, 0);
    assert.equal((await page.$$('.result-share')).length, 1);
    assert.equal((await page.$$('.landing-brand')).length, 0);
    assert.equal((await page.$$('.stage [data-field-tap]')).length, 0);
    const result = await geometry();
    assert(result.ticket.height >= 100 && result.viewport.scrollWidth <= width + 1, JSON.stringify(result));
    if ([320,393].includes(width)) await shot(`${width}-result`);
    await button('저장 및 공유', '.result-actions');
    await page.waitForSelector('[role="dialog"] .share-summary');
    assert.equal(await page.$eval('.share-copy strong', element => element.textContent), `직접 쓴 제목 ${width}`);
    await closeDialog();
    assert.equal((await page.$$('.is-result')).length, 1);
    await button('다시 편집', '.result-actions');
    await settled('.workspace:not(.is-result)');
    assert.equal((await page.$$('.result-share')).length, 0);
    assert.equal(await page.$eval('.stage .live-ticket', element => element.dataset.layout), 'criterion');
    assert((await page.$eval('.stage .ticket-natural', element => element.textContent)).includes(`직접 쓴 제목 ${width}`));
    report.checks.push(`${width}×${height}: passive landing, blank Minimal editor, six contextual modules, title gate, preview, result share, edit return`);
  }

  await fresh(393, 659);
  await page.waitForFunction(() => [...document.querySelectorAll('.landing-card')].some(element => element.style.opacity === '1' && element.querySelector('img')?.getAttribute('src')?.includes('hero-criterion')), { timeout: 12000 });
  report.checks.push('Landing cards advance automatically after 10 seconds');

  await fresh(393, 659);
  await button('티켓 만들기', '.landing-bottom');
  await button('완료', '.topbar');
  await page.waitForSelector('.info-inspector #title', { visible: true });
  await page.keyboard.type('새 티켓 경로');
  await button('도구 닫기', '.info-inspector');
  await button('완료', '.topbar');
  await button('서비스 메뉴', '.topbar');
  await button('새 티켓', '[role="dialog"]');
  await button('새로 만들기', '[role="dialog"]');
  await settled('.workspace:not(.is-result)');
  assert.equal((await page.$$('.result-share')).length, 0);
  assert.equal(await page.$eval('.stage .ticket-natural', element => element.textContent.includes('새 티켓 경로')), false);
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => history.state?.filmeView === 'result');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal((await page.$$('.is-result, .result-share, [role="dialog"] .share-summary')).length, 0);
  assert.equal(await page.$eval('.stage .ticket-natural', element => element.textContent.includes('새 티켓 경로')), false);
  report.checks.push('New ticket from result menu returns to blank editor; browser Back cannot restore stale result');

  await fresh(393, 659, true);
  await button('티켓 만들기', '.landing-bottom');
  await button('디자인', '.tool-grid');
  const reduced = await page.$eval('.inline-panel', element => ({ duration: getComputedStyle(element).animationDuration, transition: getComputedStyle(element).transitionDuration }));
  assert.equal(reduced.duration, '0s');
  assert.equal(reduced.transition, '0s');
  report.checks.push('Reduced motion removes module animation and transitions');
  assert.deepEqual(report.pageErrors, []);
} catch (error) {
  report.failures.push(String(error.stack || error));
} finally {
  writeFileSync(`${output}experience-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
if (report.failures.length) throw new Error(report.failures.join('\n'));
console.log(`Experience checks passed: ${report.checks.length}; ${report.screenshots.length} screenshots`);
