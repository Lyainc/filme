import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const root = process.argv[2] ?? '/tmp/filme-mobile-editor', results = [], fails = [];
const url = process.argv[3] ?? 'http://localhost:3712';
fs.mkdirSync(root, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
    const p = await b.newPage();
    for (const [width, height] of [[320, 568], [375, 667], [393, 659], [414, 736]]) {
        await p.setViewport({ width, height, isMobile: true, hasTouch: true });
        for (const locked of [false, true]) {
            await p.goto(url, { waitUntil: 'networkidle2' });
            await p.evaluate(locked => localStorage.setItem('filme:phototicket:v1', JSON.stringify({ movieInfo: { title: '복원한 제목', releaseDate: '2026', quote: '', signature: '' }, components: { layout: 'criterion', signatureImage: locked ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="20"><text y="16">image</text></svg>' : '', chainLabel: 'CINEMA', chainVisible: false, chainScale: 0.8 }, fieldVisibility: { releaseDate: false } })), locked);
            await p.reload({ waitUntil: 'networkidle2' });
            await p.click('[data-testid="landing-restore"]');
            await sleep(400);
            const restored = await p.evaluate(() => ({ title: document.querySelector('[data-field-tap="title"]').textContent, done: document.querySelector('button[aria-label="완료"]').getAttribute('aria-disabled') }));
            await p.evaluate(() => document.querySelector('[data-rail-id="custom"]').click());
            await sleep(650);
            const row = { width, locked, restored };
            const box = () => p.$eval('.crop-marks', e => ({ w: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height }));
            row.preview = await box();
            row.fonts = await p.evaluate(() => ({ loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family), groups: [...document.querySelectorAll('#design-rail-panel [role=radiogroup]')].map(g => ({ label: g.getAttribute('aria-label'), disabled: [...g.querySelectorAll('button')].map(b => b.disabled), widths: [...g.querySelectorAll('button')].map(b => b.getBoundingClientRect().width) })) }));
            const target = locked ? '#design-rail-panel p.text-caption' : '[data-font-preview="signature"]';
            await p.$eval(target, e => e.scrollIntoView({ block: 'center' }));
            await sleep(150);
            row.visibleNote = await p.$eval(target, e => { const r = e.getBoundingClientRect(), pr = document.querySelector('#design-rail-panel').getBoundingClientRect(); return { text: e.textContent, top: r.top, bottom: r.bottom, panelTop: pr.top, panelBottom: pr.bottom, inside: r.top >= pr.top && r.bottom <= pr.bottom }; });
            await p.screenshot({ path: `${root}/after-${width}-criterion-fonts-${locked ? 'locked' : 'empty'}.png` });
            row.afterScroll = await box();
            if (row.preview.w !== row.afterScroll.w || row.preview.h !== row.afterScroll.h || !row.visibleNote.inside)
                fails.push(`${width} ${locked}: scroll fit`);
            if (row.fonts.groups.length !== 2 || row.fonts.groups[1].disabled.some(d => d !== locked))
                fails.push(`${width}: font groups/lock`);
            if (restored.done !== 'false')
                fails.push(`${width}: restore hidden required year`);
            await p.evaluate(() => document.querySelector('[data-rail-id="size"]').click());
            await sleep(650);
            row.hiddenLogo = await p.$eval('#design-rail-panel', e => e.textContent);
            if (!row.hiddenLogo.includes('극장 로고가 숨겨져 있어요.'))
                fails.push(`${width}: hidden logo`);
            await p.screenshot({ path: `${root}/after-${width}-logo-hidden.png` });
            results.push(row);
        }
    }
    fs.writeFileSync(`${root}/panel-states.json`, JSON.stringify({ results, fails }, null, 2));
    console.log({ fails, scenes: results.length });
    if (fails.length)
        process.exitCode = 1;
}
finally {
    await b.close();
}
