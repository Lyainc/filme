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
 * 불변식(dock 290 / 프리뷰 190.9×305)은 **레일 슬롯이 열린 상태** 기준이다.
 * 첫 [data-rail-id] 항목을 눌러 슬롯을 편 뒤 재야 재현된다 — 안 열고 재면 dock 114.5 /
 * 프리뷰 300.7×480.5가 나오고, 스크립트는 조용히 성공한다(#574 세션이 여기서 한 번 헛돌았다).
 * 아래 openRail()이 aria-expanded=true를 확인하고, 안 열리면 던진다.
 *
 * ── 재는 축 ──────────────────────────────────────────────────────────────────
 *  1. dock · 프리뷰 티켓 · 헤더 rect                       (#500 · #554 · #558 · #563)
 *  2. 레일 슬롯 scrollTop / scrollHeight / clientHeight     (#563 고정 슬롯 넘침 판정)
 *  3. 오버레이·드로어 표면 항목별 WCAG 대비비(불투명 조상 배경 기준)     (#569 · #580)
 *  4. 테마 파라미터화 — 다크·라이트를 같은 실행 경로로         (#574)
 *  5. 모달 포커스 트랩 · 닫기 3경로 · 가려진 버튼 클릭 통과    (#574, 모달 없는 판본이면 skip)
 *  6. 오버레이 7종이 #phone-frame 사각형 안인지               (#609 · 랜딩 #614)
 *  7. 드래프 복원 시 랜딩 생략(D7)                            (#614)
 *  8. 랜딩 무드 캐러셀 카드 5장의 비율·폭·불투명도·프레임 봉쇄  (#615 · #653)
 *  9. 랜딩 이탈 경로 2종의 프레임 봉쇄·줄바꿈 줄 수·44px 탭 타깃              (#665)
 * 10. 랜딩 세로 예산 — 카피+히어로+이탈경로가 675 프레임을 스크롤 없이 담는지  (#665)
 * 11. 포스터 없이 진입 — 랜딩이 숨고 스테이지가 본문 전체(+--workbench)를 받는지  (#674)
 *
 * ── 대조 기준은 뷰포트가 아니라 프레임이다 (#609) ────────────────────────────
 * 예전엔 `VW===400 && VH===675`로 게이팅해서, `--viewport 1440x675`로 돌리면 프레임이
 * 아무리 망가져도 checked:false + exit 0으로 조용히 통과했다. 지금은 **측정한 #phone-frame
 * rect**로 판정하므로 데스크톱 뷰포트에서도 같은 게이트가 켜진다 — PhoneFrame이
 * height:100dvh + rail:w-[400px]라 1440×675 뷰포트의 프레임이 정확히 400×675가 되고,
 * 불변식(dock 290 / 프리뷰 190.9×305)을 값 변경 없이 그대로 쓴다.
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

// 실측 불변식 — 400×675 · 레일 열림 기준. 다른 뷰포트에선 대조하지 않는다.
// **이 값은 레일 상세 슬롯 높이에 종속이다**(`DesignRail.tsx`의 슬롯 className). 슬롯이 커진
// 만큼 dock이 그대로 커지고, dock이 먹은 만큼 fit 스테이지(#366)가 줄어 프리뷰도 따라 내려간다
// — 그러니 슬롯 높이 선언을 건드리면 여기 세 숫자를 같이 다시 재야 한다(CLAUDE.md 📏도 함께).
//   #563  h-[118px]           → 118.0 → dock 232.6 / 프리뷰 226.8×362.3
//   #682  h-[min(214px,26svh)] → 175.5 → dock 290.0 / 프리뷰 190.9×305   ← 현행 (2026-08-16 실측)
// 232.6 − 118.0 + 175.5 = 290.1로 차이가 정확히 슬롯 증분이다(#707).
const BASELINE = { dock: 290, preview: { w: 190.9, h: 305 } };

// 위 종속을 **문서가 아니라 코드로** 잠근다(#707 → #714). 슬롯 높이가 바뀌면 여기 문자열이
// DesignRail.tsx와 어긋나고 `__tests__/measureChromeBaselineCoupling.test.ts`가 깨져, BASELINE을
// 다시 재라는 신호가 `bun test`(= CI required check)에서 나온다.
//
// 이 장치가 없어서 실제로 무슨 일이 있었나: #682가 슬롯만 118px → min(214px,26svh)로 올리고 위
// 세 숫자를 안 고쳤다. 그래서 main이 건강한데도 `measure-chrome.mjs`가 **두 주 넘게 항상 exit 1**
// 이었고, 아무도 못 알아챘다 — 하네스는 CI에 결선돼 있지 않아 사람이 손으로 돌릴 때만 보이는데,
// 그 사람은 빨간불을 보고 "원래 저래"로 넘겼다. 침묵이 아니라 **상시 거짓 실패**가 증상이라
// 더 나빴다: 그 두 주 동안 이 하네스는 어떤 진짜 회귀도 알릴 수 없는 상태였다.
//
// 문자열 그대로 비교하는 이유 — 값을 파싱해 숫자로 비교하면 `min(214px,26svh)` 같은 식에서
// "무엇이 이겼는지"를 알아야 하는데 그건 뷰포트에 달렸고, 여기서 잠그려는 건 계산 결과가 아니라
// **선언이 바뀌었다는 사실**이다. 바뀌면 무조건 다시 재는 게 맞다.
const BASELINE_SLOT_HEIGHT_CLASS = 'h-[min(214px,26svh)]';

// #674 실측 불변식 — 포스터 없이 진입한 직후(랜딩 '직접 입력'), 400×675 · **레일 닫힘** 기준.
// BASELINE(레일 열림)과 같은 화면의 다른 상태라 값이 다르다. 이 축이 잡는 회귀는 "랜딩 inline이
// 티켓 스테이지와 본문 flex를 반씩 나눠 갖는 것"이라, 반토막(가로세로 각 1/2)이 나면 여기서 걸린다.
// 값이 레일 닫힘 상태의 포스터 있는 화면(300.7×480.5, 위 헤더 주석)과 같은 게 이 축의 요점이다 —
// 포스터 유무가 스테이지 크기를 안 바꾼다.
const POSTERLESS_BASELINE = { preview: { w: 300.7, h: 480.5 } };

const near = (a, b) => a != null && Math.abs(a - b) <= 0.5;

// 랜딩 무드 캐러셀(#615) — Landing.tsx의 TRACK_CARD_WIDTH/CAROUSEL_SLOTS를 그대로 미러링한다.
// 값이 바뀌면 이 상수도 같이 바꿀 것(BASELINE과 같은 관례). happy-dom은 clientWidth가 항상 0이라
// TicketRenderer의 scale 보정을 못 재므로(__tests__/landingMoodGalleryTapTargets.test.tsx 참고),
// 카드의 실 폭·비율·불투명도는 여기서만 실측으로 대조한다.
const CAROUSEL_TRACK_WIDTH = 140;
const CAROUSEL_CARD_RATIO = 1534 / 960; // getLayout('minimal').height / width
const CAROUSEL_SLOTS = [
  { opacity: 1, scale: 1 },
  { opacity: 0.5, scale: 0.78 },
  { opacity: 0.27, scale: 0.6 },
];

// 배경 타일 그리드(#615 LandingBackdropTiles)의 타일 개수 — Landing.tsx의 `{ length: 15 }`를
// 미러링한다(CAROUSEL_* 상수와 같은 관례). 레이어가 통째로 지워지거나 타일이 0장으로 줄어드는
// 회귀를 잡는 용도라, 개수를 바꾸면 여기도 같이 바꿀 것.
const BACKDROP_TILE_COUNT = 15;

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
  // 웹폰트 로딩 전에 재면 fallback 폰트 폭으로 줄바꿈이 갈릴 수 있다(아래 이탈 경로 lineCount가
  // 텍스트 폭에 좌우됨) — captureToImage.ts와 같은 전제.
  await landingPage.evaluate(() => document.fonts.ready);
  await sleep(300);
  await measureFit('랜딩 오버레이', '[data-testid="landing"]', landingPage);

  // ── 배경 타일 그리드(#615 LandingBackdropTiles) — 프레임 봉쇄 ────────────────
  // 레이어 자신은 absolute inset-0라 프레임과 같은 사각형이어야 한다(위 measureFit 축 재사용).
  // **그것만으로는 이 레이어의 봉쇄를 못 잰다.** 안쪽 그리드는 `-m-10 rotate-[-8deg] scale-125`라
  // 설계상 레이어보다 크고, 그게 프레임 밖으로 안 나가는 건 오직 레이어의 `overflow-hidden`
  // 덕분이다. getBoundingClientRect는 조상 클리핑을 반영하지 않으므로 안쪽 그리드를 measureFit에
  // 넣으면 멀쩡한 트리에서도 항상 실패한다 — 그래서 봉쇄를 두 명제로 쪼개 잰다:
  //   (a) 레이어가 hidden으로 자른다(클립이 살아 있다),
  //   (b) 그리드가 레이어를 덮는다(자를 게 실제로 있다 = 모서리에 빈칸이 안 생긴다).
  // (b)를 실제로 세우는 건 회전이 아니라 `-m-10`이다(2026-08-16 DOM 변형 실측) — rotate/scale만
  // 지우면 그리드가 799.4×1544.1 → 480×1180으로 줄지만 레이어 400×675는 여전히 덮어 (b)가
  // 통과하고, 회전이 없으면 모서리 빈칸 자체가 안 생기므로 그게 옳은 판정이다. 이 축이 잡는 건
  // 봉쇄가 실제로 깨지는 셋이다: overflow-hidden 소실(a 실패), 타일 0장(그리드가 594.2×83.5로
  // 주저앉아 b 실패), `-m-10`과 transform 동시 소실(400×980으로 폭이 딱 맞아떨어져 b 실패).
  // 회전 각도만 사라지는 건 봉쇄가 아니라 시각 디자인 회귀라 이 축의 대상이 아니다.
  await measureFit('배경 타일', '[data-testid="landing-backdrop"]', landingPage);
  const backdrop = await landingPage.evaluate(() => {
    const layer = document.querySelector('[data-testid="landing-backdrop"]');
    const grid = layer?.firstElementChild;
    if (!layer || !grid) return null;
    const L = layer.getBoundingClientRect();
    const G = grid.getBoundingClientRect();
    const cs = getComputedStyle(layer);
    return {
      tiles: grid.childElementCount,
      overflow: { x: cs.overflowX, y: cs.overflowY },
      layer: { w: +L.width.toFixed(1), h: +L.height.toFixed(1) },
      grid: { w: +G.width.toFixed(1), h: +G.height.toFixed(1) },
      gridExceedsLayer: G.width > L.width + 0.5 && G.height > L.height + 0.5,
    };
  });
  if (!backdrop) throw new Error('배경 타일 레이어 또는 그 안쪽 그리드를 못 찾음');
  backdrop.clipped = backdrop.overflow.x === 'hidden' && backdrop.overflow.y === 'hidden';
  backdrop.pass =
    backdrop.clipped && backdrop.gridExceedsLayer && backdrop.tiles === BACKDROP_TILE_COUNT;

  // ── 랜딩 무드 캐러셀(#615/#653) ────────────────────────────────────────────
  // 갤러리 컨테이너 자신이 프레임 밖으로 새는지는 기존 measureFit 축을 그대로 재사용한다
  // (overflow-hidden이 있어도 컨테이너 자체가 잘못 배치되면 여기서 걸린다).
  await measureFit('무드 갤러리', '[data-testid="mood-gallery"]', landingPage);
  // 카드 개별 폭·비율·불투명도는 CAROUSEL_SLOTS 대조가 필요해 별도로 잰다 — active=0인
  // 마운트 직후 상태를 잰다(자동 전환 간격 CAROUSEL_INTERVAL_MS=3500ms보다 훨씬 이르다).
  // 카드 각각을 프레임 사각형과도 대조한다(measureFit과 같은 overflow 계산) — 갤러리
  // 컨테이너 자신은 안 새도(위) 개별 카드가 안 새는 건 별개다: 갤러리의 overflow-hidden이
  // 없어지면 컨테이너 rect는 그대로인 채 카드만 밖으로 삐져나갈 수 있다.
  const carouselCards = await landingPage.evaluate(() => {
    const gallery = document.querySelector('[data-testid="mood-gallery"]');
    const frame = document.getElementById('phone-frame');
    if (!gallery || !frame) return null;
    const F = frame.getBoundingClientRect();
    return [...gallery.querySelectorAll('button[data-touch]')].map((b) => {
      const r = b.getBoundingClientRect();
      const overflow = {
        left: +(F.left - r.left).toFixed(1),
        right: +(r.right - F.right).toFixed(1),
        top: +(F.top - r.top).toFixed(1),
        bottom: +(r.bottom - F.bottom).toFixed(1),
      };
      return {
        label: (b.getAttribute('aria-label') ?? '').split(' 무드로')[0],
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        opacity: +Number(getComputedStyle(b).opacity).toFixed(2),
        overflow,
        worstOverflow: Math.max(...Object.values(overflow)),
      };
    });
  });
  if (!carouselCards) throw new Error('mood-gallery 캐러셀 버튼 또는 #phone-frame을 못 찾았다');
  const nearestSlot = (opacity) =>
    CAROUSEL_SLOTS.reduce((best, s) =>
      Math.abs(s.opacity - opacity) < Math.abs(best.opacity - opacity) ? s : best,
    );
  const carousel = {
    count: carouselCards.length,
    cards: carouselCards.map((c) => {
      const slot = nearestSlot(c.opacity);
      const expected = { w: +(CAROUSEL_TRACK_WIDTH * slot.scale).toFixed(1), opacity: slot.opacity };
      const ratio = +(c.h / c.w).toFixed(3);
      return {
        ...c,
        ratio,
        expected,
        passRatio: Math.abs(ratio - CAROUSEL_CARD_RATIO) < 0.01,
        passWidth: Math.abs(c.w - expected.w) <= 1.5,
        passOpacity: Math.abs(c.opacity - expected.opacity) <= 0.02,
        passFrame: c.worstOverflow <= 0.5,
      };
    }),
  };
  carousel.pass =
    carousel.count === 5 &&
    carousel.cards.every((c) => c.passRatio && c.passWidth && c.passOpacity && c.passFrame);

  // ── 랜딩 이탈 경로 2종(#665 문구 재정리 회귀) ────────────────────────────────
  // 프레임 봉쇄는 기존 measureFit 재사용. exitPaths 자신은 그 줄만의 두 축: (a) flex-wrap
  // 줄바꿈 후 줄 수 — 버튼 top을 반올림해 그룹핑(같은 줄이면 top이 같다), (b) 두 링크의
  // 44px 탭 타깃(#646 min-h-touch).
  await measureFit('이탈 경로', '[data-testid="landing-exit-paths"]', landingPage);
  const exitPaths = await landingPage.evaluate(() => {
    const row = document.querySelector('[data-testid="landing-exit-paths"]');
    if (!row) return null;
    const buttons = [...row.querySelectorAll('button')].map((b) => {
      const r = b.getBoundingClientRect();
      return { label: b.textContent.trim(), top: Math.round(r.top), height: +r.height.toFixed(1) };
    });
    return { buttons, lineCount: new Set(buttons.map((b) => b.top)).size };
  });
  if (!exitPaths) throw new Error('이탈 경로 줄을 못 찾음');
  exitPaths.tapTargetsPass = exitPaths.buttons.length === 2 && exitPaths.buttons.every((b) => b.height >= 43.5);
  exitPaths.pass = exitPaths.lineCount === 1 && exitPaths.tapTargetsPass;

  // ── 랜딩 세로 예산(#665) — 카피+히어로+이탈경로가 675 프레임 안에 스크롤 없이 드는지.
  // exitPaths와 스코프가 다르므로(오버레이 전체 = 브랜드 헤더+AppFooter까지 포함) 별도 축으로
  // 둔다 — 여기 묶여 있으면 헤더·푸터 변경으로 떨어졌을 때 "이탈 경로 회귀"로 오인하기 쉽다.
  // 세 블록 높이를 낱개로 더하는 것보다 오버레이 자신의 overflow-y-auto(위 클래스)가 실제로
  // 스크롤을 만드는지(scrollHeight vs clientHeight)가 "예산 초과"의 더 정확한 판정이다.
  const landingBudget = await landingPage.evaluate(() => {
    const overlay = document.querySelector('[data-testid="landing"]');
    const copy = document.querySelector('[data-testid="landing-copy"]');
    const hero = document.querySelector('[data-testid="mood-gallery"]');
    const exitRow = document.querySelector('[data-testid="landing-exit-paths"]');
    if (!overlay || !copy || !hero || !exitRow) return null;
    const h = (el) => +el.getBoundingClientRect().height.toFixed(1);
    return {
      blocks: { copy: h(copy), hero: h(hero), exitPaths: h(exitRow) },
      scrollHeight: overlay.scrollHeight,
      clientHeight: overlay.clientHeight,
    };
  });
  if (!landingBudget) throw new Error('카피/히어로/이탈경로/랜딩 오버레이 중 하나를 못 찾음');
  landingBudget.pass = landingBudget.scrollHeight <= landingBudget.clientHeight + 0.5;

  // ── 포스터 없이 진입(#674) — '직접 입력' 뒤 스테이지가 본문을 통째로 받는지 ──────────
  // 같은 컨텍스트에서 이어 잰다: 여긴 draft 시드가 없어 랜딩이 오버레이로 떠 있고, '포스터 없이
  // 직접 입력'이 정확히 이 이슈의 진입 경로다(OCR 성공도 landingDismissed로 같은 상태에 떨어진다).
  // 메인 페이지에선 못 재는 상태다 — 거긴 완료 게이트용 포스터를 올려 croppedImageUrl이 선다.
  await landingPage.evaluate(() =>
    document.querySelector('[data-testid="landing-skip-poster"]').click(),
  );
  await landingPage.waitForSelector('div.relative.mx-auto.block.rounded-card', { timeout: 15000 });
  await sleep(900); // TicketRenderer의 ResizeObserver 스케일이 정착한 rect를 잰다.
  const posterless = await landingPage.evaluate(() => {
    const landing = document.querySelector('[data-testid="landing"]');
    const preview = document.querySelector('div.relative.mx-auto.block.rounded-card');
    const f = document.getElementById('phone-frame');
    if (!landing || !preview || !f) return null;
    // 프리뷰 래퍼의 부모가 작업면(container-type:size + --workbench), 그 부모가 본문 컬럼이다.
    const stage = preview.parentElement;
    const body = stage.parentElement;
    const r = (el) => ({
      w: +el.getBoundingClientRect().width.toFixed(1),
      h: +el.getBoundingClientRect().height.toFixed(1),
    });
    return {
      landingDisplay: getComputedStyle(landing).display,
      frame: r(f),
      stage: r(stage),
      body: r(body),
      preview: r(preview),
      stageBg: getComputedStyle(stage).backgroundColor,
    };
  });
  if (!posterless) throw new Error('포스터 없이 진입 상태에서 랜딩/프리뷰/프레임 중 하나를 못 찾음');
  // 랜딩이 흐름에 남아 있으면 그 자체로 회귀다 — 스테이지와 높이를 나눠 갖는 게 #674였다.
  posterless.landingHidden = posterless.landingDisplay === 'none';
  posterless.stageFillsBody = near(posterless.stage.h, posterless.body.h);
  // --workbench가 실제로 칠해졌는지. 투명이면 본문이 --bg로 비쳐 "아래쪽만 회색 블록"으로 갈린다
  // (#674의 두 번째 증상) — 스테이지가 본문을 다 받아도 배경이 없으면 그 증상은 그대로다.
  posterless.stagePainted = !['rgba(0, 0, 0, 0)', 'transparent'].includes(posterless.stageBg);
  const posterlessFrameIs400 = near(posterless.frame.w, 400) && near(posterless.frame.h, 675);
  posterless.checked = posterlessFrameIs400;
  posterless.expected = POSTERLESS_BASELINE;
  posterless.pass =
    posterless.landingHidden &&
    posterless.stageFillsBody &&
    posterless.stagePainted &&
    posterlessFrameIs400 &&
    near(posterless.preview.w, POSTERLESS_BASELINE.preview.w) &&
    near(posterless.preview.h, POSTERLESS_BASELINE.preview.h);

  await landingCtx.close();

  // #727 c1 — **뒤집힌 명제다.** 예전 `landingSkippedOnDraft`는 "draft가 있으면 랜딩이 안 덮는다"
  // (#675 D7)를 잠갔는데, #727이 그 정책을 뒤집어 랜딩을 상시 노출로 바꿨다. 그래서 지금 재는 건
  // 정반대다: draft를 심은 이 페이지에서 랜딩이 **fixed로 덮고 있고, 숨지 않았고, 복원 진입점을
  // 담고 있는가.** 엘리먼트가 아예 없으면 실패로 친다(있어야 할 게 없는 것도 회귀이고, 여기서
  // true를 주면 이 스크립트가 없애려는 그 조용한 성공이 된다).
  //
  // 복원 행은 React state가 아니라 CSS(html.has-draft, globals.css)로 드러나므로(c9), 이 축이
  // 첫 페인트 게이트 세 파일의 합의를 브라우저에서 실제로 확인하는 유일한 자리이기도 하다 —
  // `bun test`의 landingPaintGate는 문자열 대조까지만 한다.
  const landingShownOnDraft = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="landing"]');
    if (!el) return { present: false, pass: false };
    const s = getComputedStyle(el);
    const restore = el.querySelector('[data-testid="landing-restore"]');
    const restoreShown = !!restore && getComputedStyle(restore).display !== 'none';
    return {
      present: true,
      position: s.position,
      display: s.display,
      restoreShown,
      // ac9 — 복원 행을 얹어도 오버레이가 스크롤을 만들면 안 된다(c11). 오버레이는 overflow-y-auto라
      // 넘쳐도 조용히 흡수돼, 주 CTA가 접힌 아래로 내려간 걸 rect만으로는 못 본다.
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      pass:
        s.position === 'fixed' &&
        s.display !== 'none' &&
        restoreShown &&
        el.scrollHeight <= el.clientHeight + 0.5,
    };
  });

  // ac9 — 복원 행과 주 CTA가 프레임 사각형 안인지. **draft를 심은 이 페이지에서 재야 한다** —
  // 위 landingCtx는 저장분이 없어 복원 행이 display:none이고, 거기서 재면 조용히 통과한다.
  await measureFit('복원 행', '[data-testid="landing-restore"]');
  await measureFit('랜딩 주 CTA', '[data-testid="landing"] button[aria-label="티켓 스크린샷으로 자동입력"]');

  // 여기서 draft를 **이어받아** 편집으로 들어간다(c5). 아래 측정 전부가 랜딩 오버레이 뒤에서 돌면
  // 안 되고, 그렇다고 "새로 시작" 네 경로로 들어가면 문서가 새 문서로 되돌아가(c7) 이 페이지가
  // 심어둔 title·titleOg·releaseDate가 사라져 완료 게이트가 안 선다 — 결과 스테이지 축이 통째로
  // 죽는다. 이어받기는 그 둘을 동시에 만족하는 유일한 경로다.
  await page.evaluate(() => document.querySelector('[data-testid="landing-restore"]')?.click());
  // 실패해도 던지지 않는다 — 위 축이 이미 pass:false로 exit 1을 내고, 여기서 throw하면 나머지 축
  // (dock·프리뷰·frameFit·대비·모달) 진단까지 같이 날아간다. 파괴 실험에서 실제로 그랬다.
  landingShownOnDraft.dismissed = await page
    .waitForFunction(
      () => getComputedStyle(document.querySelector('[data-testid="landing"]')).display === 'none',
      { timeout: 15000 },
    )
    .then(() => true)
    .catch(() => false);

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
  // 기본은 첫 항목(무드)이다 — #563 불변식(dock 232.6 / 프리뷰 226.8×362.3)이 그 상태 기준이라
  // 기본값을 바꾸면 표가 통째로 갈린다. `--rail <id>`(mood·color·texture·highlight·opacity·size…)로
  // 다른 항목을 열면 **그 패널의** 슬롯 넘침을 잴 수 있다(#706에서 추가 — 후보정 패널에 선택
  // 옵션 설명 줄이 붙어 예산을 다시 재야 했다. #682가 항목별 높이를 실측할 때 세션 스크립트를
  // 다시 쓴 자리이기도 하다).
  // dock은 #563 이후 고정 높이 슬롯이라 어느 항목을 열어도 232.6이고, 항목마다 갈리는 건
  // railSlot.scrollHeight 하나다 — 그래서 이 옵션은 아래 불변식 대조를 안 건드린다.
  const railId = arg('rail', '');
  const railSel = railId ? `[data-rail-id="${railId}"]` : '[data-rail-id]';
  const railFound = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    el.click();
    return true;
  }, railSel);
  if (!railFound) {
    throw new Error(`레일 항목을 못 찾았다: ${railSel} — appliesTo로 이 무드에서 숨겨진 항목일 수 있다`);
  }
  await sleep(700);
  const railOpen = await page.evaluate(
    (sel) => document.querySelector(sel)?.getAttribute('aria-expanded') === 'true',
    railSel,
  );
  if (!railOpen) {
    throw new Error(
      '레일 슬롯이 안 열렸다 — 닫힌 채로 재면 불변식(dock 290)이 아니라 dock 114.5가 나온다',
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
      // input/select는 #580 3계층(입력 함몰, --glass-fill) 실측 대상 — sr-only 파일 인풋은
      // 시각적으로 무의미한 잡음이라 제외.
      const items = [...root.querySelectorAll('h2, h3, button, input:not(.sr-only), select')].map((el) => {
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

  // ── 필드 드로어(#580 1계층 유리 + 2계층 행·카드) 대비 실측. 드로어는 위 §필드 드로어에서
  // 이미 한 번 열었다 닫았다 — measureContrast가 그 시점엔 아직 정의되지 않아 여기서 다시
  // 연다(패널 내용은 상태 비의존이라 재현에 부작용 없음). 3계층(--glass-fill 인풋)은 여기서
  // 안 잰다 — InPlaceFieldEditor가 dynamic(ssr:false) 청크라 dev 서버에서 첫 컴파일 시
  // Fast Refresh가 풀 리로드를 일으켜(실측: 클릭 직후 매번 동일 URL로 framenavigated 이벤트
  // 발생, React 상태가 날아가 aid 박스가 다시는 안 뜬다) 이 스크립트와 무관한 원인으로 계속
  // 깨진다. 3계층은 항상 이 드로어 밖 InPlaceFieldEditor의 불투명 aid 박스(bg-surface-elevated)
  // 안에서만 렌더돼(#580 grep 확인, globals.css --glass-fill 주석) 포스터 노출이 없으므로
  // 대비 하한은 그 결정론적 배경 위 합성색 계산으로 충분하다(같은 주석에 실측값 문서화).
  await page.evaluate((s) => document.querySelector(s)?.click(), drawerHandle);
  await page.waitForSelector('div[role=dialog][aria-label="티켓 항목"]', { timeout: 10000 });
  await sleep(300);
  const drawerContrast = await measureContrast('div[role=dialog][aria-label="티켓 항목"]');
  await page.keyboard.press('Escape');
  await sleep(300);

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

  // 게이팅은 뷰포트가 아니라 프레임이다(#609) — 1440×675 뷰포트도 프레임이 400×675면 대조한다.
  const frameIs400 = near(frame.w, 400) && near(frame.h, 675);
  const invariant = frameIs400
    ? {
        checked: true,
        expected: BASELINE,
        // 이 기대값이 어느 슬롯 높이를 전제로 재진 값인지 출력에 같이 남긴다 — 실패를 읽는 사람이
        // DesignRail.tsx와 대조할 대상을 바로 알게 된다(#707이 두 주 동안 없던 단서).
        slotHeightClass: BASELINE_SLOT_HEIGHT_CLASS,
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

  // 모달 축은 #609부터 재기만 하고 **exitCode엔 안 실려 있었다**(#714 실측). `AdvancedSettingsModal`
  // 에서 Escape 닫기를 실제로 없애 보면 `close.escape:false` + `focusRestoredToTrigger:false`가
  // 뜨는데 스크립트는 그대로 exit 0을 냈다 — 진짜 회귀를 통과시키는 죽은 축이라 게이트에 싣는다.
  //
  // `present:false`(= '고급 설정' 진입 버튼이 없다)도 실패로 친다. 원래 "모달 없는 판본" 대비
  // 관용이었는데 지금 판본엔 그 행이 있으므로, present가 false로 뒤집히는 건 곧 **진입점이
  // 사라졌다**는 뜻이다. 그건 이 하네스가 잡아야 할 회귀지 건너뛸 사유가 아니고, `!invariant.checked`
  // 를 실패로 치는 자세(#609)와 같은 판정이다.
  modal.pass =
    modal.present &&
    modal.focus.initialInside &&
    modal.focus.returnsAfterPush &&
    // 헤더 '완료'를 못 찾으면 clickThrough가 null이다 — 옵셔널 체이닝 없이 읽으면 TypeError로
    // 스크립트가 통째로 죽어 나머지 축(dock·프리뷰·frameFit·대비) 진단까지 같이 날아간다.
    // 못 잰 건 통과가 아니므로(`checked:false`와 같은 자세) null은 pass:false로 떨어뜨린다.
    modal.clickThrough?.dialogClosed &&
    !(modal.clickThrough?.leaked ?? true) &&
    modal.close.escape &&
    modal.close.closeButton &&
    modal.close.backdrop &&
    modal.focusRestoredToTrigger;

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
    drawerContrast,
    modal,
    frameFit: { items: fits, fails: fitFails, pass: fitFails.length === 0 },
    landingShownOnDraft,
    posterless,
    backdrop,
    carousel,
    exitPaths,
    landingBudget,
    invariant,
  };
  console.log(JSON.stringify(out, null, 2));
  const contrastFails = [contrast, drawerContrast].flatMap((c) => c?.fails ?? []);
  // checked:false도 실패다 — 못 잰 걸 0으로 넘기는 게 #609가 없앤 그 조용한 성공이다.
  if (
    !modal.pass ||
    !invariant.checked ||
    !invariant.pass ||
    fitFails.length > 0 ||
    !landingShownOnDraft.pass ||
    !posterless.pass ||
    !backdrop.pass ||
    contrastFails.length > 0 ||
    !carousel.pass ||
    !exitPaths.pass ||
    !landingBudget.pass
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
