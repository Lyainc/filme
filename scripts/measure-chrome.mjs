/**
 * 400×675 크롬 측정 하네스 (#586) — 세션마다 다시 쓰던 스크립트를 레포에 고정한 것.
 *
 *   bun scripts/measure-chrome.mjs --label main --theme dark
 *   bun scripts/measure-chrome.mjs --theme light --viewport 400x675 --url http://localhost:3000/
 *   bun scripts/measure-chrome.mjs --viewport 1440x675   # 데스크톱 뷰포트, 프레임은 같은 400×675
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
 *  6. 오버레이 7종이 #phone-frame 사각형 안인지               (#609 · 랜딩 #614)
 *  7. 드래프 복원 시 랜딩 생략(D7)                            (#614)
 *
 * ── 대조 기준은 뷰포트가 아니라 프레임이다 (#609) ────────────────────────────
 * 예전엔 `VW===400 && VH===675`로 게이팅해서, `--viewport 1440x675`로 돌리면 프레임이
 * 아무리 망가져도 checked:false + exit 0으로 조용히 통과했다. 지금은 **측정한 #phone-frame
 * rect**로 판정하므로 데스크톱 뷰포트에서도 같은 게이트가 켜진다 — PhoneFrame이
 * height:100dvh + rail:w-[400px]라 1440×675 뷰포트의 프레임이 정확히 400×675가 되고,
 * #563 불변식(dock 232.6 / 프리뷰 226.8×362.3)을 값 변경 없이 그대로 쓴다.
 * (1440×900은 프레임이 400×900이라 이 불변식의 대상이 아니다.)
 *
 * 그리고 dock/프리뷰 숫자가 원리적으로 못 보는 축을 6번이 맡는다: fixed 오버레이는
 * PhoneFrame의 contain:paint 덕에 프레임 안으로 들어오는 것이라, 그 결합이 끊기면 뷰포트
 * 기준으로 돌아가 프레임 밖에 그려진다 — 그래도 dock/프리뷰 숫자는 멀쩡하다.
 *
 * 출력은 stdout JSON 한 덩어리. **checked:false는 통과가 아니라 실패다** — 프레임이
 * 400×675가 아니면(=불변식을 대조할 수 없으면) 그대로 exit 1이다. 조용한 성공을 없애는 게
 * 이 스크립트의 목적이므로 "못 쟀음"을 0으로 넘기지 않는다.
 * 서버 전제(#601): dev(:3000)·prod(`next start`) 어느 쪽이든 되지만 **지금 `.next`를 서빙하는
 * 서버**여야 한다. 오래 떠 있던 next start는 옛 빌드의 HTML을 줘 chunk가 전부 404가 되고, 앱이
 * 하이드레이션을 못 해 파일 input에 핸들러가 안 붙어 크롭 모달이 아예 안 열린다 — 포트가 이미
 * 물려 있으면 새 `next start`는 EADDRINUSE로 죽고 앞 서버가 그대로 응답하므로 "새로 띄웠다"가
 * 착각이 된다. 안 뜨면 앱을 의심하기 전에 콘솔의 chunk 404부터 볼 것. 자세한 건 CLAUDE.md 📏.
 *
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

  // ── #phone-frame rect — 이 스크립트의 모든 판정 원점(#609) ──────────────────
  const readFrame = () =>
    page.evaluate(() => {
      const f = document.getElementById('phone-frame');
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    });

  /**
   * el이 프레임 사각형 안인지. 넘침은 변별 가능하게 방향별로 남긴다(어느 쪽으로 샜는지가
   * 원인 추적의 절반이다). id가 없는 루트(max 오버레이·결과 스테이지)는 라벨 붙은 자식으로
   * `:has(> …)`를 써서 부모를 직접 고른다 — 그래서 여기엔 부모 타기 옵션이 없다.
   * 못 찾은 표면은 pass:false다 — 있어야 할 게 없는 것도 게이트가 잡아야 할 회귀다.
   */
  const fits = [];
  const measureFit = async (label, selector, target = page) => {
    const r = await target.evaluate(
      (sel) => {
        const f = document.getElementById('phone-frame');
        if (!f) return { missing: '#phone-frame' };
        const el = document.querySelector(sel);
        if (!el) return { missing: sel };
        const F = f.getBoundingClientRect();
        const R = el.getBoundingClientRect();
        return {
          rect: { w: +R.width.toFixed(1), h: +R.height.toFixed(1) },
          overflow: {
            left: +(F.left - R.left).toFixed(1),
            right: +(R.right - F.right).toFixed(1),
            top: +(F.top - R.top).toFixed(1),
            bottom: +(R.bottom - F.bottom).toFixed(1),
          },
        };
      },
      selector,
    );
    const worst = r.overflow ? Math.max(...Object.values(r.overflow)) : null;
    const entry = { label, selector, ...r, worstOverflow: worst, pass: worst != null && worst <= 0.5 };
    fits.push(entry);
    return entry;
  };

  // ── 랜딩 오버레이(#614) — 드래프가 없을 때만 뜬다 ──────────────────────────
  // 그래서 **시드 없는 별도 페이지**에서 잰다: 이 스크립트의 메인 페이지는 완료 게이트를 통과시키려
  // draft를 심어 두고(위 evaluateOnNewDocument), D7에 따라 랜딩이 생략되므로 같은 페이지에선
  // 영영 못 잰다. 오버레이는 fixed inset-0라 프레임과 정확히 같은 사각형이어야 한다 —
  // PhoneFrame의 contain:paint가 끊기면 1440 뷰포트에서 좌 520px로 샌다.
  // 격리 컨텍스트 — 같은 브라우저의 페이지는 origin localStorage를 공유하므로 그냥 newPage()를
  // 하면 위에서 심은 draft가 그대로 보여 랜딩이 D7로 생략된다(실측: waitForSelector 타임아웃).
  const landingCtx = await browser.createBrowserContext();
  const landingPage = await landingCtx.newPage();
  landingPage.on('dialog', (d) => d.dismiss());
  await landingPage.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  await landingPage.evaluateOnNewDocument((theme) => {
    localStorage.setItem('phototicket:theme', theme);
  }, THEME);
  await landingPage.goto(URL, { waitUntil: 'networkidle2' });
  // visible:true — 셀렉터는 숨김 상태에서도 DOM에 남으므로(단일 OcrUploadCard 제약상 unmount가
  // 아니라 display:none이다) 존재만 기다리면 "안 뜨는데 통과"가 된다.
  await landingPage.waitForSelector('[data-testid="landing"]', { visible: true, timeout: 15000 });
  await sleep(300);
  await measureFit('랜딩 오버레이', '[data-testid="landing"]', landingPage);
  await landingCtx.close();

  // D7 — 드래프가 복원된 메인 페이지엔 랜딩이 **덮고 있으면** 안 된다. 덮고 있으면 아래 측정
  // 전부가 오버레이 뒤에서 돌아 숫자는 멀쩡한데 화면은 랜딩인 채로 "통과"한다.
  // 포스터가 아직 없으므로 랜딩은 사라지는 게 아니라 in-flow(진입 컨트롤만) 모드로 남는다 —
  // 판정은 "fixed로 셸을 덮고 있나"다. 엘리먼트가 아예 없으면 실패로 친다(있어야 할 게 없는 것도
  // 회귀이고, 여기서 true를 주면 이 스크립트가 없애려는 그 조용한 성공이 된다).
  const landingSkippedOnDraft = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="landing"]');
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display === 'none' || s.position !== 'fixed';
  });

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
  // 크롭 모달은 createPortal로 프레임에 직접 붙는다(#606) — 포털 타깃이 body로 폴백하면
  // 여기서만 드러난다. 닫기 전에 잰다.
  await measureFit('크롭 모달', 'div[role=dialog][aria-label="포스터 크롭"]');
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
  const frame = await readFrame();
  if (!frame) throw new Error('#phone-frame이 없다 — 셸이 프레임 밖에서 렌더됐거나 래퍼가 빠졌다(#607)');

  // ── 필드 드로어 — 오른쪽 가장자리 핸들로 연다(플로팅 툴바 항목과 같은 setDrawerOpen). ──
  const drawerHandle = 'button[aria-label="티켓 항목 목록 열기"]';
  await page.evaluate((s) => document.querySelector(s)?.click(), drawerHandle);
  // dynamic(ssr:false) 청크라 즉시 query하면 없다 — 뜰 때까지 기다린다.
  await page.waitForSelector('div[role=dialog][aria-label="티켓 항목"]', { timeout: 10000 });
  await sleep(300);
  await measureFit('필드 드로어', 'div[role=dialog][aria-label="티켓 항목"]');
  await page.keyboard.press('Escape');
  await sleep(300);

  // ── max 모드 — 티켓만 남는 fixed inset-0 오버레이. 라벨 붙은 건 안쪽 티켓 래퍼라
  // 부모(=오버레이 루트)를 잰다. 가로 무드는 안쪽이 rotate(90deg)라 안쪽을 재면 회전 박스가
  // 나온다(#609 판정 대상은 오버레이 자신).
  await page.evaluate(() => document.querySelector('button[aria-label="최대화"]')?.click());
  await page.waitForSelector('[aria-label="기본 크기로 돌아가기"]', { timeout: 10000 });
  await sleep(300); // 진입 트랜지션이 끝난 rect를 잰다.
  await measureFit('max 모드 오버레이', 'div:has(> [aria-label="기본 크기로 돌아가기"])');
  await measureFit('max 모드 티켓', '[aria-label="기본 크기로 돌아가기"]');
  await page.evaluate(() => document.querySelector('[aria-label="기본 크기로 돌아가기"]')?.click());
  await sleep(400);

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
  // 편집 메뉴는 header 기준 absolute라 contain:paint가 아니라 컨테이닝 블록으로 프레임 안이다 —
  // 그래서 오히려 header가 프레임 밖으로 나가면 이게 먼저 샌다.
  await measureFit('편집 메뉴', '#editor-menu-panel');

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
    // 상단 백드롭 띠 — 백드롭은 fixed지만 contain:paint로 **프레임** 안에 갇혀 있으므로
    // 뷰포트 중앙(VW/2)이 아니라 프레임 중앙을 눌러야 한다(1440 뷰포트에선 720이 프레임 밖).
    await page.mouse.click(Math.round(frame.x + frame.w / 2), Math.round(frame.y + 10));
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

  // ── 결과 스테이지 · hero — 편집 화면을 떠나므로 맨 마지막에 잰다. ────────────
  // 루트엔 id가 없고 .app-canvas.chrome-dark는 다크 테마 편집 셸도 달고 있다(그리고 그 셸은
  // 결과 뒤에 hidden으로 남아 있다) — 결과 전용인 result-ambient의 부모를 루트로 쓴다.
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '완료')?.click(),
  );
  await page.waitForSelector('[data-testid="result-ambient"]', { timeout: 15000 });
  await sleep(600);
  await measureFit('결과 스테이지', 'div:has(> [data-testid="result-ambient"])');
  // hero는 --hero-dvh-budget을 든 유일한 요소고, 그 컨테이너 쿼리는 뷰포트가 아니라 프레임의
  // orientation을 읽는다 — 1440×900 뷰포트(landscape)의 400×900 프레임은 portrait이다(#607).
  await measureFit('결과 hero', '.result-hero');

  const near = (a, b) => a != null && Math.abs(a - b) <= 0.5;
  // 게이팅은 뷰포트가 아니라 프레임이다(#609) — 1440×675 뷰포트도 프레임이 400×675면 대조한다.
  const frameIs400 = near(frame.w, 400) && near(frame.h, 675);
  const invariant = frameIs400
    ? {
        checked: true,
        expected: BASELINE,
        pass:
          near(base.rects.dock?.h, BASELINE.dock) &&
          near(base.rects.preview?.w, BASELINE.preview.w) &&
          near(base.rects.preview?.h, BASELINE.preview.h),
      }
    : {
        checked: false,
        reason: `#563 불변식은 프레임 400×675 전용 (지금 프레임 ${frame.w}×${frame.h}, 뷰포트 ${VW}×${VH})`,
      };

  const fitFails = fits.filter((f) => !f.pass).map((f) => f.label);

  const out = {
    label: LABEL,
    viewport: { w: VW, h: VH },
    frame,
    theme: THEME,
    url: URL,
    railOpen,
    ...base,
    afterMenu: after,
    contrast,
    modal,
    frameFit: { items: fits, fails: fitFails, pass: fitFails.length === 0 },
    landingSkippedOnDraft,
    invariant,
  };
  console.log(JSON.stringify(out, null, 2));
  // checked:false도 실패다 — 못 잰 걸 0으로 넘기는 게 #609가 없앤 그 조용한 성공이다.
  if (!invariant.checked || !invariant.pass || fitFails.length > 0 || !landingSkippedOnDraft) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
