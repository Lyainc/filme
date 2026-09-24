import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
// Companion to measure-chrome.mjs: mobile input/hit tests, not iPhone Safari proof.
// bun scripts/measure-mobile-editor.mjs after /tmp/filme-mobile http://localhost:3712
const phase = process.argv[2] ?? 'after';
const root = process.argv[3] ?? '/tmp/filme-mobile-editor';
const url = process.argv[4] ?? 'http://localhost:3712';
fs.mkdirSync(root, { recursive: true });
const verify = phase === 'after';
const failures = [];
const check = (ok, name) => { if (verify && !ok)
    failures.push(name); };
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const all = [];
try {
    for (const [width, height] of [[320, 568], [375, 667], [393, 659], [414, 736]]) {
        const p = await b.newPage();
        await p.setViewport({ width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
        await p.goto(url, { waitUntil: 'networkidle2' });
        await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.includes('포스터 없이 직접 입력')).click());
        await sleep(700);
        const shot = async (name) => p.screenshot({ path: `${root}/${phase}-${width}-${name}.png` });
        const rects = async () => p.evaluate(() => { const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }; return { overflow: document.documentElement.scrollWidth > innerWidth, preview: rect(document.querySelector('.crop-marks')), fields: [...document.querySelectorAll('[data-field-tap]')].filter(e => e.getBoundingClientRect().width).map(e => ({ field: e.dataset.fieldTap, ...rect(e), hits: [0.1, 0.5, 0.9].map(f => { const r = e.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width * f, r.y + r.height / 2)?.closest('[data-field-tap]')?.getAttribute('data-field-tap') ?? null; }) })), panel: (() => { const e = document.querySelector('#design-rail-panel'); return { ...rect(e), scroll: e.scrollHeight, client: e.clientHeight }; })() }; });
        const row = { width, height, initial: await rects() };
        row.header = await p.evaluate(() => [...document.querySelectorAll('header button, header h1')].map(e => {
            const r = e.getBoundingClientRect();
            return { label: e.getAttribute('aria-label') ?? e.textContent, left: r.left, right: r.right, width: r.width, height: r.height };
        }));
        check(row.header.every((r, i, a) => r.left >= 0 && r.right <= width && (!i || r.left >= a[i - 1].right)), `${width}: header fit/overlap`);
        await shot('empty');
        row.autosave = await p.evaluate(() => { const btn = document.querySelector('button[role=switch][aria-label^="자동"]'); const caption = [...document.querySelectorAll('span')].find(e => e.textContent.trim() === '자동저장' && e.children.length === 0); const r = caption.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { before: btn.getAttribute('aria-checked'), hit: hit?.closest('button') === btn, rect: { w: btn.offsetWidth, h: btn.offsetHeight } }; });
        row.autosave.toggles = [];
        for (const target of ['caption', 'dot']) {
            const pt = await p.evaluate(target => {
                const button = document.querySelector('button[role=switch][aria-label^="자동"]');
                const e = target === 'caption' ? button.querySelector('span.whitespace-nowrap') : button.querySelector('span.relative');
                const r = (e ?? button).getBoundingClientRect();
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            }, target);
            await p.touchscreen.tap(pt.x, pt.y);
            row.autosave.toggles.push(await p.$eval('button[role=switch][aria-label^="자동"]', e => e.getAttribute('aria-checked')));
        }
        check(row.autosave.toggles.join(',') === 'false,true', `${width}: autosave caption/dot`);
        await p.evaluate(() => document.querySelector('[data-field-tap="signature"]').click());
        await p.waitForSelector('input[aria-label="서명"]');
        await sleep(350);
        row.typing = [];
        await p.focus('input[aria-label="서명"]');
        for (const c of 'UXTEST') {
            await p.keyboard.type(c);
            row.typing.push(await p.evaluate(() => ({ input: document.querySelector('input[aria-label="서명"]').value, shown: document.querySelector('[data-field-tap="signature"]').textContent })));
            await sleep(70);
        }
        await shot('typing');
        check(row.typing.every(r => r.shown.endsWith(r.input)), `${width}: immediate typing`);
        await p.evaluate(() => document.querySelector('button[aria-label="편집 완료"]').click());
        await sleep(350);
        const rail = async (id) => { await p.evaluate(id => document.querySelector(`[data-rail-id="${id}"]`).click(), id); await sleep(750); };
        await rail('opacity');
        row.opacity = await rects();
        row.ranges = await p.evaluate(() => [...document.querySelectorAll('#design-rail-panel input[type=range]')].map(e => { const r = e.getBoundingClientRect(); return { id: e.id, w: r.width, h: r.height, y: r.y, hits: [-20, -15, -10, -3, 0, 3, 10, 15, 20].map(d => ({ d, hit: document.elementFromPoint(r.x + r.width * .25, r.y + r.height / 2 + d) === e })) }; }));
        await shot('opacity');
        row.sliderGestures = [];
        for (const id of ['rail-poster-opacity', 'rail-component-opacity']) {
            await p.$eval(`#${id}`, e => e.scrollIntoView({ block: 'center' }));
            await sleep(100);
            const r = await p.$eval(`#${id}`, e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, min: +e.min, max: +e.max, value: e.value }; });
            await p.touchscreen.tap(r.x + r.w * .25, r.y + r.h / 2 + 10);
            await sleep(100);
            const tapped = await p.$eval(`#${id}`, e => +e.value);
            const cdp = await p.createCDPSession();
            const at = fraction => ({ x: r.x + r.w * fraction, y: r.y + r.h / 2 + 10 });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(.25)] });
            for (const f of [.35, .45, .55, .65, .75])
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(f)] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await sleep(100);
            const dragged = await p.$eval(`#${id}`, e => +e.value);
            await cdp.detach();
            await p.$eval(`#${id}`, (e, value) => {
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, value);
                e.dispatchEvent(new Event('input', { bubbles: true }));
            }, r.value);
            await sleep(350);
            row.sliderGestures.push({ id, tapped, dragged });
            check(tapped < dragged, `${width}: range tap/drag ${id}`);
        }
        check(row.ranges.every(r => r.h >= 32 && r.hits.filter(h => Math.abs(h.d) <= 15).every(h => h.hit)), `${width}: range hit area`);
        await rail('size');
        await p.evaluate(() => [...document.querySelectorAll('[role=radio]')].find(e => e.textContent === '로고')?.click());
        await sleep(350);
        row.logo = await rects();
        await shot('logo');
        await rail('custom');
        row.custom = await rects();
        row.fonts = await p.evaluate(() => [...document.querySelectorAll('[role=radiogroup][aria-label="서명 폰트"] button')].map(e => ({ name: e.textContent, w: e.getBoundingClientRect().width, font: getComputedStyle(e).fontFamily })));
        await shot('fonts');
        check(new Set(row.fonts.map(f => f.w)).size === 1, `${width}: font equal widths`);
        row.fontSelection = await p.evaluate(async () => {
            const group = document.querySelector('[role=radiogroup][aria-label="서명 폰트"]');
            const button = [...group.querySelectorAll('button')].find(e => e.textContent === '꽃길');
            button.scrollIntoView({ block: 'center' });
            await new Promise(r => setTimeout(r, 100));
            const r = button.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        });
        await p.touchscreen.tap(row.fontSelection.x, row.fontSelection.y);
        await p.evaluate(() => document.fonts.ready);
        await sleep(100);
        row.fontSelection.result = await p.evaluate(() => ({
            checked: [...document.querySelectorAll('[role=radiogroup][aria-label="서명 폰트"] button')].find(e => e.textContent === '꽃길').getAttribute('aria-checked'),
            preview: getComputedStyle(document.querySelector('[data-font-preview="signature"]') ?? document.body).fontFamily,
            scrollTop: document.querySelector('#design-rail-panel').scrollTop,
        }));
        check(row.fontSelection.result.checked === 'true', `${width}: scrolled font touch`);
        if (verify)
            await shot('fonts-scrolled');
        all.push(row);
        await p.close();
    }
    fs.writeFileSync(`${root}/${phase}.json`, JSON.stringify(all, null, 2));
    if (failures.length) {
        console.error(failures);
        process.exitCode = 1;
    }
    console.log(all.map(r => ({ width: r.width, preview: r.initial.preview, ranges: r.ranges, fonts: r.fonts.map(f => f.w), typing: r.typing, autosave: r.autosave })));
}
finally {
    await b.close();
}
