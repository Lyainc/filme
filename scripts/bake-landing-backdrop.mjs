/**
 * 랜딩 배경 타일 그리드(#615 `LandingBackdropTiles`)를 정적 webp로 굽는다(#613 배경 시트 항목).
 * `LandingBackdropTiles`는 이미 원본 포스터 없이 `MOOD_CHIP_BG` 색면만 타일링하므로(D5) 코드
 * 변경 없이 실행 중인 앱을 그대로 캡처하면 된다 — 별도 standalone 렌더 페이지가 필요 없다.
 *
 *   bun scripts/bake-landing-backdrop.mjs
 *
 * 전제: `bun run dev`(또는 동일 빌드를 서빙하는 서버)가 :3000에서 떠 있어야 한다(capture-export.mjs와
 * 동일 전제, #601 stale 서버 함정도 동일하게 적용된다).
 */
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = process.env.URL ?? 'http://localhost:3000/';
const OUT = new URL('../public/assets/landing/backdrop-tiles.webp', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// bun에선 browser.close()가 resolve하지 않는다(capture-export.mjs와 동일 실측) — 짧게만 기다린다.
const closeBrowser = (browser) => Promise.race([browser.close().catch(() => {}), sleep(3000)]);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});
try {
  const page = await browser.newPage();
  // PhoneFrame 표준 뷰포트(400×675) — 배경 시트는 "뷰포트 폭 대응 1장"(#613)이라 이 프레임 폭에 맞춘다.
  await page.setViewport({ width: 400, height: 675, deviceScaleFactor: 1 });
  await page.goto(URL_, { waitUntil: 'networkidle2' });

  const selector = '[data-testid="landing"] [aria-hidden="true"].opacity-20';
  await page.waitForSelector(selector, { timeout: 10000 });
  const el = await page.$(selector);
  if (!el) throw new Error(`배경 타일 엘리먼트를 못 찾음: ${selector}`);

  // elementHandle.screenshot()은 bounding box로만 자르지, 같은 사각형 위에 쌓인 형제(카피·갤러리·
  // CTA·footer)는 그대로 찍힌다(-z-10이 페인트 순서를 바꿀 뿐 크롭 대상은 아님) — 배경 레이어만
  // 남기려면 나머지 direct child를 잠깐 숨긴다. 앱 소스는 그대로고 이 스크립트 안 런타임 DOM만 만진다.
  const hidden = await page.evaluate((sel) => {
    const bg = document.querySelector(sel);
    const parent = bg.closest('[data-testid="landing"]');
    const siblings = [...parent.children].filter((c) => c !== bg);
    siblings.forEach((c) => (c.style.display = 'none'));
    return siblings.length;
  }, selector);
  if (hidden === 0) throw new Error('숨길 형제 엘리먼트가 없음 — 배경 레이어가 유일한 자식이면 선택자를 재확인할 것');

  const bytes = await el.screenshot({ type: 'webp' });
  writeFileSync(OUT, bytes);
  console.log(JSON.stringify({ out: OUT, bytes: bytes.length }, null, 2));
} finally {
  await closeBrowser(browser);
}
process.exit(0);
