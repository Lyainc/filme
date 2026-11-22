/**
 * 입력 패널 + 키보드 헤드리스 표본 (#826 S4) — 393×852, 라이트·다크 × 제목(티켓 위쪽)·좌석(아래쪽) = 캡처 4장.
 *
 *   bun scripts/measure-keyboard-panel.mjs --url http://localhost:3021/ --out <dir> [--keyboard 330]
 *
 * visualViewport를 앱 스크립트보다 먼저 가짜(EventTarget)로 바꿔 키보드 높이를 스텁한다. 키보드 윗변 = 852 − 330.
 * 같은 페이지에서 잰 네 수치가 전부 통과해야 exit 0이다. **못 잰 값(null)도 실패**다(docs/HARNESS.md §7).
 *  ① 패널 아래 끝과 키보드 윗변 차 ≤ 1px
 *  ② 선택 표시 rect가 패널 rect와 교차 면적 0 이고, 그 아래 끝이 패널 윗변보다 위
 *  ③ 패널 안 모든 button · input rect가 #phone-frame 안(넘침 0px)
 *  ④ 세로 무드 티켓(확대 래퍼) 가로가 #phone-frame 안
 *
 * 이 결과는 합성 스텁이다 — 실기기 iPhone PASS가 아니다. prod(`bun run build && next start`) 서버를 대상으로 하고,
 * 포트가 이미 물려 있으면 옛 서버를 재게 되니 지금 빌드인지 먼저 확인할 것(docs/HARNESS.md §8).
 * bun에선 browser.close()가 resolve하지 않을 수 있어 3초 race + process.exit (§2).
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const URL = arg('url', 'http://localhost:3000/');
const OUT = arg('out', '.');
const VW = 393;
const VH = 852;
const KB = Number(arg('keyboard', '330'));
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});

const rows = [];
try {
  for (const theme of ['light', 'dark']) {
    for (const field of ['title', 'seat']) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      page.on('dialog', (d) => d.dismiss());
      await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument(
        (t, kb, w, h) => {
          localStorage.setItem(
            'filme:phototicket:v1',
            JSON.stringify({
              movieInfo: {
                title: '인터스텔라',
                titleOg: 'Interstellar',
                releaseDate: '2014',
                seat: 'H12',
                theater: 'CGV 용산아이파크몰',
              },
            }),
          );
          localStorage.setItem('phototicket:theme', t);
          const vv = new EventTarget();
          Object.assign(vv, {
            width: w,
            height: h - kb,
            offsetTop: 0,
            offsetLeft: 0,
            pageTop: 0,
            pageLeft: 0,
            scale: 1,
          });
          Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
        },
        theme,
        KB,
        VW,
        VH,
      );
      await page.goto(URL, { waitUntil: 'networkidle2' });
      // 드래프트가 있으면 랜딩이 먼저 뜬다(#727) — '이어서 만들기'로 편집기에 들어간다.
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('이어서 만들기')),
        { timeout: 15000 },
      );
      await page.evaluate(() => {
        Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('이어서 만들기')).click();
      });
      await page.waitForSelector(`[data-field-tap="${field}"]`, { timeout: 15000 });
      const pt = await page.evaluate((f) => {
        const r = document.querySelector(`[data-field-tap="${f}"]`).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, field);
      await page.mouse.click(pt.x, pt.y);
      await page.waitForSelector('[data-field-panel]', { timeout: 5000 });
      // 실기기에선 포커스 직후 키보드가 올라오며 resize가 온다 — 같은 이벤트를 합성한다.
      await page.evaluate(() => window.visualViewport.dispatchEvent(new Event('resize')));
      await sleep(900); // 래퍼 transform 전이(~240ms) + 페이드 + 안정

      const m = await page.evaluate(
        (kb, vh) => {
          const rect = (el) => {
            const r = el.getBoundingClientRect();
            return { l: r.left, t: r.top, r: r.right, b: r.bottom };
          };
          const frame = document.getElementById('phone-frame');
          const panel = document.querySelector('[data-field-panel]');
          const mark = document.querySelector('[data-field-selection]');
          if (!frame || !panel || !mark) return { missing: !frame ? 'frame' : !panel ? 'panel' : 'mark' };
          const F = rect(frame);
          const P = rect(panel);
          const S = rect(mark);
          const wrapper = mark.parentElement;
          const W = rect(wrapper);
          const kbTop = F.b - kb; // frame bottom − (offsetTop + height)
          const ix = Math.max(0, Math.min(P.r, S.r) - Math.max(P.l, S.l));
          const iy = Math.max(0, Math.min(P.b, S.b) - Math.max(P.t, S.t));
          const els = Array.from(panel.querySelectorAll('button, input, textarea')).map(rect);
          const worst = els.reduce(
            (a, e) => Math.max(a, F.l - e.l, e.r - F.r, F.t - e.t, e.b - F.b),
            -Infinity,
          );
          const canvas = Array.from(wrapper.querySelectorAll('*')).find(
            (n) => n.style && n.style.width === '960px' && n.style.height === '1534px',
          );
          return {
            kbTop,
            panelBottomGap: P.b - kbTop,
            markPanelArea: ix * iy,
            markBottomToPanelTop: P.t - S.b, // 양수 = 표시가 패널 위
            innerCount: els.length,
            innerWorstOverflow: worst,
            ticketLeftOverflow: F.l - W.l,
            ticketRightOverflow: W.r - F.r,
            portraitCanvas: !!canvas,
            wrapperTransform: getComputedStyle(wrapper).transform,
            panelTop: P.t,
          };
        },
        KB,
        VH,
      );

      const shot = join(OUT, `kbd-${theme}-${field}.png`);
      await page.screenshot({ path: shot });
      const pass =
        !m.missing &&
        m.portraitCanvas &&
        Math.abs(m.panelBottomGap) <= 1 &&
        m.markPanelArea === 0 &&
        m.markBottomToPanelTop > 0 &&
        m.innerCount > 0 &&
        m.innerWorstOverflow <= 0 &&
        m.ticketLeftOverflow <= 0 &&
        m.ticketRightOverflow <= 0;
      rows.push({ theme, field, shot, pass, ...m });
      await ctx.close();
    }
  }
} finally {
  await Promise.race([browser.close(), sleep(3000)]);
}

for (const r of rows) {
  console.log(
    `${r.theme}/${r.field} ${r.pass ? 'PASS' : 'FAIL'} ` +
      (r.missing
        ? `missing=${r.missing}`
        : `①panelBottom-kbTop=${r.panelBottomGap.toFixed(2)} ` +
          `②markPanelArea=${r.markPanelArea.toFixed(1)} markBottom→panelTop=${r.markBottomToPanelTop.toFixed(1)} ` +
          `③innerOverflow=${r.innerWorstOverflow.toFixed(2)}(n=${r.innerCount}) ` +
          `④ticket L/R overflow=${r.ticketLeftOverflow.toFixed(2)}/${r.ticketRightOverflow.toFixed(2)} portrait=${r.portraitCanvas} transform=${r.wrapperTransform}`) +
      ` ${r.shot}`,
  );
}
if (rows.length !== 4 || rows.some((r) => !r.pass)) process.exitCode = 1;
process.exit(process.exitCode ?? 0);
