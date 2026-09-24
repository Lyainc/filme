import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const root = process.argv[2] ?? '/tmp/filme-mobile-editor';
const url = process.argv[3] ?? 'http://localhost:3712';
fs.mkdirSync(root, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = { ime: [], fields: [], special: [] }, fails = [];
const check = (ok, label) => { if (!ok)
    fails.push(label); };
try {
    const p = await b.newPage();
    await p.setViewport({ width: 393, height: 659, isMobile: true, hasTouch: true });
    const seed = async (state) => {
        await p.goto(url, { waitUntil: 'networkidle2' });
        await p.evaluate(state => localStorage.setItem('filme:phototicket:v1', JSON.stringify(state)), state);
        await p.reload({ waitUntil: 'networkidle2' });
        await p.evaluate(() => document.querySelector('[data-testid=landing-restore]').click());
        await sleep(500);
    };
    await seed({ movieInfo: { title: '테스트', releaseDate: '2026', signature: 'ABCD' } });
    await p.click('[data-field-tap="signature"]');
    await p.waitForSelector('input[aria-label="서명"]');
    await sleep(400);
    const read = () => p.evaluate(() => { const e = document.querySelector('input[aria-label="서명"]'); return { value: e.value, start: e.selectionStart, end: e.selectionEnd, shown: document.querySelector('[data-field-tap="signature"]').textContent }; });
    await p.$eval('input[aria-label="서명"]', e => { e.focus(); e.setSelectionRange(2, 2); });
    await p.keyboard.type('X');
    results.cursorInsert = await read();
    check(results.cursorInsert.value === 'ABXCD' && results.cursorInsert.start === 3, 'cursor middle insertion');
    await p.keyboard.press('Backspace');
    results.cursorDelete = await read();
    check(results.cursorDelete.value === 'ABCD' && results.cursorDelete.start === 2, 'cursor deletion');
    const cdp = await p.createCDPSession();
    for (const text of ['ㅎ', '하', '한']) {
        await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
        const r = await read();
        results.ime.push(r);
        check(r.shown.endsWith(r.value), 'IME immediate ' + text);
    }
    await cdp.send('Input.insertText', { text: '한' });
    results.imeCommit = await read();
    check(results.imeCommit.value === 'AB한CD', 'IME commit');
    await p.screenshot({ path: `${root}/after-ime.png` });
    await sleep(500);
    await p.evaluate(() => document.querySelector('button[aria-label="편집 완료"]').click());
    await p.click('button[aria-label="실행 취소"]');
    await sleep(350);
    results.undo = await p.$eval('[data-field-tap="signature"]', e => e.textContent);
    check(results.undo.endsWith('ABCD'), 'undo signature');
    await p.click('button[aria-label="다시 실행"]');
    await sleep(350);
    results.redo = await p.$eval('[data-field-tap="signature"]', e => e.textContent);
    check(results.redo.endsWith('AB한CD'), 'redo signature');
    await p.click('button[aria-label="완료"]');
    await p.waitForSelector('[data-testid="result-ambient"]');
    results.result = await p.$eval('[data-testid="result-ambient"]', e => e.parentElement.textContent);
    check(results.result.includes('AB한CD'), 'latest result');
    for (const width of [320, 375, 393, 414]) {
        await p.setViewport({ width, height: width === 320 ? 568 : width === 414 ? 736 : 667, isMobile: true, hasTouch: true });
        for (const layout of ['minimal', 'criterion', '35mm', 'editorial', 'stub', '35mm-landscape']) {
            await seed({ movieInfo: { title: '제목', releaseDate: '2026', signature: '기록', quote: '영화의 순간', watchDate: '2026-09-17', watchTime: '13:00', theater: '극장', screen: '1관', seat: 'A1', actors: '출연진' }, components: { layout } });
            const fields = await p.evaluate(() => [...document.querySelectorAll('[data-field-tap]')].map(e => {
                const r = e.getBoundingClientRect();
                const points = [[.5, .5], [.1, .5], [.9, .5], [.5, .1], [.5, .9], [1 / r.width, .5], [1 - 1 / r.width, .5], [.5, 1 / r.height], [.5, 1 - 1 / r.height]].map(([x, y]) => { const hit = document.elementFromPoint(r.x + r.width * x, r.y + r.height * y); return { x, y, field: hit?.closest('[data-field-tap]')?.getAttribute('data-field-tap') ?? null, coveredBy: hit?.closest('button')?.getAttribute('aria-label') ?? null }; });
                return { field: e.dataset.fieldTap, x: r.x, y: r.y, w: r.width, h: r.height, points };
            }));
            results.fields.push({ width, layout, fields });
            await p.click('button[aria-label="티켓 항목 목록 열기"]');
            await p.waitForSelector('[role=dialog][aria-label="티켓 항목"]');
            // Wait for the entry animation before a physical click inside the drawer.
            await p.$eval('[role=dialog][aria-label="티켓 항목"]', async e => {
                await Promise.all(e.getAnimations().map(a => a.finished));
            });
            if (layout === 'criterion') {
                await p.$eval('button[aria-label="한줄평 편집"]', e => e.scrollIntoView({ block: 'center' }));
                await p.click('button[aria-label="한줄평 편집"]');
                await p.waitForSelector('input[aria-label="한줄평"]');
                results.special.push({ width, layout, quoteListInput: await p.$eval('input[aria-label="한줄평"]', e => e.value) });
            }
            if (width === 320 || width === 393)
                await p.screenshot({ path: `${root}/after-${width}-${layout}-list.png` });
        }
    }
    fs.writeFileSync(`${root}/deep.json`, JSON.stringify({ ...results, fails }, null, 2));
    console.log({ fails, cursorInsert: results.cursorInsert, ime: results.ime, undo: results.undo, redo: results.redo, fieldScenes: results.fields.length });
    if (fails.length)
        process.exitCode = 1;
}
finally {
    await b.close();
}
