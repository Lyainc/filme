/**
 * 소형 화면 온티켓 필드 탭 측정(#777) — 실제 선택 영역 · 인접 간격 · 실제 터치 결과.
 *
 *   bun scripts/measure-field-taps.mjs --url http://localhost:3077/ --out taps.json
 *   bun scripts/measure-field-taps.mjs --moods criterion --viewports 320x568 --theme light
 *
 * 포스터 없는 draft(전 필드 채움)를 심고 '이어서 만들기'로 편집에 들어가 default 줌에서 잰다.
 * 포스터가 없으면 티켓 root가 업로드 탭(onPosterTap)이라, 필드 밖 오탭이 파일 선택으로 새는지도
 * 같이 보인다(input[type=file].click()을 가로채 센다 — 파일 창은 실제로 안 뜬다).
 *
 * 관측 도구이지 게이트가 아니다 — 오탭이 있어도 exit 0이다. 판정은 출력 JSON을 사람이 본다.
 *
 * 재는 것:
 *  - fields: [data-field-tap]의 rect(뷰포트 CSS px). 같은 field가 여럿이면 각각.
 *  - neighbors: 다른 field rect와의 최소 간격(음수 = 겹침).
 *  - probes: page.touchscreen.tap(CDP Input.dispatchTouchEvent)으로 중심 · 가장자리 안쪽 2px ·
 *    바깥 6px을 실제로 눌러 연 편집 대상. inside가 다른 필드를 열면 그게 오탭이다.
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const URL = arg('url', 'http://localhost:3077/');
const OUT = arg('out', null);
const THEME = arg('theme', 'dark');
const MOODS = arg('moods', 'criterion,minimal,35mm,editorial,stub,35mm-landscape').split(',');
const VIEWPORTS = arg('viewports', '320x568,375x667,393x852').split(',').map((v) => v.split('x').map(Number));
const OUTSIDE = Number(arg('outside', '6'));
const NO_TAPS = argv.includes('--no-taps'); // 기하(rect·간격·가림)만 — 실제 터치 생략
// 대조군용 CSS 주입 — 같은 빌드에서 수정 전 동작을 재현한다(예: 핸들 pointer-events 되돌리기).
const INJECT_CSS = arg('inject-css', null);
// 특정 필드만 프로브 — 연속 프로브가 남긴 상태(닫히는 중인 보조 패널 등)를 피해 대상만 깨끗하게 잰다.
const ONLY = arg('fields', null)?.split(',');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MOVIE = {
  title: '인터스텔라', titleOg: 'Interstellar', releaseDate: '2014-11-06',
  watchDate: '2026-09-17', watchTime: '19:30', theater: 'CGV 용산아이파크몰', screen: 'IMAX관',
  seat: 'H12', actors: '매튜 맥커너히, 앤 해서웨이, 제시카 차스테인', rating: 4.5, runtime: '169',
  bookingNumber: '1234-5678-9012', signature: 'Lyainc', quote: '사랑은 시공간을 초월한다',
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const results = [];
try {
  for (const [vw, vh] of VIEWPORTS) {
    for (const mood of MOODS) {
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      page.on('dialog', (d) => d.dismiss());
      await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      await page.evaluateOnNewDocument((movie, layout, theme, css) => {
        localStorage.setItem('filme:phototicket:v1', JSON.stringify({ movieInfo: movie, components: { layout } }));
        localStorage.setItem('phototicket:theme', theme);
        if (css) document.addEventListener('DOMContentLoaded', () => {
          const st = document.createElement('style');
          st.textContent = css;
          document.head.appendChild(st);
        });
        window.__fileClicks = 0;
        const orig = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function () {
          if (this.type === 'file') { window.__fileClicks++; return; }
          return orig.call(this);
        };
      }, MOVIE, mood, THEME, INJECT_CSS);
      await page.goto(URL, { waitUntil: 'networkidle2' });
      await page.waitForSelector('[data-testid="landing-restore"]', { timeout: 15000 });
      await page.evaluate(() => document.querySelector('[data-testid="landing-restore"]').click());
      await page.waitForSelector('[data-field-tap]', { timeout: 15000 });
      await sleep(900); // ResizeObserver 스케일 정착

      const readTaps = () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll('[data-field-tap]')).map((el) => {
            const r = el.getBoundingClientRect();
            return {
              field: el.getAttribute('data-field-tap'),
              label: (el.getAttribute('aria-label') || '').replace(/ 편집$/, ''),
              x: r.x, y: r.y, w: r.width, h: r.height,
            };
          }),
        );
      const taps = await readTaps();
      const vis = taps.filter((t) => t.w > 0 && t.h > 0 && t.y + t.h > 0 && t.y < vh && (!ONLY || ONLY.includes(t.field)));

      const gap = (a, b) => {
        const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
        const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
        if (dx === 0 && dy === 0) {
          // 겹침 — 겹친 폭/높이 중 작은 쪽을 음수로
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          return -Math.min(ox, oy);
        }
        return Math.hypot(dx, dy);
      };

      // 연 대상은 하이라이트 오버레이(z-index 60 — 투명 input 또는 aria-hidden 박스)의 중심이 어느
      // 탭 rect 안에 있느냐로 판정한다. rating처럼 라벨 달린 input이 없는 필드도 같은 방법으로 잡힌다.
      const opened = () =>
        page.evaluate(() => {
          const bar = document.querySelector('[aria-label="필드 편집 도구"]');
          let field = null;
          if (bar) {
            const hl = Array.from(document.querySelectorAll('input, div[aria-hidden="true"]')).find(
              (el) => el.style.zIndex === '60',
            );
            if (hl) {
              const h = hl.getBoundingClientRect();
              const cx = h.x + h.width / 2, cy = h.y + h.height / 2;
              let best = null;
              for (const el of document.querySelectorAll('[data-field-tap]')) {
                const r = el.getBoundingClientRect();
                const d = Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy);
                if (!best || d < best.d) best = { d, f: el.getAttribute('data-field-tap') };
              }
              field = best?.f ?? '?open';
            } else field = '?open';
          }
          return { field, fileClicks: window.__fileClicks };
        });
      const settled = () =>
        page
          .waitForFunction(() => {
            const w = document.querySelector('.crop-marks');
            const t = w && getComputedStyle(w).transform;
            return !document.querySelector('[aria-label="필드 편집 도구"]') && (t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)');
          }, { timeout: 4000 })
          .catch(() => {});
      const close = async () => {
        await page.evaluate(() => document.querySelector('[aria-label="편집 완료"]')?.click());
        await settled();
        await sleep(60);
      };

      // 셸 크롬이 티켓 위에 얹힌 히트 박스(항목 목록 핸들 · 플로팅 툴바)와 각 탭 rect의 겹친 면적 비율.
      const chrome = await page.evaluate(() =>
        [
          ['handle', document.querySelector('[aria-label="티켓 항목 목록 열기"]')],
          ['toolbar', document.querySelector('[role="toolbar"]:not([aria-label="필드 편집 도구"])')],
        ]
          .filter(([, el]) => el)
          .map(([name, el]) => {
            const r = el.getBoundingClientRect();
            return { name, x: r.x, y: r.y, w: r.width, h: r.height };
          }),
      );
      const coveredBy = (t) =>
        chrome
          .map((c) => {
            const ox = Math.max(0, Math.min(t.x + t.w, c.x + c.w) - Math.max(t.x, c.x));
            const oy = Math.max(0, Math.min(t.y + t.h, c.y + c.h) - Math.max(t.y, c.y));
            return { by: c.name, frac: +((ox * oy) / (t.w * t.h)).toFixed(2) };
          })
          .filter((c) => c.frac > 0);

      const fields = [];
      for (const t0 of vis) {
        await settled();
        // 앞 탭의 편집이 ghost·가시성을 바꿨을 수 있어 매번 다시 잰다(같은 field의 n번째 앵커).
        const nth = vis.filter((v) => v.field === t0.field).indexOf(t0);
        const t = (await readTaps()).filter((v) => v.field === t0.field)[nth] ?? t0;
        const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
        const pts = {
          center: [cx, cy],
          inTop: [cx, t.y + 2], inBottom: [cx, t.y + t.h - 2], inLeft: [t.x + 2, cy], inRight: [t.x + t.w - 2, cy],
          outTop: [cx, t.y - OUTSIDE], outBottom: [cx, t.y + t.h + OUTSIDE],
          outLeft: [t.x - OUTSIDE, cy], outRight: [t.x + t.w + OUTSIDE, cy],
        };
        const probes = {};
        const geom = {};
        for (const [k, [px, py]] of Object.entries(NO_TAPS ? {} : pts)) {
          if (px < 0 || py < 0 || px > vw || py > vh) { probes[k] = 'offscreen'; continue; }
          // 기하 hit test(elementFromPoint)와 실제 터치 결과를 따로 남긴다 — Chrome의 터치 보정은
          // 터치 반경 안의 다른 탭 대상으로 타깃을 옮길 수 있어 둘이 갈린다.
          const efp = await page.evaluate(
            (x, y) => {
              const el = document.elementFromPoint(x, y);
              const tap = el?.closest('[data-field-tap]')?.getAttribute('data-field-tap');
              if (tap) return tap;
              // 탭 대상이 아니면 무엇이 덮었는지 남긴다(셸 크롬·토스트 등).
              const named = el?.closest('[aria-label],[role],[data-testid]');
              return `none:${named?.getAttribute('aria-label') ?? named?.getAttribute('data-testid') ?? named?.getAttribute('role') ?? el?.tagName ?? ''}`;
            },
            px, py,
          );
          geom[k] = efp;
          const before = await page.evaluate(() => window.__fileClicks);
          await page.touchscreen.tap(px, py);
          // 고정 대기는 가로 무드에서 편집 바가 뜨기 전에 판정해 'none'을 냈다 — 뜰 때까지(최대 800ms) 본다.
          await page
            .waitForFunction(() => !!document.querySelector('[aria-label="필드 편집 도구"]'), { timeout: 800 })
            .catch(() => {});
          const o = await opened();
          probes[k] = o.field ?? (o.fileClicks > before ? 'poster' : 'none');
          if (o.field) await close();
          // 바깥 프로브가 핸들의 보이는 탭을 누르면 드로어가 정상적으로 열린다 — 결과로 남기고 닫는다.
          // 안 닫으면 뒤 프로브가 전부 드로어에 막혀 'none'이 된다.
          if (!o.field && (await page.$('[role="dialog"][aria-label="티켓 항목"]'))) {
            probes[k] = 'drawer';
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-label="티켓 항목"]'), { timeout: 2000 }).catch(() => {});
            await sleep(150);
          }
        }
        const others = vis.filter((o) => o.field !== t.field);
        const near = others
          .map((o) => ({ field: o.field, gap: +gap(t, o).toFixed(2) }))
          .sort((a, b) => a.gap - b.gap)
          .slice(0, 2);
        const inside = ['center', 'inTop', 'inBottom', 'inLeft', 'inRight'];
        fields.push({
          field: t.field,
          w: +t.w.toFixed(2), h: +t.h.toFixed(2),
          covered: coveredBy(t),
          neighbors: near,
          probes,
          geom,
          insideMisfire: inside.filter((k) => k in probes && probes[k] !== t.field && probes[k] !== 'offscreen'),
        });
      }
      const row = { viewport: `${vw}x${vh}`, mood, theme: THEME, chrome, fields };
      results.push(row);
      const small = fields.filter((f) => Math.min(f.w, f.h) < 24).map((f) => `${f.field}(${f.w}×${f.h})`);
      const mis = fields.filter((f) => f.insideMisfire.length).map((f) => `${f.field}:${f.insideMisfire.map((k) => `${k}→${f.probes[k]}`).join('/')}`);
      const cov = fields.filter((f) => f.covered.length).map((f) => `${f.field}:${f.covered.map((c) => `${c.by}${c.frac}`).join('+')}`);
      console.error(`[${vw}x${vh} ${mood}] taps=${fields.length} small<24=[${small.join(', ')}] insideMisfire=[${mis.join(', ')}] covered=[${cov.join(', ')}]`);
      await ctx.close();
    }
  }
} finally {
  if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 1));
  await Promise.race([browser.close(), sleep(3000)]);
}
process.exit(0);
