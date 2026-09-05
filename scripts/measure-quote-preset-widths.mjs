/**
 * Criterion 한줄평 프리셋 안전마진 재실측 — QuoteFont 9택 전체 (#757).
 *
 *   bun scripts/measure-quote-preset-widths.mjs                      # http://localhost:3000/
 *   bun scripts/measure-quote-preset-widths.mjs --url http://localhost:3010/
 *   CHROME_PATH=/usr/bin/google-chrome bun scripts/measure-quote-preset-widths.mjs
 *
 * `MoodCriterion.tsx`의 한줄평 안전마진 주석(346-359줄)이 "고딕(Pretendard)이 가장 넓어
 * 기준선"이라 적어뒀지만, 그 실측은 QuoteFont가 4택이던 #558 시절 3종(세리프/손글씨/고딕)뿐이고
 * 이후 늘어난 batang/ink/eunyoung/coolguy/flower 5종은 한 번도 안 재봤다(#754 검증에서 다른
 * 방법론으로 재보니 batang이 gothic보다 넓게 나와 "고딕 최악" 단정 자체가 근거 부족이었다).
 *
 * 재는 값은 예전 주석과 같은 방법(canvas measureText 자연 폭 = 줄바꿈 없을 때 폭)이다 — 실제
 * 워드랩 줄 수는 못 재지만(overflowWrap:anywhere라 정확한 시뮬레이션은 DOM 레이아웃이 필요),
 * 이 비율(자연 폭 / 600px 슬롯)이 기존 "1200px 넘으면 3줄 위험"이라는 안전마진 판정 기준이라
 * 같은 방법으로 재야 새/구 판정이 비교 가능하다.
 *
 * 대상 텍스트는 프리셋 전부(RATING_QUOTES 10종 + DEFAULT_QUOTE) — "가장 긴 게 최악"이 폰트마다
 * 안 갈린다는 게 이 이슈의 요지라, 글자 수 최장 하나만 재면 같은 실수를 반복한다.
 */
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const URL = arg('url', 'http://localhost:3000/');
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// MoodCriterion.tsx의 RATING_QUOTES/DEFAULT_QUOTE와 같은 값이어야 한다 — 문구를 바꾸면 이 표도
// 같이 바꿀 것.
const TEXTS = [
  { id: '0.5', text: 'two hours of my life, respectfully declined' },
  { id: '1', text: 'a film with the courage of no convictions' },
  { id: '1.5', text: 'the credits were the best part' },
  { id: '2', text: 'all style, no pulse' },
  { id: '2.5', text: 'watchable. forgettable. in that order' },
  { id: '3', text: 'competent — and that is the whole review' },
  { id: '3.5', text: 'sharper than its trailer let on' },
  { id: '4', text: 'the kind of film you quote at dinner' },
  { id: '4.5', text: 'nearly perfect, and knows it' },
  { id: '5', text: 'the film every other film will be measured against' },
  { id: 'default', text: 'the paying customer is the last honest critic' },
];

// QuoteFont 9택이 영문(프리셋은 항상 영문)에서 실제로 고르는 폰트 스택 + fontStyle +
// LATIN_SIZE_SCALE(`_shared.tsx`) — userTextFont가 영문에서 'auto'를 'latin'(Instrument Serif
// 이탤릭)으로 푸는 것까지 그대로 반영한다. 스택·배율이 바뀌면 이 표도 같이 갱신할 것.
const TARGETS = [
  { quoteFont: 'auto', id: 'latin', label: '자동(Instrument Serif)', stack: 'var(--font-display), Georgia, "Times New Roman", serif', fontStyle: 'italic', scale: 1 },
  { quoteFont: 'gothic', id: 'gothic', label: '고딕', stack: 'var(--font-sans), "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif', fontStyle: 'normal', scale: 1.002 },
  { quoteFont: 'batang', id: 'batang', label: '바탕', stack: 'var(--font-batang), serif', fontStyle: 'normal', scale: 1.039 },
  { quoteFont: 'hand', id: 'hand', label: '자람', stack: 'var(--font-quote-kr), cursive', fontStyle: 'normal', scale: 1.25 },
  { quoteFont: 'ink', id: 'ink', label: '잉크', stack: 'var(--font-ink), cursive', fontStyle: 'normal', scale: 1.143 },
  { quoteFont: 'eunyoung', id: 'eunyoung', label: '은영', stack: 'var(--font-eunyoung), cursive', fontStyle: 'normal', scale: 1.238 },
  { quoteFont: 'brush', id: 'brush', label: '붓', stack: 'var(--font-brush), cursive', fontStyle: 'normal', scale: 1.25 },
  { quoteFont: 'coolguy', id: 'coolguy', label: '쿨가이', stack: 'var(--font-coolguy), cursive', fontStyle: 'normal', scale: 1.246 },
  { quoteFont: 'flower', id: 'flower', label: '꽃길', stack: 'var(--font-flower), var(--font-sans), sans-serif', fontStyle: 'normal', scale: 1.25 },
];

const BASE_FONT_SIZE = 50; // MoodCriterion.tsx: userTextFont(quoteText, components.quoteFont, 50)
const SLOT_WIDTH = 600; // 960 − PAD 84×2 − 인셋 96×2

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

let result;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 675, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

  result = await page.evaluate(async (targets, texts, baseFontSize) => {
    const main = document.querySelector('main');
    if (!main) throw new Error('<main>을 못 찾았다 — CSS 변수가 걸린 자리가 없다');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const allChars = texts.map((t) => t.text).join('');

    const out = [];
    for (const t of targets) {
      const probe = document.createElement('span');
      probe.style.fontFamily = t.stack;
      probe.style.fontStyle = t.fontStyle;
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.textContent = allChars;
      main.appendChild(probe);
      const resolvedFamily = getComputedStyle(probe).fontFamily;

      const fontSize = Math.round(baseFontSize * t.scale * 100) / 100;
      const font = `${t.fontStyle} 400 ${fontSize}px ${resolvedFamily}`;

      let loadError = null;
      try {
        await document.fonts.load(font, allChars);
      } catch (e) {
        loadError = String(e);
      }
      const loaded = document.fonts.check(font, allChars);

      ctx.font = font;
      const widths = texts.map((tx) => ({
        id: tx.id,
        text: tx.text,
        widthPx: +ctx.measureText(tx.text).width.toFixed(1),
      }));
      const worst = widths.reduce((a, b) => (b.widthPx > a.widthPx ? b : a));

      out.push({
        quoteFont: t.quoteFont,
        label: t.label,
        resolvedFamily,
        fontSize,
        loaded,
        loadError,
        widths,
        worst,
      });
      probe.remove();
    }
    return out;
  }, TARGETS, TEXTS, BASE_FONT_SIZE);
} finally {
  // bun에선 browser.close()가 resolve하지 않는다(#506) — 3초 race로 감싸고 끝에 강제 종료.
  await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
}

const missing = result.filter((r) => !r.loaded).map((r) => r.quoteFont);
const grandWorst = result.reduce((a, b) => (b.worst.widthPx > a.worst.widthPx ? b : a));
// 기존 안전마진 판정 기준(주석 346-359): 자연 폭이 1200px(=2줄 예산)을 넘으면 3줄 위험.
const THREE_LINE_THRESHOLD = SLOT_WIDTH * 2;

const report = {
  url: URL,
  slotWidth: SLOT_WIDTH,
  threeLineThreshold: THREE_LINE_THRESHOLD,
  perFont: result.map((r) => ({
    quoteFont: r.quoteFont,
    label: r.label,
    resolvedFamily: r.resolvedFamily,
    fontSize: r.fontSize,
    loaded: r.loaded,
    presetLongestPx: r.widths.find((w) => w.id === '5').widthPx, // "the film every…" (50자, 프리셋 중 최장)
    defaultQuotePx: r.widths.find((w) => w.id === 'default').widthPx,
    worstId: r.worst.id,
    worstWidthPx: r.worst.widthPx,
    marginPct: +(((THREE_LINE_THRESHOLD - r.worst.widthPx) / THREE_LINE_THRESHOLD) * 100).toFixed(1),
    exceeds: r.worst.widthPx > THREE_LINE_THRESHOLD,
  })),
  grandWorst: { quoteFont: grandWorst.quoteFont, textId: grandWorst.worst.id, widthPx: grandWorst.worst.widthPx },
  missing,
  pass: missing.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  console.error(`\n못 받아온 폰트: ${missing.join(', ')} — 폴백으로 잰 값이라 쓰면 안 된다.`);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
