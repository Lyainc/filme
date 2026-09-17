/**
 * Criterion 프리셋 11종 × QuoteFont 9택의 실제 줄바꿈·클램프·블록 높이를 잰다 (#757).
 * bun scripts/measure-quote-preset-widths.mjs --url http://localhost:3010/ --out /tmp/quotes.png
 * 문구·폰트 배율·슬롯 스타일을 복제하지 않고 현재 MoodCriterion을 렌더한다.
 * next/font CSS는 실행 중인 같은 checkout의 페이지에서 받아야 한다.
 */
import puppeteer from 'puppeteer-core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodCriterion } from '../src/components/moods/MoodCriterion.tsx';
import { SAMPLE_TICKETS } from '../src/constants/sampleTickets.ts';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const url = arg('url', 'http://localhost:3000/');
const out = arg('out', null);
const fonts = ['auto', 'gothic', 'batang', 'hand', 'ink', 'eunyoung', 'brush', 'coolguy', 'flower'];
const sample = SAMPLE_TICKETS.find((s) => s.components.layout === 'criterion');
const cases = fonts.flatMap((quoteFont) => Array.from({ length: 11 }, (_, i) => ({
  quoteFont,
  rating: i / 2,
  html: renderToStaticMarkup(createElement(MoodCriterion, {
    movieInfo: { ...sample.movieInfo, quote: '', rating: i / 2 },
    components: { ...sample.components, quoteFont },
    croppedImageUrl: null,
    onField() {},
  })),
})));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});
let exitCode = 1;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 1800, deviceScaleFactor: 1 });
  const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  if (!response?.ok()) throw new Error(`페이지 로드 실패: ${response?.status()}`);
  const result = await page.evaluate(async (cases) => {
    const main = document.querySelector('[data-font-root]');
    if (!main) throw new Error('next/font 루트를 찾을 수 없다');
    const host = document.createElement('div');
    host.style.cssText = 'position:relative;width:960px;height:1534px';
    const sheet = document.createElement('div');
    sheet.id = 'quote-measurements';
    sheet.style.cssText = 'position:relative;width:840px;background:#fff;color:#14120f;padding:20px';
    main.replaceChildren(host, sheet);
    const rows = [];
    for (const entry of cases) {
      host.innerHTML = entry.html;
      const slot = host.querySelector('[data-field-tap="quote"]');
      const text = slot?.firstElementChild;
      if (!text?.textContent) throw new Error('실제 한줄평 노드를 찾을 수 없다');
      const style = getComputedStyle(text);
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const faces = await document.fonts.load(font, text.textContent);
      // check()만으로는 미등록 family도 true다. 실제 face가 로드됐는지도 확인한다.
      const loaded = faces.length > 0 && faces.every((f) => f.status === 'loaded') && document.fonts.check(font, text.textContent);
      const clampedHeight = text.getBoundingClientRect().height;
      const clamp = text.style.webkitLineClamp;
      text.style.webkitLineClamp = 'unset';
      const naturalHeight = text.getBoundingClientRect().height;
      const lineHeight = parseFloat(style.lineHeight);
      const lines = Math.round(naturalHeight / lineHeight);
      const slotHeight = slot.getBoundingClientRect().height;
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = font;
      const widthPx = +ctx.measureText(text.textContent).width.toFixed(1);
      text.style.webkitLineClamp = clamp;
      const clipped = naturalHeight > clampedHeight + 1 || text.scrollWidth > text.clientWidth + 1;
      const pass = loaded && lines <= 2 && !clipped && naturalHeight <= slotHeight + 1;
      rows.push({ quoteFont: entry.quoteFont, rating: entry.rating, text: text.textContent,
        fontSize: style.fontSize, lineHeight, widthPx, lines, clampedHeight, naturalHeight, slotHeight, loaded, clipped, pass });
      // 최장 프리셋과 실패 케이스는 실제 조판을 그대로 남겨 육안으로도 확인한다.
      if (entry.rating === 5 || !pass) {
        const label = document.createElement('div');
        label.textContent = `${entry.quoteFont} / ${entry.rating || 'default'} / ${lines} lines / ${pass ? 'PASS' : 'FAIL'}`;
        label.style.cssText = 'font:16px sans-serif;padding-top:12px';
        const block = slot.parentElement.cloneNode(true);
        block.style.position = 'relative';
        block.style.left = '0';
        block.style.right = 'auto';
        block.style.top = '0';
        block.style.width = '792px';
        sheet.append(label, block);
      }
    }
    host.remove();
    return rows;
  }, cases);
  if (out) await (await page.$('#quote-measurements')).screenshot({ path: out });
  const report = {
    url,
    checked: result.length,
    perFont: fonts.map((quoteFont) => {
      const rows = result.filter((r) => r.quoteFont === quoteFont);
      const worst = rows.reduce((a, b) => a.widthPx > b.widthPx ? a : b);
      return { quoteFont, fontSize: worst.fontSize, lineHeight: worst.lineHeight,
        worstWidthPx: worst.widthPx, worstRating: worst.rating,
        maxLines: Math.max(...rows.map((r) => r.lines)),
        maxHeight: Math.max(...rows.map((r) => r.naturalHeight)),
        pass: rows.every((r) => r.pass) };
    }),
    failures: result.filter((r) => !r.pass),
    pass: result.every((r) => r.pass),
  };
  console.log(JSON.stringify(report, null, 2));
  exitCode = report.pass ? 0 : 1;
} finally {
  await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 3000))]);
}
process.exit(exitCode);
