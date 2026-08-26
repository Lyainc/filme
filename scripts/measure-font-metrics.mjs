/**
 * 한줄평·서명 폰트 9택의 체감 크기 실측 하네스 (#437).
 *
 *   bun scripts/measure-font-metrics.mjs                       # http://localhost:3000/
 *   bun scripts/measure-font-metrics.mjs --url http://localhost:3010/
 *   CHROME_PATH=/usr/bin/google-chrome bun scripts/measure-font-metrics.mjs
 *
 * ── 왜 브라우저로 재는가 ─────────────────────────────────────────────────────
 * OS/2 테이블의 sxHeight/sCapHeight를 그대로 쓸 수 없다. 실측(fontTools, 2026-08-26)에서
 * 잉크립퀴드체와 KCC은영체는 **둘 다 0**으로 비어 있었고, 꽃길은 xHeight와 capHeight가
 * 500으로 같았다 — 제작사가 안 채운 값이라 신뢰할 수 없다.
 *
 * 더 근본적으로, **한글은 라틴 x-height가 체감 크기를 대표하지 않는다.** 한글 음절은 em
 * 사각형을 채우는 글자면이고, 같은 fontSize에서 커 보이고 작아 보이는 건 그 글자면이 em의
 * 몇 %를 쓰느냐다. 그래서 이 스크립트는 캔버스 `measureText`의 잉크 박스
 * (`actualBoundingBoxAscent + actualBoundingBoxDescent`)로 **한글 음절이 실제로 차지하는
 * 세로 높이**를 재고, 라틴 cap/x-height는 참고값으로만 같이 남긴다.
 *
 * ── 기준선 ───────────────────────────────────────────────────────────────────
 * 보정 배율의 기준은 `hand`(아이스자람체)다. 그게 지금 `auto`가 한글에 고르는 폰트라,
 * 기준으로 두면 **기존 저장본(auto·hand)의 렌더가 1.000으로 안 변한다**. 나머지는
 * `hand_ink / 자기_ink`로 곱해 같은 fontSize에서 비슷하게 보이게 맞춘다.
 *
 * ── 전제 ─────────────────────────────────────────────────────────────────────
 * CSS 변수(--font-batang 등)는 `_app.tsx`가 <main>에 건 클래스에서만 해석되므로 프로브
 * span을 반드시 <main> 안에 붙인다. preload:false라 폰트는 처음엔 안 받아져 있고,
 * `document.fonts.load()`로 명시적으로 받아온 뒤 재야 폴백 폰트를 재는 사고가 안 난다.
 *
 * 출력은 stdout JSON 한 덩어리. 폰트 하나라도 못 받으면(loaded:false) exit 1 —
 * 폴백으로 잰 숫자를 실측이라고 커밋하는 게 이 스크립트의 유일한 조용한 실패다.
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

/** QuoteFont 9택 → 그 값이 실제로 쓰는 폰트 스택. `_shared.tsx`의 토큰과 같은 뜻이어야 한다. */
const TARGETS = [
  { id: 'hand', label: '인천교육자람체', stack: 'var(--font-quote-kr), cursive' },
  { id: 'gothic', label: '프리텐다드', stack: 'var(--font-sans), sans-serif' },
  { id: 'batang', label: '경기천년바탕', stack: 'var(--font-batang), serif' },
  { id: 'ink', label: '잉크립퀴드체', stack: 'var(--font-ink), cursive' },
  { id: 'eunyoung', label: 'KCC은영체', stack: 'var(--font-eunyoung), cursive' },
  { id: 'brush', label: '나눔손글씨붓', stack: 'var(--font-brush), cursive' },
  { id: 'coolguy', label: '쿨가이', stack: 'var(--font-coolguy), cursive' },
  { id: 'flower', label: '꽃길', stack: 'var(--font-flower), sans-serif' },
  // auto가 라틴에서 고르는 폰트 — 한글이 없어 한글 축엔 안 실리고 라틴 축 비교용으로만 잰다.
  { id: 'display', label: 'Instrument Serif(라틴)', stack: 'var(--font-display), serif' },
];

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

  result = await page.evaluate(async (targets) => {
    const main = document.querySelector('main');
    if (!main) throw new Error('<main>을 못 찾았다 — CSS 변수가 걸린 자리가 없다');

    // em의 몇 %를 쓰는지는 음절마다 다르다(받침 유무·모음 방향). 대표 한 글자로 재면
    // 그 글자의 특성이 폰트 특성으로 둔갑하므로, 형태가 갈리는 음절을 고루 섞어 평균 낸다.
    const HANGUL = ['가', '너', '도', '름', '밝', '한', '글', '꽃', '삶', '읽'];
    // 라틴은 cap-height 하나로 못 잰다 — 붓글씨(나눔손글씨붓 cap 96.4)는 대문자가 작은 대신
    // 어센더·디센더가 길어, cap만 보고 1.5배로 키우면 글자 덩어리가 줄상자를 넘긴다. 한글과
    // 같은 잣대(글자가 실제로 차지하는 세로 잉크 높이)를 쓰려고 어센더~디센더가 다 걸리는
    // 글자를 섞는다.
    const LATIN = ['H', 'x', 'g', 'p', 'd', 'o', 'n', 'A', 'y', 'e'];
    const SIZE = 200; // 잉크 박스 반올림 오차를 상대적으로 줄이려고 크게 잡는다.

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const inkHeight = (font, ch) => {
      ctx.font = font;
      const m = ctx.measureText(ch);
      return m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    };

    const out = [];
    for (const t of targets) {
      const probe = document.createElement('span');
      probe.style.fontFamily = t.stack;
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.textContent = HANGUL.join('');
      main.appendChild(probe);
      const resolved = getComputedStyle(probe).fontFamily;
      const font = `${SIZE}px ${resolved}`;

      // preload:false라 여기서 실제로 받아온다. 실패해도 던지지 않고 loaded로 기록한다 —
      // 어느 폰트가 못 왔는지가 진단이라 첫 실패에서 멈추면 나머지를 못 본다.
      let loadError = null;
      try {
        await document.fonts.load(font, HANGUL.join('') + 'Hx');
      } catch (e) {
        loadError = String(e);
      }
      const loaded = document.fonts.check(font, HANGUL.join(''));

      const mean = (arr) => +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2);
      const perChar = HANGUL.map((ch) => inkHeight(font, ch));
      const perLatin = LATIN.map((ch) => inkHeight(font, ch));
      out.push({
        id: t.id,
        label: t.label,
        resolvedFamily: resolved,
        loaded,
        loadError,
        // 글자가 실제로 차지하는 세로 잉크 높이(em 200 기준) — 체감 크기의 실측 대리값.
        hangulInk: mean(perChar),
        hangulInkMin: +Math.min(...perChar).toFixed(2),
        hangulInkMax: +Math.max(...perChar).toFixed(2),
        latinInk: mean(perLatin),
        // 참고값 — 흔히 쓰는 지표지만 이 폰트들에선 체감 크기를 못 대표한다(위 LATIN 주석).
        capHeight: +inkHeight(font, 'H').toFixed(2),
        xHeight: +inkHeight(font, 'x').toFixed(2),
        em: SIZE,
      });
      probe.remove();
    }
    return out;
  }, TARGETS);
} finally {
  // bun에선 browser.close()가 resolve하지 않는다(#506) — 3초 race로 감싸고 끝에 강제 종료.
  await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
}

const byId = Object.fromEntries(result.map((r) => [r.id, r]));
const hangulTargets = result.filter((r) => r.id !== 'display');

// 두 축의 기준이 다르다 — `auto`가 한글엔 hand(아이스자람체)를, 라틴엔 display(Instrument
// Serif)를 고르므로, 각 축에서 그 폰트를 1.000으로 두면 기존 저장본의 렌더가 안 변한다.
// 확대만 상한을 건다. 줄이는 쪽은 어떤 무드의 텍스트 예산도 안 깨지만, 키우는 쪽은 깬다 —
// Criterion 한줄평은 fontSize 50이 600px 슬롯에 서고(#577이 overflowWrap으로 겨우 가둔
// 자리다) 서명은 무드마다 nowrap + ellipsis 예산이 잡혀 있어서, 원시 배율 1.468(꽃길 라틴)을
// 그대로 걸면 보정이 아니라 레이아웃 회귀가 된다. 1.25에서 자르면 남는 오차가 최대 17%다.
const MAX_UPSCALE = 1.25;
const ratio = (refInk, ink) => +Math.min(refInk / ink, MAX_UPSCALE).toFixed(3);

const hangulScales = Object.fromEntries(
  hangulTargets.map((r) => [r.id, ratio(byId.hand.hangulInk, r.hangulInk)])
);
const latinScales = Object.fromEntries(
  hangulTargets.map((r) => [r.id, ratio(byId.display.latinInk, r.latinInk)])
);
const clamped = hangulTargets
  .filter((r) => byId.display.latinInk / r.latinInk > MAX_UPSCALE)
  .map((r) => `${r.id}(라틴 ${(byId.display.latinInk / r.latinInk).toFixed(3)})`);

const missing = hangulTargets.filter((r) => !r.loaded).map((r) => r.id);
const report = {
  url: URL,
  reference: { hangul: 'hand', latin: 'display' },
  // 기준 대비 잉크 높이 비율 — 1보다 작으면 그 폰트가 같은 fontSize에서 커 보인다는 뜻이라
  // 그만큼 줄인다.
  measured: result,
  hangulScales,
  latinScales,
  maxUpscale: MAX_UPSCALE,
  clamped,
  missing,
  pass: missing.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  console.error(`\n못 받아온 폰트: ${missing.join(', ')} — 폴백으로 잰 값이라 쓰면 안 된다.`);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
