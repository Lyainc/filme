import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox'] });
const page = await browser.newPage();
const output = new URL('./verification/', import.meta.url).pathname;
const report = { date:'2026-09-24', mode:'Chrome with simulated VisualViewport; not iPhone keyboard evidence', checks:[], geometry:[], failures:[], pageErrors:[] };
page.on('pageerror', error => report.pageErrors.push(String(error)));

async function button(label, root = 'body') {
  const handle = await page.evaluateHandle((selector, text) => [...(document.querySelector(selector)?.querySelectorAll('button') || [])]
    .find(el => el.textContent.trim() === text || el.getAttribute('aria-label') === text), root, label);
  const element = handle.asElement();
  assert(element, `Missing ${label} in ${root}`);
  await element.scrollIntoView();
  await element.click();
  await handle.dispose();
}
async function closeDialog() { await page.keyboard.press('Escape'); await page.waitForSelector('[role="dialog"]', { hidden:true }); }
async function closeInfo() { await button('도구 닫기', '.info-inspector'); await page.waitForSelector('.info-inspector', { hidden:true }); }
async function field(group, label, id) {
  if (!await page.$('.info-inspector')) await button('정보', '.tool-grid');
  await page.waitForSelector('.info-inspector');
  await button(group, '.info-groups');
  await page.waitForSelector(`.info-inspector #${id}`);
  assert((await page.$$('.info-inspector .field')).length > 1);
  assert((await page.$eval(`#${id}`, el => el.closest('.field').querySelector('.field-label label').textContent.trim())).startsWith(label));
  assert.equal((await page.$$('.info-inspector .field-rail')).length, 0);
  await page.click(`.info-inspector #${id}`);
}
async function setInput(selector, value) {
  await page.$eval(selector, input => { input.focus(); input.select(); });
  await page.type(selector, value);
  await page.waitForFunction((selector, value) => document.querySelector(selector)?.value === value, {}, selector, value);
}
async function viewport(height, top = 0, event = 'resize') {
  await page.evaluate(({height,top,event}) => {
    Object.defineProperty(visualViewport,'height',{value:height,configurable:true});
    Object.defineProperty(visualViewport,'offsetTop',{value:top,configurable:true});
    visualViewport.dispatchEvent(new Event(event));
  }, { height, top, event });
  await page.waitForFunction(height => document.documentElement.style.getPropertyValue('--visible-height') === `${height}px`, {}, height);
}
async function visible(selector) {
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('.workspace,.inline-panel,.panel')]
      .flatMap(el => el.getAnimations().map(animation => animation.finished.catch(() => {}))));
  });
  const rect = await page.$eval(selector, el => { const r=el.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, visibleTop:visualViewport.offsetTop, visibleBottom:visualViewport.offsetTop+visualViewport.height }; });
  assert(rect.top >= rect.visibleTop - 1 && rect.bottom <= rect.visibleBottom + 1, JSON.stringify({selector,rect}));
  return rect;
}

try {
  await page.setViewport({ width:393, height:659, isMobile:true, hasTouch:true, deviceScaleFactor:1 });
  await page.goto('http://127.0.0.1:3793/docs/mockups/filme-mobile-v2/index.html', { waitUntil:'networkidle0' });
  await page.evaluate(() => { localStorage.removeItem('filme-mockup-v2'); localStorage.removeItem('filme-mockup-v2-autosave'); });
  await page.reload({ waitUntil:'networkidle0' });
  // The editor measures keyboard occlusion against the unchanged layout viewport.
  assert.match(await page.$eval('meta[name="viewport"]', el => el.content), /interactive-widget=resizes-visual(?:,|$)/);
  await page.click('.landing-start');
  await page.waitForSelector('.workspace');
  assert.equal((await page.$$('.quick-actions')).length, 0);
  await button('정보 가져오기', '.topbar');
  await page.waitForSelector('[role="dialog"]');
  await button('영화 검색', '[role="dialog"]');
  await page.$eval('[role="dialog"]', async el => {
    await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const importRect = await page.$eval('[role="dialog"]', el => { const r=el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, centerX:(r.left+r.right)/2, centerY:(r.top+r.bottom)/2, width:innerWidth, height:innerHeight }; });
  assert(importRect.left >= 11 && importRect.top >= 11 && importRect.right <= importRect.width-11 && importRect.bottom <= importRect.height-11 && Math.abs(importRect.centerX-importRect.width/2) <= 2 && Math.abs(importRect.centerY-importRect.height/2) <= 2, JSON.stringify(importRect));
  assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), 'INPUT');
  await closeDialog();
  report.checks.push('Fresh landing creates a blank document; header import search stays centered and does not autofocus on touch');

  await field('기록','별점','rating');
  await setInput('#rating', '4.3');
  await button('영화', '.info-groups');
  await field('기록','별점','rating');
  assert.equal(await page.$eval('#rating', el => el.value), '4.3');
  assert.equal(await page.$eval('#rating', el => el.getAttribute('aria-invalid')), 'true');
  assert(await page.$('#rating-error'));
  await setInput('#rating', '6');
  assert.equal(await page.$eval('#rating', el => el.getAttribute('aria-invalid')), 'true');
  await setInput('#rating', '4.5');
  assert.equal(await page.$eval('#rating', el => el.getAttribute('aria-invalid')), 'false');
  await field('영화','상영 시간','runtime');
  await setInput('#runtime', '118.5');
  assert.equal(await page.$eval('#runtime', el => el.getAttribute('aria-invalid')), 'true');
  await page.screenshot({path:output+'v6-393-number-validation.png'});
  await setInput('#runtime', '118');
  assert.equal(await page.$eval('#runtime', el => el.getAttribute('aria-invalid')), 'false');
  report.checks.push('Invalid numeric text and associated errors persist until corrected');

  await setInput('#title', '숫자 입력 검증');
  for (const value of ['118.0', '1.18e2']) {
    await setInput('#runtime', value);
    assert.equal(await page.$eval('#runtime', el => el.getAttribute('aria-invalid')), 'false');
    await page.waitForFunction(() => document.querySelector('.stage [data-field-tap="runtime"]')?.textContent.includes('118'));
    await button('완료', '.topbar');
    await page.waitForSelector('.is-result');
    assert(await page.$eval('.stage .ticket-natural', el => el.textContent.includes('118')));
    await page.waitForFunction(value => JSON.parse(localStorage.getItem('filme-mockup-v2')).fields.runtime === value, {}, value);
    await button('다시 편집', '.topbar');
    await field('영화', '상영 시간', 'runtime');
    assert.equal(await page.$eval('#runtime', el => el.value), value);
  }
  await page.reload({ waitUntil:'networkidle0' });
  await page.click('.landing-resume');
  await field('영화', '상영 시간', 'runtime');
  assert.equal(await page.$eval('#runtime', el => el.value), '1.18e2');
  assert(await page.$eval('.stage [data-field-tap="runtime"]', el => el.textContent.includes('118')));
  report.checks.push('Valid decimal and exponent integer input renders as minutes through completion and draft reload without rewriting the input');

  const layoutHeight = await page.evaluate(() => innerHeight);
  await viewport(340);
  await page.waitForSelector('.workspace.is-keyboard');
  assert.equal(await page.evaluate(() => innerHeight), layoutHeight);
  report.geometry.push({case:'resizes-visual keyboard contract',panel:await visible('.info-inspector'),input:await visible('#runtime')});
  await viewport(layoutHeight);
  await page.waitForFunction(() => !document.querySelector('.workspace.is-keyboard'));
  report.checks.push('Explicit resizes-visual contract keeps keyboard detection and focused input in view, then restores the editor');

  await page.$eval('#title', el => { el.focus(); el.select(); });
  await page.keyboard.press('Backspace');
  const ime = await page.createCDPSession();
  await page.$eval('#title', el => {
    window.compositionEvents = [];
    for (const type of ['compositionstart','compositionupdate','compositionend']) el.addEventListener(type, event => window.compositionEvents.push({type:event.type,data:event.data}));
  });
  for (const text of ['ㅎ','한','한글']) {
    await ime.send('Input.imeSetComposition', {text,selectionStart:text.length,selectionEnd:text.length});
    assert.equal(await page.$eval('#title', el => el.value), text);
    assert(await page.$eval('.stage [data-field-tap="title"]', (el, text) => el.textContent.includes(text), text));
  }
  await page.$eval('#title', el => el.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true,isComposing:true})));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'title');
  await ime.send('Input.insertText', {text:'한글'});
  assert((await page.evaluate(() => window.compositionEvents)).some(event => event.type === 'compositionend'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement.id === 'release');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('filme-mockup-v2')).fields.title === '한글');
  await ime.detach();
  report.checks.push('Chrome IME composition updates the ticket, composing Enter retains focus, committed Enter advances, and draft stores committed Korean text (not OS keyboard evidence)');
  await field('영화','상영 시간','runtime');

  await viewport(320, 80);
  report.geometry.push({case:'393 keyboard',panel:await visible('.info-inspector')});
  assert(await page.$('.workspace.is-keyboard'));
  await field('관람','좌석','seat');
  await page.$eval('#seat', el => el.scrollIntoView({block:'center'}));
  assert(await page.$eval('#seat', el => { const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }));
  await viewport(320, 100, 'scroll');
  report.geometry.push({case:'393 panned keyboard',panel:await visible('.info-inspector')});
  await page.screenshot({path:output+'v6-393-simulated-keyboard.png'});
  await viewport(659);
  await closeInfo();
  report.checks.push('Inline inspector and selected input remain reachable with reduced and panned visual viewport');

  await page.setViewport({width:320,height:568,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await page.click('.stage [data-field-tap="title"]');
  await page.waitForSelector('.info-inspector #title');
  assert.equal(await page.$eval('#title', el => document.activeElement===el), true);
  assert.equal((await page.$$('[role="dialog"]')).length, 0);
  await viewport(260,60);
  report.geometry.push({case:'320 ticket tap keyboard',panel:await visible('.info-inspector'),input:await visible('#title')});
  await page.screenshot({path:output+'v6-320-direct-keyboard.png'});
  await viewport(568);
  await page.keyboard.press('Escape');
  await page.waitForSelector('.info-inspector',{hidden:true});
  report.checks.push('Ticket field tap focuses inline input, fits the keyboard viewport, and closes with Escape');

  await button('전체 화면 미리보기', '.stage');
  await page.waitForSelector('.fullscreen');
  await page.click('.fullscreen-stage .ticket-paper');
  assert.equal(await page.$('.zoomed'), null);
  await button('확대', '.preview-tools');
  assert(await page.$('.zoomed'));
  await button('화면에 맞추기', '.preview-tools');
  await viewport(300,40);
  report.geometry.push({case:'320 preview keyboard',panel:await visible('.panel')});
  await viewport(568);
  await closeDialog();
  report.checks.push('Preview zoom uses explicit control and dialog follows the panned viewport');
  assert.deepEqual(report.pageErrors, []);
} catch (error) {
  report.failures.push(String(error.stack || error));
} finally {
  await Bun.write(output+'mobile-report.json', JSON.stringify(report,null,2));
  await browser.close();
}
console.log(JSON.stringify({checks:report.checks.length,failures:report.failures,pageErrors:report.pageErrors}));
if (report.failures.length || report.pageErrors.length) process.exitCode = 1;
