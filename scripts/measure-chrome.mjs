/**
 * 400×675 크롬 측정 하네스 (#586) — 세션마다 다시 쓰던 스크립트를 레포에 고정한 것.
 *
 *   bun scripts/measure-chrome.mjs --label main --theme dark
 *   bun scripts/measure-chrome.mjs --theme light --viewport 400x675 --url http://localhost:3000/
 *
 * dev 서버(:3000)가 워킹트리를 서빙하므로, before/after 표는 베이스 커밋으로 detached
 * checkout → 측정 → 복귀로 만든다(워크트리를 새로 파면 Turbopack이 심링크 node_modules를
 * 거부해 실제 bun install이 필요하다).
 *
 * ── 측정 전제 (이걸 빼면 숫자가 통째로 달라진다) ───────────────────────────────
 * #563 불변식(dock 232.6 / 프리뷰 226.8×362.3)은 **레일 슬롯이 열린 상태** 기준이다.
 * 첫 [data-rail-id] 항목을 눌러 슬롯을 편 뒤 재야 재현된다 — 안 열고 재면 dock 114.5 /
 * 프리뷰 300.7×480.5가 나오고, 스크립트는 조용히 성공한다(#574 세션이 여기서 한 번 헛돌았다).
 * 아래 openRail()이 aria-expanded=true를 확인하고, 안 열리면 던진다.
 *
 * ── 재는 축 ──────────────────────────────────────────────────────────────────
 *  1. dock · 프리뷰 티켓 · 헤더 rect                       (#500 · #554 · #558 · #563)
 *  2. 레일 슬롯 scrollTop / scrollHeight / clientHeight     (#563 고정 슬롯 넘침 판정)
 *  3. 오버레이 표면 항목별 WCAG 대비비(불투명 조상 배경 기준)  (#569 · #580)
 *  4. 테마 파라미터화 — 다크·라이트를 같은 실행 경로로         (#574)
 *  5. 모달 포커스 트랩 · 닫기 3경로 · 가려진 버튼 클릭 통과    (#574, 모달 없는 판본이면 skip)
 *
 * 출력은 stdout JSON 한 덩어리. 400×675일 때 #563 불변식을 자동 대조하고 어긋나면 exit 1.
 * 함정 목록은 네이티브 메모리 e2e-browser-verification-setup 참고.
 */
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const LABEL = arg('label', 'run');
const THEME = arg('theme', 'dark');
const URL = arg('url', 'http://localhost:3000/');
const SHOT = arg('shot', null); // 스크린샷 경로(선택)
const [VW, VH] = arg('viewport', '400x675').split('x').map(Number);
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// #563 실측 불변식 — 400×675 · 레일 열림 기준. 다른 뷰포트에선 대조하지 않는다.
const BASELINE = { dock: 232.6, preview: { w: 226.8, h: 362.3 } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // userDataDir를 주지 않으면 puppeteer가 매 실행 새 임시 프로필을 만들고 종료 시 지운다.
  // MCP 프로필 락(~/.cache/chrome-devtools-mcp/chrome-profile)을 피하는 동시에, 고정 프로필이
  // 실행 사이로 상태를 흘리는 걸 막는다 — 고정 프로필을 쓰면 앞 실행이 누른 툴바 배치가
  // localStorage에 남아 같은 트리인데 대비 항목 수가 갈린다(실제로 minIcon이 null↔6.73로 갈렸다).
  args: ['--no-sandbox', '--force-device-scale-factor=1'],
});

try {
  const page = await browser.newPage();
  // 실패 경로의 alert()가 페이지를 얼려 이후 모든 CDP 호출을 멈추는 걸 막는다.
  page.on('dialog', (d) => d.dismiss());
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });

  // 완료 게이트(포스터+title+titleOg+releaseDate)를 KOBIS 없이 통과시키는 시드 + 테마.
  await page.evaluateOnNewDocument((theme) => {
    localStorage.setItem(
      'filme:phototicket:v1',
      JSON.stringify({
        movieInfo: { title: '인터스텔라', titleOg: 'Interstellar', releaseDate: '2014' },
      }),
    );
    localStorage.setItem('phototicket:theme', theme);
  }, THEME);
  await page.goto(URL, { waitUntil: 'networkidle2' });

  // 흰 포스터 = 대비 최악 케이스(#569가 세운 기준과 동일). ImageMagick 없이 canvas로 만든다.
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 960;
    c.height = 1440;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.95));
    // 모바일 셸은 OCR 카드(accept="image/*")가 포스터 input보다 앞이라 순서로 고르면 안 된다.
    const target = [...document.querySelectorAll('input[type=file]')].find((i) =>
      i.accept.includes('image/jpeg'),
    );
    if (!target) throw new Error('포스터 input[type=file] 못 찾음');
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'white.jpg', { type: 'image/jpeg' }));
    target.files = dt.files;
    target.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // 크롭 '적용'은 뜬 직후 누르면 disabled=false인데도 no-op — completedCrop이 onComplete로
  // 세워질 때까지 기다린다. 안 기다리면 "모달이 그대로"라 dev 서버 문제로 오진하기 쉽다.
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === '적용'),
    { timeout: 20000 },
  );
  await sleep(1400);
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '적용').click(),
  );
  await page.waitForSelector('div.relative.mx-auto.block.rounded-card', { timeout: 20000 });
  await sleep(900);

  // ── 전제: 레일 슬롯 열기 ────────────────────────────────────────────────────
  await page.evaluate(() => document.querySelector('[data-rail-id]').click());
  await sleep(700);
  const railOpen = await page.evaluate(
    () => document.querySelector('[data-rail-id]')?.getAttribute('aria-expanded') === 'true',
  );
  if (!railOpen) {
    throw new Error(
      '레일 슬롯이 안 열렸다 — 닫힌 채로 재면 #563 불변식(dock 232.6)이 아니라 dock 114.5가 나온다',
    );
  }

  const readRects = () =>
    page.evaluate(() => {
      const r = (el) =>
        el
          ? {
              w: +el.getBoundingClientRect().width.toFixed(1),
              h: +el.getBoundingClientRect().height.toFixed(1),
            }
          : null;
      const dock = document.querySelector('[data-rail-id]')?.closest('div.relative.shrink-0');
      const slot = document.getElementById('design-rail-panel');
      return {
        rects: {
          dock: r(dock),
          preview: r(document.querySelector('div.relative.mx-auto.block.rounded-card')),
          header: r(document.querySelector('header')),
        },
        railSlot: slot
          ? {
              scrollTop: slot.scrollTop,
              scrollHeight: slot.scrollHeight,
              clientHeight: slot.clientHeight,
              overflows: slot.scrollHeight > slot.clientHeight,
            }
          : null,
      };
    });

  const base = await readRects();

  // ── 대비: 오버레이 표면의 항목별 WCAG 비 ────────────────────────────────────
  // 불투명(alpha=1) 조상 배경을 DOM에서 거슬러 찾는다. 조상이 없으면 "유리 위 직접 텍스트"라
  // #569가 세운 규칙(잉크는 불투명 표면 위에) 위반으로 판정한다.
  const measureContrast = (selector) =>
    page.evaluate((sel) => {
      const lum = (c) => {
        const [r, g, b] = c.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const parse = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
      const ratio = (a, b) => {
        const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
        return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2);
      };
      const opaqueBg = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const p = parse(getComputedStyle(n).backgroundColor);
          if (p.length >= 3 && (p[3] === undefined || p[3] === 1)) return p.slice(0, 3);
        }
        return null;
      };
      const root = document.querySelector(sel);
      if (!root) return null;
      const items = [...root.querySelectorAll('h2, h3, button')].map((el) => {
        const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24);
        const fg = parse(getComputedStyle(el).color).slice(0, 3);
        const bg = opaqueBg(el);
        const icon = el.tagName === 'BUTTON' && !el.textContent?.trim();
        const need = icon ? 3 : 4.5;
        return {
          label,
          kind: icon ? 'icon' : 'text',
          need,
          fg: `rgb(${fg.join(',')})`,
          bg: bg ? `rgb(${bg.join(',')})` : 'NONE(유리 직접)',
          ratio: bg ? ratio(fg, bg) : null,
          pass: bg ? ratio(fg, bg) >= need : false,
        };
      });
      const min = (kind) => {
        const r = items.filter((i) => i.kind === kind && i.ratio != null).map((i) => i.ratio);
        return r.length ? Math.min(...r) : null;
      };
      return {
        surface: sel,
        items,
        maxText: Math.max(...items.filter((i) => i.kind === 'text' && i.ratio).map((i) => i.ratio), 0) || null,
        minText: min('text'),
        minIcon: min('icon'),
        fails: items.filter((i) => !i.pass).map((i) => i.label),
      };
    }, selector);

  // 햄버거 메뉴 열기 — 모달 진입점이자, 모달 없는 판본에서의 대비 측정 표면.
  await page.evaluate(() => document.querySelector('button[aria-label="편집 메뉴"]').click());
  await sleep(250);

  const hasModalRow = await page.evaluate(
    () => !![...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === '고급 설정'),
  );

  let contrast;
  let modal = { present: false, reason: '고급 설정 진입 행 없음(모달 없는 판본)' };

  if (!hasModalRow) {
    contrast = await measureContrast('#editor-menu-panel');
    await page.keyboard.press('Escape');
  } else {
    await page.evaluate(() =>
      [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '고급 설정').click(),
    );
    const DIALOG = 'div[role=dialog][aria-label="고급 설정"]';
    await page.waitForSelector(DIALOG, { timeout: 5000 });
    await sleep(200);
    // 초기 포커스는 아무 것도 클릭하기 전에 읽는다 — 아래 라디오를 누른 뒤 재면 방금 누른
    // 버튼이 모달 안이라 무조건 통과하는 헛검사가 된다.
    const initialInside = await page.evaluate(
      (sel) => document.querySelector(sel).contains(document.activeElement),
      DIALOG,
    );

    const closed = () => page.evaluate((sel) => !document.querySelector(sel), DIALOG);
    const reopen = async () => {
      if (!(await closed())) return;
      await page.evaluate(() => document.querySelector('button[aria-label="편집 메뉴"]').click());
      await sleep(200);
      await page.evaluate(() =>
        [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '고급 설정').click(),
      );
      await page.waitForSelector(DIALOG, { timeout: 5000 });
      await sleep(200);
    };

    // 이동식으로 바꿔 스냅 버튼까지 화면에 올린 뒤 잰다(최저 대비 항목이 거기 있다).
    await page.evaluate(() => {
      [...document.querySelectorAll('[role=radio]')]
        .find((b) => b.textContent?.includes('세로형 · 이동식'))
        ?.click();
    });
    await sleep(300);
    if (SHOT) await page.screenshot({ path: SHOT });
    contrast = await measureContrast(DIALOG);

    // 포커스 트랩 — 밖으로 밀면 되돌아오나.
    const returnsAfterPush = await page.evaluate((sel) => {
      document.querySelector('button[aria-label="편집 메뉴"]').focus();
      return document.querySelector(sel).contains(document.activeElement);
    }, DIALOG);

    // 가려진 버튼 클릭 통과 — 모달 위에서 헤더 '완료' 좌표를 실제로 누른다.
    // **모달이 닫혔는지로 판정하면 안 된다** — 헤더 자리는 백드롭 띠라 클릭을 먹고 닫는 게
    // 정상 동작이고, 그건 통과가 아니다. 진짜 누출은 밑의 handleDone이 실행돼 결과 화면으로
    // 넘어가는 것이므로 편집 화면에 남아 있는지로 판정한다.
    const done = await page.evaluate(() => {
      const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('완료'));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    let clickThrough = null;
    if (done) {
      await page.mouse.click(done.x, done.y);
      await sleep(500);
      clickThrough = await page.evaluate(
        (sel) => ({
          dialogClosed: !document.querySelector(sel),
          leaked: !document.querySelector('button[aria-label="편집 메뉴"]'),
        }),
        DIALOG,
      );
    }

    // 닫기 3경로 — Escape · 닫기 버튼 · 백드롭 좌표 실클릭. 각 경로 전에 반드시 다시 연다
    // (닫힌 모달에 Escape를 쏘면 "닫혔다"가 무조건 참이 되는 헛검사).
    await reopen();
    await page.keyboard.press('Escape');
    await sleep(250);
    const escape = await closed();
    const focusRestored = await page.evaluate(
      () => document.activeElement === document.querySelector('button[aria-label="편집 메뉴"]'),
    );

    await reopen();
    const closeBtnHit = await page.evaluate((sel) => {
      const b = [...document.querySelectorAll(`${sel} button`)].find(
        (x) => (x.getAttribute('aria-label') ?? x.textContent ?? '').includes('닫기'),
      );
      b?.click();
      return !!b;
    }, DIALOG);
    await sleep(250);
    const closeButton = closeBtnHit ? await closed() : null;

    await reopen();
    await page.mouse.click(Math.round(VW / 2), 10); // 상단 백드롭 띠
    await sleep(250);
    const backdrop = await closed();

    modal = {
      present: true,
      focus: { initialInside, returnsAfterPush },
      clickThrough,
      close: { escape, closeButton, backdrop },
      focusRestoredToTrigger: focusRestored,
    };
  }
  await sleep(300);

  // 모달을 열고 닫은 뒤에도 dock/프리뷰가 그대로인지(#563 불변식 유지).
  const after = await readRects();

  const at400 = VW === 400 && VH === 675;
  const near = (a, b) => a != null && Math.abs(a - b) <= 0.5;
  const invariant = at400
    ? {
        checked: true,
        expected: BASELINE,
        pass:
          near(base.rects.dock?.h, BASELINE.dock) &&
          near(base.rects.preview?.w, BASELINE.preview.w) &&
          near(base.rects.preview?.h, BASELINE.preview.h),
      }
    : { checked: false, reason: `#563 불변식은 400×675 전용 (지금 ${VW}×${VH})` };

  const out = {
    label: LABEL,
    viewport: { w: VW, h: VH },
    theme: THEME,
    url: URL,
    railOpen,
    ...base,
    afterMenu: after,
    contrast,
    modal,
    invariant,
  };
  console.log(JSON.stringify(out, null, 2));
  if (invariant.checked && !invariant.pass) process.exitCode = 1;
} finally {
  await browser.close();
}
