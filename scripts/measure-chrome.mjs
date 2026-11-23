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
 * ── 측정 전제 ─────────────────────────────────────────────────────────────────
 * 불변식(dock 249 / 프리뷰 219×350)은 **도크가 고정 높이**(EditorDock의 본문 196 + 모드 바 52 + 위 테두리 1)라
 * 모드·도구와 무관하게 하나다 — 옛 레일 슬롯처럼 "열어야 재현되는" 상태 전제가 없다(#826 S2). 대신 그
 * "모드와 무관"이 곧 재는 명제라 아래 1번이 세 모드·모든 디자인 도구에서 높이를 따로 잰다.
 *
 * ── 재는 축 ──────────────────────────────────────────────────────────────────
 *  1. dock · 프리뷰 티켓 · 헤더 rect                       (#500 · #554 · #558 · #563)
 *  2. 도크 높이 — 사진·정보·디자인 세 모드와 디자인 도구 전부에서 같은지(+ 프리뷰 rect 불변)  (#826 S2 ac-3)
 *  3. 도크 표면 항목별 WCAG 대비비 — 관측값(게이트 아님, 아래 dockContrast 주석) + 편집 메뉴 시트는 게이트  (#569 · #580)
 *  4. 테마 파라미터화 — 다크·라이트를 같은 실행 경로로         (#574)
 *  5. 편집 메뉴 시트(⋯) — 포커스 진입 · 닫기 3경로(Escape·⋯ 재탭·바깥 탭) · 포커스 복귀  (#826 S2 D09, 옛 모달 축 자리)
 *  6. 오버레이 · 도크 · 메뉴 시트가 #phone-frame 사각형 안인지   (#609 · 랜딩 #614 · #826 S2 constraint-13)
 *  7. 드래프 복원 시 랜딩 노출(#727)                          (#614 → #727)
 *  8. 랜딩 무드 캐러셀 카드 5장의 비율·폭·불투명도·프레임 봉쇄  (#615 · #653)
 *  9. 랜딩 이탈 경로 2종의 프레임 봉쇄·줄바꿈 줄 수·44px 탭 타깃              (#665)
 * 10. 랜딩 세로 예산 — 카피+히어로+이탈경로가 675 프레임을 스크롤 없이 담는지  (#665)
 * 11. 포스터 없이 진입 — 랜딩이 숨고 스테이지가 본문 전체(+--workbench)를 받는지  (#674)
 * 12. OCR 되돌리기 배너 · 전역 토스트 동시 노출 시 겹침 여부                    (#731 · #737)
 * 13. resultLayout — 결과 화면 배치(위 줄 44 · hero 8px 아래·폭·가운데 · 버튼 줄 12px 아래 · 버튼 ≥44 · 가로 무드 세로 가운데 · 테마 스코프)  (#826 S7 acceptance-17)
 * 14. resultToast — 통보 영역(role=status)이 빈·찬 상태 모두 프레임 안                                   (#826 S7 acceptance-14)
 * 15. resultOverlay — 저장 실패 · 대체 링크 칸 · 둘 다 뜬 최악 상태에서 버튼·고지 프레임 안, 스크롤 0, hero 불변 (675·667)  (#826 S7 acceptance-16)
 *
 * ── 대조 기준은 뷰포트가 아니라 프레임이다 (#609) ────────────────────────────
 * 예전엔 `VW===400 && VH===675`로 게이팅해서, `--viewport 1440x675`로 돌리면 프레임이
 * 아무리 망가져도 checked:false + exit 0으로 조용히 통과했다. 지금은 **측정한 #phone-frame
 * rect**로 판정하므로 데스크톱 뷰포트에서도 같은 게이트가 켜진다 — PhoneFrame이
 * height:100dvh + rail:w-[400px]라 1440×675 뷰포트의 프레임이 정확히 400×675가 되고,
 * 불변식(dock 249 / 프리뷰 219×350)을 값 변경 없이 그대로 쓴다.
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
 * 착각이 된다. 안 뜨면 앱을 의심하기 전에 콘솔의 chunk 404부터 볼 것. 자세한 건 docs/HARNESS.md §8.
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
// 시드 draft의 무드(#797) — 무드별 패널(예: Criterion 커스텀의 두 폰트 피커)을 `--rail`과 같이 잴 때.
const MOOD = arg('mood', null);
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 실측 불변식 — 400×675 기준. 다른 뷰포트에선 대조하지 않는다.
// **이 값은 편집 도크의 높이에 종속이다**(`src/components/v2/dock/EditorDock.tsx`의 DOCK_BODY_PX ·
// DOCK_MODEBAR_PX). 도크가 커진 만큼 fit 스테이지(#366)가 줄어 프리뷰도 따라 내려간다 — 그 두 상수를
// 건드리면 아래 BASELINE 숫자를 같이 다시 재야 한다(docs/HARNESS.md §5도 함께).
// 2026-11-19 prod 재실측(#826 S2, 다크·라이트 동일): dock 249 = 본문 196 + 모드 바 52 + 위 테두리 1(안전 영역 0),
// 프리뷰 219×350(무드 minimal). 옛 DesignRail 슬롯 시절의 290 / 190.9×305는 폐기.
const BASELINE = { dock: 249, preview: { w: 219, h: 350 } };

// 위 종속을 **문서가 아니라 코드로** 잠근다(#707 → #714). 도크 높이 상수가 바뀌면 여기 두 숫자가
// EditorDock.tsx와 어긋나고 `__tests__/measureChromeBaselineCoupling.test.ts`가 깨져, BASELINE을
// 다시 재라는 신호가 `bun test`(= CI required check)에서 나온다.
//
// 이 장치가 없어서 실제로 무슨 일이 있었나: #682가 슬롯만 118px → min(214px,26svh)로 올리고 BASELINE을
// 안 고쳐서 `measure-chrome.mjs`가 **두 주 넘게 항상 exit 1**이었고, 아무도 못 알아챘다 — 하네스는 CI에
// 결선돼 있지 않아 사람이 손으로 돌릴 때만 보이는데, 그 사람은 빨간불을 보고 "원래 저래"로 넘겼다.
// 침묵이 아니라 **상시 거짓 실패**가 증상이라 더 나빴다.
//
// 숫자 둘을 그대로 대조하는 이유 — 도크는 높이가 고정이라(constraint-4) 계산 결과가 곧 선언이다.
const BASELINE_DOCK_BODY_PX = 196;
const BASELINE_DOCK_MODEBAR_PX = 52;

// #674 실측 불변식 — 포스터 없이 진입한 직후(랜딩 '직접 입력'), 400×675 기준. 이 축이 잡는 회귀는 "랜딩
// inline이 티켓 스테이지와 본문 flex를 반씩 나눠 갖는 것"이라, 반토막(가로세로 각 1/2)이 나면 여기서 걸린다.
// 도크가 고정 높이가 된 뒤(#826 S2)로는 BASELINE과 **같은 값**이다(2026-11-19 실측 219×350) — 옛 레일은
// 열림(190.9×305)·닫힘(300.7×480.5)으로 갈렸지만 지금은 포스터 유무도 스테이지 크기를 안 바꾼다.
const POSTERLESS_BASELINE = { preview: { w: 219, h: 350 } };

const near = (a, b) => a != null && Math.abs(a - b) <= 0.5;

// 랜딩 무대 기둥 전시(#826 S5 constraint-3) — Landing.tsx의 slotStyle · 기둥 폭을 전시 폭 대비 비로 미러링한다.
// 값이 바뀌면 이 상수도 같이 바꿀 것(BASELINE과 같은 관례). happy-dom엔 레이아웃이 없어
// (__tests__/landingMoodGalleryTapTargets.test.tsx 참고) 실 폭 비 · 잘림 · computed 그림자는 여기서만 잰다.
const STAGE = { beam: 0.62, main: 0.52, peek: 0.34, peekOpacity: 0.32, peekOut: 0.22, tol: 0.01 };
const CAROUSEL_CARD_RATIO = 1534 / 960; // getLayout('minimal').height / width

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
  await page.evaluateOnNewDocument((theme, mood) => {
    localStorage.setItem(
      'filme:phototicket:v1',
      JSON.stringify({
        movieInfo: { title: '인터스텔라', titleOg: 'Interstellar', releaseDate: '2014' },
        ...(mood ? { components: { layout: mood } } : {}),
      }),
    );
    localStorage.setItem('phototicket:theme', theme);
  }, THEME, MOOD);
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
  // cover=true면 봉쇄(넘침 ≤0.5)에 더해 프레임 전체를 덮는지(네 변 모두 프레임과 ±1px)까지 본다 —
  // 전체 화면 모달(#826 S6 C-DLG)이 가운데 카드로 되돌아가면 봉쇄만으로는 통과해 버린다.
  const measureFit = async (label, selector, target = page, { cover = false } = {}) => {
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
    const covers = cover ? (r.overflow ? Object.values(r.overflow).every((v) => v >= -1 && v <= 1) : false) : undefined;
    const entry = {
      label,
      selector,
      ...r,
      worstOverflow: worst,
      ...(cover ? { coversFrame: covers } : {}),
      pass: worst != null && worst <= 0.5 && (!cover || covers),
    };
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

  // ── 배경 타일 부재(#786) ──────────────────────────────────────────────────
  // 반복 티켓 배경(#615 D3)은 캐러셀과 겹쳐 산만하다는 사용자 결정(2026-09-19)으로 제거했다.
  // 예전 봉쇄 두 명제(overflow:hidden 클립 + 그리드가 레이어를 덮음)는 레이어가 없으니 대상이
  // 사라졌고, 남은 명제는 "레이어가 되살아나지 않았다" 하나다.
  const backdrop = await landingPage.evaluate(() => ({
    pass: document.querySelector('[data-testid="landing-backdrop"]') === null,
  }));

  // ── 랜딩 무드 캐러셀(#615/#653) ────────────────────────────────────────────
  // 갤러리 컨테이너 자신이 프레임 밖으로 새는지는 기존 measureFit 축을 그대로 재사용한다
  // (overflow-hidden이 있어도 컨테이너 자체가 잘못 배치되면 여기서 걸린다).
  await measureFit('무드 갤러리', '[data-testid="mood-gallery"]', landingPage);
  // 무대 기둥 전시(#826 S5 acceptance-3) — 마운트 직후(active=0, 자동 전환 4000ms보다 이르다) 기둥 · 가운데 · 좌우 ·
  // 먼 카드를 전시 rect 대비 비로 잰다. 좌우 카드는 일부러 전시 밖으로 22% 나가 잘리므로 프레임 봉쇄는 카드 rect가
  // 아니라 전시 rect로 잘린 보이는 부분으로 판정한다 — 전시의 overflow-hidden이 없어지면 여기서 걸린다.
  const carousel = await landingPage.evaluate(() => {
    const gallery = document.querySelector('[data-testid="mood-gallery"]');
    const beam = document.querySelector('[data-testid="mood-gallery-beam"]');
    const index = document.querySelector('[data-testid="mood-gallery-index"]');
    const frame = document.getElementById('phone-frame');
    if (!gallery || !beam || !index || !frame) return null;
    const G = gallery.getBoundingClientRect();
    const F = frame.getBoundingClientRect();
    const galleryClips = getComputedStyle(gallery).overflow === 'hidden';
    const cards = [...gallery.querySelectorAll('button[data-slot]')].map((b) => {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      // 보이는 부분 = 카드 rect ∩ 전시 rect(전시가 잘라낼 때만).
      const vis = galleryClips
        ? { left: Math.max(r.left, G.left), right: Math.min(r.right, G.right), top: Math.max(r.top, G.top), bottom: Math.min(r.bottom, G.bottom) }
        : { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      return {
        label: (b.getAttribute('aria-label') ?? '').split(' 무드로')[0],
        slot: Number(b.dataset.slot),
        widthRatio: +(r.width / G.width).toFixed(3),
        ratio: +(r.height / r.width).toFixed(3),
        opacity: +Number(cs.opacity).toFixed(2),
        boxShadow: cs.boxShadow,
        visibility: cs.visibility,
        display: cs.display,
        pointerEvents: cs.pointerEvents,
        outLeft: +((G.left - r.left) / G.width).toFixed(3),
        outRight: +((r.right - G.right) / G.width).toFixed(3),
        worstOverflow: +Math.max(F.left - vis.left, vis.right - F.right, F.top - vis.top, vis.bottom - F.bottom).toFixed(1),
      };
    });
    const bcs = getComputedStyle(beam);
    const ics = getComputedStyle(index);
    return {
      galleryClips,
      beamRatio: +(beam.getBoundingClientRect().width / G.width).toFixed(3),
      beamBorders: [bcs.borderLeftWidth, bcs.borderRightWidth],
      index: { text: index.textContent, fontSize: ics.fontSize, numeric: ics.fontVariantNumeric },
      cards,
    };
  });
  if (!carousel) throw new Error('mood-gallery · 기둥 · 위치 표시 또는 #phone-frame을 못 찾았다');
  const within = (v, want) => Math.abs(v - want) <= STAGE.tol;
  const bySlot = (d) => carousel.cards.find((c) => c.slot === d);
  const [main, left, right, far1, far2] = [0, -1, 1, -2, 2].map(bySlot);
  carousel.count = carousel.cards.length;
  carousel.checks = {
    count: carousel.count === 5,
    clips: carousel.galleryClips,
    beam: within(carousel.beamRatio, STAGE.beam) && carousel.beamBorders.every((w) => w === '1px'),
    index: carousel.index.text === '1 / 5' && carousel.index.fontSize === '12px' && carousel.index.numeric.includes('tabular-nums'),
    main: !!main && within(main.widthRatio, STAGE.main) && main.boxShadow !== 'none' && main.opacity === 1,
    peeks:
      !!left && !!right &&
      [left, right].every((c) => within(c.widthRatio, STAGE.peek) && c.opacity === STAGE.peekOpacity && c.boxShadow === 'none') &&
      within(left.outLeft, STAGE.peekOut) && within(right.outRight, STAGE.peekOut),
    far: !!far1 && !!far2 && [far1, far2].every((c) => c.opacity === 0 && c.visibility === 'visible' && c.display !== 'none' && c.pointerEvents === 'none'),
    ratio: carousel.cards.every((c) => Math.abs(c.ratio - CAROUSEL_CARD_RATIO) < 0.01),
    frame: carousel.cards.every((c) => c.worstOverflow <= 0.5),
  };
  carousel.pass = Object.values(carousel.checks).every(Boolean);

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
  // #826 S5 acceptance-9: '이용 고지'를 접은 상태와 펼친 상태 둘 다 재고, 펼치면 전시가 그만큼 줄어야 한다(아래 판은 고정).
  const measureBudget = () =>
    landingPage.evaluate(() => {
      const overlay = document.querySelector('[data-testid="landing"]');
      const copy = document.querySelector('[data-testid="landing-copy"]');
      const hero = document.querySelector('[data-testid="mood-gallery"]');
      const exitRow = document.querySelector('[data-testid="landing-exit-paths"]');
      const summary = document.querySelector('[data-testid="legal-notice"] summary');
      if (!overlay || !copy || !hero || !exitRow || !summary) return null;
      const h = (el) => +el.getBoundingClientRect().height.toFixed(1);
      const icon = summary.querySelector('svg');
      return {
        blocks: { copy: h(copy), hero: h(hero), exitPaths: h(exitRow) },
        scrollHeight: overlay.scrollHeight,
        clientHeight: overlay.clientHeight,
        summaryHeight: h(summary),
        iconTransform: icon ? getComputedStyle(icon).transform : null,
      };
    });
  const collapsed = await measureBudget();
  await landingPage.evaluate(() => {
    document.querySelector('[data-testid="legal-notice"]').open = true;
  });
  await sleep(100);
  const expanded = await measureBudget();
  await landingPage.evaluate(() => {
    document.querySelector('[data-testid="legal-notice"]').open = false;
  });
  if (!collapsed || !expanded) throw new Error('카피/히어로/이탈경로/랜딩 오버레이/이용 고지 중 하나를 못 찾음');
  const noScroll = (b) => b.scrollHeight <= b.clientHeight + 0.5;
  const landingBudget = {
    collapsed,
    expanded,
    checks: {
      collapsedNoScroll: noScroll(collapsed),
      expandedNoScroll: noScroll(expanded),
      heroShrinks: expanded.blocks.hero < collapsed.blocks.hero,
      summaryHit: collapsed.summaryHeight >= 44,
      iconTurns: collapsed.iconTransform !== expanded.iconTransform,
    },
  };
  landingBudget.pass = Object.values(landingBudget.checks).every(Boolean);

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

  // #731 · #737 — OCR 되돌리기 배너와 전역 토스트가 겹치는지. 둘 다 fixed bottom-6이었던 게
  // 원 버그라, 완전히 격리된 새 컨텍스트에서 깨끗한 랜딩부터 시작해 실제로 둘을 동시에 띄워
  // 잰다. /api/ocr는 request interception으로 스텁해 Gemini를 안 태운다.
  const bannerCtx = await browser.createBrowserContext();
  const bannerPage = await bannerCtx.newPage();
  bannerPage.on('dialog', (d) => d.dismiss());
  await bannerPage.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  await bannerPage.evaluateOnNewDocument((theme) => {
    localStorage.setItem('phototicket:theme', theme);
  }, THEME);
  await bannerPage.setRequestInterception(true);
  bannerPage.on('request', (req) => {
    if (req.method() === 'POST' && req.url().endsWith('/api/ocr')) {
      req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ theater: 'CGV 강남' }) });
    } else {
      req.continue();
    }
  });
  await bannerPage.goto(URL, { waitUntil: 'networkidle2' });
  await bannerPage.waitForSelector('[data-testid="landing"]', { visible: true, timeout: 15000 });
  await bannerPage.evaluate(() => document.fonts.ready);
  await bannerPage.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 100;
    c.height = 100;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob((b) => r(b), 'image/png'));
    // OCR input은 accept="image/*"라 포스터 input(accept="image/jpeg")과 구분된다.
    const target = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept === 'image/*');
    if (!target) throw new Error('OCR input[type=file] 못 찾음');
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'ocr.png', { type: 'image/png' }));
    target.files = dt.files;
    target.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await bannerPage.waitForSelector('[data-testid="ocr-undo-banner"]', { timeout: 15000 });
  await bannerPage.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '편집 메뉴').click(),
  );
  await bannerPage.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '임시저장').click(),
  );
  await bannerPage.waitForSelector('[data-testid="global-toast"]', { timeout: 5000 });
  // 배너의 slide-up(0.3s, translateY 1rem → 0)이 끝난 뒤에 잰다 — 도중에 재면 배너가 16px 아래로 찍혀 gap이 16 부풀고
  // 도크와의 간격이 실제보다 모자라 보인다. 토스트 수명(2.6s) 안이다.
  await new Promise((r) => setTimeout(r, 500));
  const bannerToastCollision = await bannerPage.evaluate(() => {
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), left: +b.left.toFixed(1), right: +b.right.toFixed(1) };
    };
    return {
      banner: r(document.querySelector('[data-testid="ocr-undo-banner"]')),
      toast: r(document.querySelector('[data-testid="global-toast"]')),
      dock: r(document.querySelector('[data-testid="editor-dock"]')),
    };
  });
  bannerToastCollision.gap = +(bannerToastCollision.banner.top - bannerToastCollision.toast.bottom).toFixed(1);
  // 배너는 도크 바로 위(E-05)다 — 도크 윗면과 안 겹치고, 토스트는 그 위로 쌓인다(#826 S2).
  bannerToastCollision.dockGap = +(bannerToastCollision.dock.top - bannerToastCollision.banner.bottom).toFixed(1);
  bannerToastCollision.pass =
    bannerToastCollision.toast.bottom <= bannerToastCollision.banner.top && bannerToastCollision.dockGap >= 0;
  await bannerCtx.close();

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
  //
  // #756 — 예전엔 `querySelector(...)?.click()`으로 셀렉터를 아예 못 찾아도 조용히 no-op하고
  // 계속 진행했다. 파괴 실험으로 재현(data-testid를 존재하지 않는 값으로 변경): 조용히 넘어간 뒤
  // 15초 넘게 흐른 다음 `result-ambient` 대기에서 **엉뚱한 셀렉터 이름으로** uncaught
  // TimeoutError가 떠 진짜 원인(landing-restore 실종)을 가린다. capture-export.mjs(#751)와
  // puppeteer-core 버전(25.4.0)·launch 옵션(`--no-sandbox --force-device-scale-factor=1`)·
  // newPage() 라이프사이클이 전부 같아 실행 컨텍스트 차이는 이유가 못 되므로, capture-export.mjs
  // 처럼 셀렉터가 DOM에 없으면 여기서 바로 던지도록 맞춘다.
  //
  // 단 `visible: true`는 안 쓴다 — capture-export.mjs와 달리 이 스크립트는 #727 파괴 실험
  // (docs/HARNESS.md §11 실측: 삭제된 `html.has-draft [data-testid='landing'].fixed { display:none }`을
  // 되살리는 것)을 이 자리에서 통과시켜야 한다. 그 실험에서 랜딩 오버레이 전체가 display:none이
  // 되면 `landing-restore` 버튼은 DOM엔 있지만(그래서 클릭은 여전히 먹는다) 조상이 안 그려지니
  // puppeteer 기준 "visible"은 아니다 — `visible:true`를 걸면 여기서 10초 뒤 무조건 던져
  // docs/HARNESS.md §11이 실측 보증한 "나머지 축 8종은 true로 남는다"를 깨버린다. DOM 존재 여부만 보고,
  // 클릭도 `page.click`(실제 히트테스트) 대신 이 파일의 다른 클릭들과 같은 방식인
  // `el.click()`(조상 표시 여부 무관하게 항상 먹는다)으로 통일한다.
  await page.waitForSelector('[data-testid="landing-restore"]', { timeout: 10000 });
  await page.evaluate(() => document.querySelector('[data-testid="landing-restore"]').click());
  // 클릭까지는 됐는데 [data-testid="landing"]이 실제로 안 걷힌 경우(onRestore 미동작)는 여기서
  // 던지지 않는다 — code-review high + requirement-gap-reviewer 공통 지적(2026-09-09): 이 파일은
  // `try {...} finally { browser.close() }`뿐이라 여기서 throw하면 catch가 없어 나머지 8+개 축
  // (dock·프리뷰·frameFit·대비·모달·carousel·결과 스테이지)의 측정·JSON 출력이 통째로 스킵된다.
  // docs/HARNESS.md §11이 실측 보증한 "나머지 축 8종은 true로 남는다"가 정확히 이 자리의 관대함
  // (dismissed:false만 기록하고 계속 진행) 덕분이라, 아래 AND-게이트로 되돌린다.
  landingShownOnDraft.dismissed = await page
    .waitForFunction(
      () => getComputedStyle(document.querySelector('[data-testid="landing"]')).display === 'none',
      { timeout: 15000 },
    )
    .then(() => true)
    .catch(() => false);
  landingShownOnDraft.pass = landingShownOnDraft.pass && landingShownOnDraft.dismissed;

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
  // #826 S6: 크롭 화면은 프레임 전체를 덮는 어두운 화면이라 봉쇄와 함께 덮음(±1px)도 잰다(acceptance-5).
  // 선택자를 못 찾으면 missing으로 pass:false — 이름이 바뀐 걸 조용히 넘기지 않는다(fitFails → exitCode).
  await measureFit('크롭 모달', 'div[role=dialog][aria-label="포스터 자르기"]', page, { cover: true });
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '적용').click(),
  );
  await page.waitForSelector('div.relative.mx-auto.block.rounded-card', { timeout: 20000 });
  await sleep(900);

  // ── 도크 높이 축 (#826 S2 acceptance-3) ──────────────────────────────────────
  // 도크는 모드(사진·정보·디자인)·디자인 도구·정보 행 수와 무관하게 높이가 하나다(Seed constraint-4):
  // 본문 DOCK_BODY_PX + 모드 바 DOCK_MODEBAR_PX 고정이고 넘치면 본문 안에서 스크롤한다. 모드를 바꿀 때
  // 도크가 움직이면 fit 스테이지(#366)의 cqh가 바뀌어 프리뷰 티켓이 흔들리므로 프리뷰 rect도 같이 대조한다.
  // 옛 레일 슬롯 축(railSlot 넘침 관측)은 슬롯이 없어져 걷었다 — 대신 본문 스크롤 여부를 관측값으로 남긴다.
  const DOCK = '[data-testid="editor-dock"]';
  const readDock = () =>
    page.evaluate((sel) => {
      const r = (el) =>
        el
          ? {
              w: +el.getBoundingClientRect().width.toFixed(1),
              h: +el.getBoundingClientRect().height.toFixed(1),
            }
          : null;
      const dock = document.querySelector(sel);
      const body = dock?.querySelector('[data-testid="dock-body"]');
      // 디자인 모드엔 도구 줄 tablist가 안에 하나 더 있어 aria-label로 모드 바를 집는다.
      const bar = dock?.querySelector('[role="tablist"][aria-label="편집 모드"]');
      return {
        dock: r(dock),
        body: r(body),
        modebar: r(bar),
        bodyScroll: body
          ? { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight }
          : null,
        preview: r(document.querySelector('div.relative.mx-auto.block.rounded-card')),
        header: r(document.querySelector('header')),
      };
    }, DOCK);
  const readRects = async () => {
    const d = await readDock();
    return { rects: { dock: d.dock, preview: d.preview, header: d.header } };
  };

  // 모드 탭은 role=tab · id=dock-mode-tab-<key>다. 탭이 없으면 던지지 않고 found:false로 남겨 pass:false로
  // 떨어뜨린다 — 던지면 이후 모든 축의 진단이 같이 날아간다(#756 류와 같은 이유).
  const selectDockMode = async (key) => {
    const found = await page.evaluate((k) => {
      const el = document.getElementById(`dock-mode-tab-${k}`);
      if (!el) return false;
      el.click();
      return true;
    }, key);
    if (!found) return false;
    await page
      .waitForFunction(
        (k) => document.getElementById(`dock-mode-tab-${k}`)?.getAttribute('aria-selected') === 'true',
        { timeout: 5000 },
        key,
      )
      .catch(() => {});
    await sleep(300);
    return page.evaluate(
      (k) => document.getElementById(`dock-mode-tab-${k}`)?.getAttribute('aria-selected') === 'true',
      key,
    );
  };

  const base = await readRects(); // 진입 직후의 기본 모드(정보) — 불변식의 기준 상태다.
  const frame = await readFrame();
  if (!frame) throw new Error('#phone-frame이 없다 — 셸이 프레임 밖에서 렌더됐거나 래퍼가 빠졌다(#607)');
  // 도크가 프레임 안인지(constraint-13) — 기본 모드에서 한 번 잰다.
  await measureFit('도크', DOCK);

  const dockModes = [];
  for (const [key, label] of [
    ['info', '정보'],
    ['design', '디자인'],
    ['photo', '사진'],
  ]) {
    const selected = await selectDockMode(key);
    dockModes.push({ mode: key, label, selected, ...(await readDock()) });
  }
  // 디자인 모드의 도구 전환 — 도구마다 본문이 달라도 도크는 그대로여야 한다.
  await selectDockMode('design');
  const toolIds = await page.evaluate(() =>
    [...document.querySelectorAll('[id^="design-tool-tab-"]')].map((el) => el.id.replace('design-tool-tab-', '')),
  );
  const dockTools = [];
  for (const id of toolIds) {
    await page.evaluate((i) => document.getElementById(`design-tool-tab-${i}`)?.click(), id);
    await sleep(200);
    const d = await readDock();
    dockTools.push({ tool: id, dock: d.dock, body: d.body, preview: d.preview });
  }
  await selectDockMode('info'); // 이후 축은 기본 모드에서 이어간다.

  const dockSizes = [...dockModes.map((m) => m.dock), ...dockTools.map((t) => t.dock)];
  const previewSizes = [...dockModes.map((m) => m.preview), ...dockTools.map((t) => t.preview)];
  const allSame = (xs, key) =>
    xs.every((x) => x != null) && Math.max(...xs.map((x) => x[key])) - Math.min(...xs.map((x) => x[key])) <= 0.5;
  const dockHeight = {
    modes: dockModes,
    tools: dockTools,
    // 못 잰 건 통과가 아니다 — 세 모드가 다 선택됐고, 디자인 도구가 하나라도 있어야 한다.
    modesSelected: dockModes.length === 3 && dockModes.every((m) => m.selected),
    toolCount: dockTools.length,
    heightEqual: allSame(dockSizes, 'h'),
    previewEqual: allSame(previewSizes, 'w') && allSame(previewSizes, 'h'),
  };
  dockHeight.pass =
    dockHeight.modesSelected &&
    dockHeight.toolCount > 0 &&
    dockHeight.heightEqual &&
    dockHeight.previewEqual &&
    dockModes.every(
      (m) =>
        near(m.body?.h, BASELINE_DOCK_BODY_PX) && near(m.modebar?.h, BASELINE_DOCK_MODEBAR_PX),
    );

  // ── max 모드 — 티켓만 남는 fixed inset-0 오버레이. 라벨 붙은 건 안쪽 티켓 래퍼라
  // 부모(=오버레이 루트)를 잰다. 가로 무드는 안쪽이 rotate(90deg)라 안쪽을 재면 회전 박스가
  // 나온다(#609 판정 대상은 오버레이 자신).
  // #763(#756과 같은 클래스) — 전체 보기 버튼이 no-op하면 바로 다음 줄 '기본 크기로 돌아가기'
  // 대기가 엉뚱한 셀렉터 이름으로 타임아웃 난다. 이 버튼은 상단 줄(#826 S2, 옛 '최대화')에 있고
  // {!isMax} 조건부 렌더 + canvasReady 전엔 disabled다 — 랜딩(#727)처럼 노드는 남고 조상만
  // display:none인 케이스가 아니라 visible:true를 걸어도 다른 파괴 실험을 안 깬다.
  await page.waitForSelector('button[aria-label="전체 보기"]', { timeout: 10000, visible: true });
  await page.evaluate(() => document.querySelector('button[aria-label="전체 보기"]').click());
  await page.waitForSelector('[aria-label="기본 크기로 돌아가기"]', { timeout: 10000 });
  await sleep(300); // 진입 트랜지션이 끝난 rect를 잰다.
  await measureFit('max 모드 오버레이', 'div:has(> [aria-label="기본 크기로 돌아가기"])');
  await measureFit('max 모드 티켓', '[aria-label="기본 크기로 돌아가기"]');
  // #766(#756/#763과 같은 클래스) — 나가기가 no-op하면 셸이 max 모드 오버레이에 계속 남은 채
  // 이후 메뉴·결과 축이 그 위에서 돌아, 몇 단계 뒤 엉뚱한 셀렉터 이름으로 타임아웃 나는 지연된
  // 버전의 같은 문제가 된다. 위 전체 보기와 같은 waitForSelector(visible:true) + 무가드 click 패턴.
  await page.waitForSelector('[aria-label="기본 크기로 돌아가기"]', { timeout: 10000, visible: true });
  await page.evaluate(() => document.querySelector('[aria-label="기본 크기로 돌아가기"]').click());
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

  // ── 도크 표면 항목별 대비(#580 3계층의 도크판) — 모드마다 본문이 달라 세 모드를 각각 잰다. ──
  // **관측값이고 게이트가 아니다**: measureContrast는 불투명 조상 배경만 보고 반투명 칩(선택 칩의
  // bg-accent-soft)을 합성하지 않아, 선택 칩의 text-accent가 다크에서 3.36으로 나온다(2026-11-19). 그게 실제
  // 대비 결함인지 측정 한계인지는 사람이 본다 — 게이트에 걸면 상시 거짓 실패(#707 류)가 될 수 있다.
  // 디자인 모드는 활성 도구의 본문만 그려지므로 도구마다 돌린다.
  const dockContrast = {};
  for (const key of ['info', 'photo']) {
    await selectDockMode(key);
    dockContrast[key] = await measureContrast(DOCK);
  }
  await selectDockMode('design');
  dockContrast.design = {};
  for (const id of toolIds) {
    await page.evaluate((i) => document.getElementById(`design-tool-tab-${i}`)?.click(), id);
    await sleep(200);
    dockContrast.design[id] = await measureContrast(DOCK);
  }
  await selectDockMode('info');

  // ── 편집 메뉴 시트 — 상단 줄의 ⋯로 연다(#826 S2 D09). 프레임 봉쇄 + 닫기 경로 3종 + 포커스 복귀. ──
  // 시트는 fixed지만 PhoneFrame의 contain:paint가 프레임 안에 가둔다(#609). 그 결합이 끊기면 뷰포트
  // 기준으로 돌아가 1440 뷰포트에서 프레임 밖(좌 520px)에 그려진다 — 도크/프리뷰 숫자는 그래도 멀쩡하다.
  const MENU_BTN = 'button[aria-label="편집 메뉴"]';
  const MENU = '#editor-menu-panel';
  const menuOpen = () => page.evaluate((sel) => !!document.querySelector(sel), MENU);
  const openMenu = async () => {
    if (await menuOpen()) return true;
    await page.evaluate((s) => document.querySelector(s)?.click(), MENU_BTN);
    const ok = await page
      .waitForSelector(MENU, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    await sleep(250);
    return ok;
  };

  const present = await openMenu();
  let menu = { present };
  let contrast = null;
  if (present) {
    await measureFit('편집 메뉴 시트', MENU);
    // 초기 포커스는 아무 것도 누르기 전에 읽는다 — 첫 행으로 가야 한다(열릴 때 firstRowRef.focus()).
    const initialInside = await page.evaluate(
      (sel) => document.querySelector(sel).contains(document.activeElement),
      MENU,
    );
    contrast = await measureContrast(MENU);
    if (SHOT) await page.screenshot({ path: SHOT });

    // 닫기 경로마다 먼저 다시 연다(닫힌 시트에 Escape를 쏘면 "닫혔다"가 무조건 참인 헛검사가 된다).
    const focusOnTrigger = () =>
      page.evaluate(
        (s) => document.activeElement === document.querySelector(s),
        MENU_BTN,
      );
    await page.keyboard.press('Escape');
    await sleep(250);
    const escape = !(await menuOpen());
    const focusRestoredToTrigger = await focusOnTrigger();

    await openMenu();
    // ⋯ 재탭 — 스크림이 상단 줄 아래부터라 버튼이 가려지지 않는다. 실제 히트테스트로 누른다.
    await page.click(MENU_BTN);
    await sleep(250);
    const retap = !(await menuOpen());

    await openMenu();
    // 스크림(바깥 탭) — 프레임 안 위쪽(상단 줄 아래, 시트 위). 뷰포트가 아니라 프레임 좌표다.
    await page.mouse.click(Math.round(frame.x + frame.w / 2), Math.round(frame.y + 80));
    await sleep(250);
    const scrim = !(await menuOpen());

    menu = {
      present: true,
      initialInside,
      close: { escape, retap, scrim },
      focusRestoredToTrigger,
    };
  }
  // 상태를 남기지 않는다 — 열려 있으면 닫는다.
  if (await menuOpen()) {
    await page.keyboard.press('Escape');
    await sleep(250);
  }
  menu.pass =
    menu.present &&
    menu.initialInside &&
    menu.close.escape &&
    menu.close.retap &&
    menu.close.scrim &&
    menu.focusRestoredToTrigger;
  await sleep(300);

  // 메뉴를 열고 닫은 뒤에도 도크/프리뷰가 그대로인지(고정 높이 불변식 유지).
  const after = await readRects();

  // ── 결과 스테이지 · hero — 편집 화면을 떠나므로 맨 마지막에 잰다. ────────────
  // 결과 루트는 `[data-testid="result-stage"]`(직계 자식 result-ambient, #826 S7 DOM 계약)다. 예전엔 id가 없어
  // `div:has(> result-ambient)`로 집었다 — .app-canvas.chrome-dark는 다크 테마 편집 셸도 달고 있어(그 셸은
  // 결과 뒤에 hidden으로 남는다) 클래스로는 못 집기 때문이다. 이제 testid로 집고 ambient 직계 여부는 아래
  // resultLayout.themeScope에서 따로 잰다.
  // #763(#756과 같은 클래스, 그리고 #756 재현 실험에서 실제로 걸린 자리 — landing-restore를
  // 존재하지 않는 값으로 바꾸면 크래시가 여기서 났다) — 완료가 no-op하면 다음 줄 result-ambient
  // 15초 대기가 엉뚱한 셀렉터 이름으로 타임아웃 나서 완료 실종이 진짜 원인인 걸 가린다. 텍스트
  // 매치라 waitForSelector(CSS 셀렉터)를 못 써서 이 파일의 다른 축(landingShownOnDraft.dismissed)과
  // 같은 waitForFunction으로 존재만 먼저 확인한다. 이 버튼은 {canvasReady && (...)}
  // (MobileEditorShell.tsx:727) 조건부 렌더라 안 뜨면 DOM에 아예 없다 — 랜딩(#727)처럼 노드는
  // 남고 조상만 display:none인 케이스가 없다. 다만 offsetParent 같은 손수 만든 visible 판정은
  // fixed 포지션 요소에서 오판하는 걸 앞선 두 자리에서 확인했고 여기 대체할 CSS 셀렉터도 없어,
  // puppeteer 내장 visible 판정 없이 존재 확인만으로 그친다.
  await page
    .waitForFunction(
      () => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === '완료'),
      { timeout: 10000 },
    )
    .catch((error) => {
      // code-review high 지적 — 여기서 무조건 던지면 페이지 크래시·네비게이션 같은 다른 원인까지
      // "버튼을 못 찾음"으로 덮어써 이 이슈가 고치려는 것과 같은 오탐지를 새로 만든다. 타임아웃(=버튼이
      // 끝까지 안 나타남)일 때만 이 메시지로 바꾸고, 그 외엔 원래 에러를 그대로 던진다.
      if (error.name !== 'TimeoutError') throw error;
      throw new Error('완료 버튼(텍스트 매치)을 못 찾음 — result-ambient 15초 타임아웃 전에 여기서 먼저 던진다(#763)');
    });
  await page.evaluate(() =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '완료').click(),
  );
  await page.waitForSelector('[data-testid="result-ambient"]', { timeout: 15000 });
  await sleep(600);
  await measureFit('결과 스테이지', '[data-testid="result-stage"]');
  // hero는 --hero-dvh-budget을 든 유일한 요소고, 그 컨테이너 쿼리는 뷰포트가 아니라 프레임의
  // orientation을 읽는다 — 1440×900 뷰포트(landscape)의 400×900 프레임은 portrait이다(#607).
  await measureFit('결과 hero', '.result-hero');

  // ── 결과 화면 축 3종 (#826 S7 constraint-13 · acceptance-11/14/16/17) ─────────────────────
  // 세 축 모두 종료 조건에 실린다(#714). 못 찾은 셀렉터·못 잰 프레임(checked:false)·던진 예외는 전부 pass:false다 —
  // 던지면 이후 축의 진단이 같이 날아가니 guard가 예외를 {error, pass:false}로 바꿔 남긴다(#756 류와 같은 이유).
  //
  // 이 구간은 결과 화면이 열려 있는 채로 **무드를 바꿔 가며** 이어진다(편집으로 돌아가기 → 무드 도구 → 완료).
  // 리로드·draft 재주입보다 이쪽이 견고하다: 포스터가 IDB·메모리에 그대로 있고(재주입하면 크롭 모달을 또 거친다),
  // 무드 전환은 "내용이 바뀐다"라서 대체 링크 칸·경고 같은 결과 화면 일시 상태의 초기화도 같이 검증된다.
  // 순서: A) 세로 무드(시드의 기본 minimal) 675 — 배치·오버레이 3상태·토스트  B) 35mm-landscape 675 — 세로 가운데
  //       C) minimal 로 복귀 + 뷰포트 높이 667 — 오버레이 3상태. (A의 토스트는 링크를 성공 발급해 끝내므로 B·C 전에 무드를 바꿔 비운다.)
  const guard = async (fn) => {
    try {
      return await fn();
    } catch (error) {
      return { pass: false, error: String(error?.message ?? error) };
    }
  };
  const TID = (id) => `[data-testid="${id}"]`;
  // 한 번에 읽는 결과 화면 스냅샷 — 좌표는 전부 뷰포트 좌표(프레임 rect와 같은 원점). 없는 요소는 null.
  const readResult = () =>
    page.evaluate(() => {
      const rect = (el) => {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height };
      };
      const $ = (sel) => document.querySelector(sel);
      const t = (id) => $(`[data-testid="${id}"]`);
      const stage = t('result-stage');
      const scroll = t('result-scroll');
      return {
        frame: rect(document.getElementById('phone-frame')),
        stage: rect(stage),
        stageHasAmbient: !!stage && [...stage.children].some((c) => c.getAttribute('data-testid') === 'result-ambient'),
        stageChromeDark: !!stage && stage.classList.contains('chrome-dark'),
        htmlChromeDark: document.documentElement.classList.contains('chrome-dark'),
        topbar: rect(t('result-topbar')),
        hero: rect($('.result-hero')),
        wrapper: rect($('.result-hero [data-ticket-scale-wrapper]')),
        slot: rect(t('result-hero-slot')),
        actions: rect(t('result-actions')),
        save: rect(t('result-save')),
        link: rect(t('result-link')),
        share: rect(t('result-share')),
        notice: rect(t('result-notice')),
        expiry: rect(t('result-expiry')),
        alert: rect(t('result-alert')),
        fallback: rect(t('result-link-fallback')),
        toast: rect(t('result-toast')),
        toastRole: t('result-toast')?.getAttribute('role') ?? null,
        toastText: t('result-toast')?.textContent?.trim() ?? null,
        scrollTop: scroll ? scroll.scrollTop : null,
        scrollable: scroll ? scroll.scrollHeight > scroll.clientHeight + 0.5 : null,
      };
    });
  const inFrame = (r, f, tol = 0.5) =>
    !!r && !!f && r.left >= f.left - tol && r.right <= f.right + tol && r.top >= f.top - tol && r.bottom <= f.bottom + tol;
  const within1 = (a, b) => a != null && b != null && Math.abs(a - b) <= 1;
  const round1 = (r) => (r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +v.toFixed(1)])) : null);

  // ── 페이지 스텁 — 원본은 window.__harnessOrig에 저장하고 복원 호출이 되돌린다. ──
  // canShare: 헤드리스 macOS Chrome이 true를 줘 저장이 Web Share 경로로 가면 settle하지 않는다(capture-export.mjs와
  // 같은 사유, docs/HARNESS.md §2). undefined로 스텁해 다운로드 경로로 떨어뜨린다 — 이 구간 내내 유지한다.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  const stubCanvas = (fail) =>
    page.evaluate((on) => {
      const H = (window.__harnessOrig ??= {});
      const P = HTMLCanvasElement.prototype;
      if (on && !H.toDataURL) {
        H.toDataURL = P.toDataURL;
        H.toBlob = P.toBlob;
        P.toDataURL = function () {
          throw new Error('harness: toDataURL stubbed');
        };
        P.toBlob = function () {
          throw new Error('harness: toBlob stubbed');
        };
      } else if (!on && H.toDataURL) {
        P.toDataURL = H.toDataURL;
        P.toBlob = H.toBlob;
        delete H.toDataURL;
        delete H.toBlob;
      }
    }, fail);
  // 링크 발급 스텁: /api/ticket 만 가짜 응답(그 외 URL은 통과), clipboard.writeText는 'reject' | 'ok' | null(전부 복원).
  const stubLink = (clipboard) =>
    page.evaluate((mode) => {
      const H = (window.__harnessOrig ??= {});
      if (mode) {
        if (!H.fetch) {
          H.fetch = window.fetch;
          window.fetch = (input, init) => {
            const url = typeof input === 'string' ? input : input?.url ?? String(input);
            if (url.includes('/api/ticket')) {
              return Promise.resolve(
                new Response(JSON.stringify({ id: 'harness', url: '' }), {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                }),
              );
            }
            return H.fetch.call(window, input, init);
          };
        }
        if (!('writeText' in H)) H.writeText = navigator.clipboard ? navigator.clipboard.writeText : null;
        const writeText = () =>
          mode === 'reject' ? Promise.reject(new Error('harness: clipboard denied')) : Promise.resolve();
        if (navigator.clipboard) navigator.clipboard.writeText = writeText;
        else Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      } else {
        if (H.fetch) {
          window.fetch = H.fetch;
          delete H.fetch;
        }
        if ('writeText' in H) {
          if (H.writeText && navigator.clipboard) navigator.clipboard.writeText = H.writeText;
          else if (navigator.clipboard) delete navigator.clipboard.writeText;
          delete H.writeText;
        }
      }
    }, clipboard);
  const clickTid = (id) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.click();
      return true;
    }, TID(id));
  const waitTid = (id, timeout = 20000) =>
    page.waitForSelector(TID(id), { timeout }).then(() => true).catch(() => false);

  // 무드 전환 — 결과 → ‹ 편집으로 돌아가기 → 디자인 > 무드 도구의 라디오(aria-label이 "<label> · <caption>") → 완료 → 결과.
  const switchMoodInResult = async (label) => {
    const back = await page.evaluate(() => {
      const b = document.querySelector('button[aria-label="편집으로 돌아가기"]');
      if (!b) return false;
      b.click();
      return true;
    });
    if (!back) throw new Error('‹ 편집으로 돌아가기 버튼을 못 찾음');
    await page.waitForFunction(
      () => (document.getElementById('dock-mode-tab-design')?.getBoundingClientRect().width ?? 0) > 0,
      { timeout: 10000 },
    );
    if (!(await selectDockMode('design'))) throw new Error('디자인 모드 탭을 못 선택');
    const tool = await page.evaluate(() => {
      const b = document.getElementById('design-tool-tab-mood');
      if (!b) return false;
      b.click();
      return true;
    });
    if (!tool) throw new Error('디자인 도구 탭 #design-tool-tab-mood를 못 찾음');
    await sleep(300);
    const picked = await page.evaluate((l) => {
      const b = [...document.querySelectorAll('button[role="radio"]')].find((x) =>
        (x.getAttribute('aria-label') || '').startsWith(l),
      );
      if (!b) return false;
      b.click();
      return true;
    }, label);
    if (!picked) throw new Error(`무드 라디오를 못 찾음: ${label}`);
    await sleep(400);
    await selectDockMode('info');
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '완료')?.click());
    await page.waitForFunction(
      () => (document.querySelector('.result-hero')?.getBoundingClientRect().width ?? 0) > 0,
      { timeout: 15000 },
    );
    await sleep(800); // TicketRenderer ResizeObserver 스케일 정착
  };

  // ── resultLayout (acceptance-17) ─────────────────────────────────────────────
  const layoutChecks = (r, kind) => {
    const f = r.frame;
    const c = {};
    c.frameIs400x675 = !!f && near(f.w, 400) && near(f.h, 675);
    c.found = !!(f && r.stage && r.topbar && r.hero && r.wrapper && r.actions && r.save && r.link && r.share);
    if (!c.found) return c;
    c.topbarHeight = within1(r.topbar.h, 44);
    c.noScroll = r.scrollTop === 0 && r.scrollable === false;
    c.heroWidth = r.hero.w <= f.w - 32 + 0.5;
    c.heroCentered = within1(r.hero.left - f.left, f.right - r.hero.right);
    c.buttonsMin44 = [r.save, r.link, r.share].every((b) => b.h >= 43.5);
    c.heroMatchesScaleWrapper = within1(r.hero.h, r.wrapper.h);
    if (kind === 'portrait') {
      c.heroGapTop8 = within1(r.hero.top - r.topbar.bottom, 8);
      c.actionsGap12 = within1(r.actions.top - r.hero.bottom, 12);
    } else {
      // 가로 무드는 위 줄과 버튼 줄 사이 남는 높이의 세로 가운데다(acceptance-17: 위아래 여백 차 ≤ 1). 구현은 hero-slot이
      // 위 줄 바로 아래부터 버튼 줄 바로 위까지를 통째로 차지하게 해 원시 간격 그대로 같아진다.
      const topGap = r.hero.top - r.topbar.bottom;
      const bottomGap = r.actions.top - r.hero.bottom;
      c.heroCenteredBetweenBars = within1(topGap, bottomGap);
      c.heroGapsPositive = topGap >= 7 && bottomGap >= 11;
      c.slotBounds = !r.slot || (within1(r.slot.top, r.topbar.bottom) && within1(r.slot.bottom, r.actions.top));
    }
    // 테마 스코프(계약): 루트는 직계 ambient, .chrome-dark는 다크일 때만 루트에, html엔 걸지 않는다.
    c.themeScope = r.stageHasAmbient && r.stageChromeDark === (THEME === 'dark') && r.htmlChromeDark === false;
    return c;
  };
  const resultLayoutOf = (r, kind) => {
    const checks = layoutChecks(r, kind);
    const f = r.frame;
    return {
      kind,
      frame: round1(f),
      measured:
        r.hero && r.topbar && r.actions && f
          ? {
              topbarH: +r.topbar.h.toFixed(1),
              heroW: +r.hero.w.toFixed(1),
              heroH: +r.hero.h.toFixed(1),
              leftGap: +(r.hero.left - f.left).toFixed(1),
              rightGap: +(f.right - r.hero.right).toFixed(1),
              wrapperH: r.wrapper ? +r.wrapper.h.toFixed(1) : null,
              btnH: [r.save, r.link, r.share].map((b) => (b ? +b.h.toFixed(1) : null)),
              topGapRaw: +(r.hero.top - r.topbar.bottom).toFixed(1),
              bottomGapRaw: +(r.actions.top - r.hero.bottom).toFixed(1),
            }
          : null,
      checks,
      pass: Object.values(checks).every(Boolean),
    };
  };

  // ── resultOverlay (acceptance-16) — 경고·대체 링크 칸이 떠도 티켓·버튼·고지가 안 흔들린다. ──
  const judgeOverlay = (r, want, ref, heightWant) => {
    const f = r.frame;
    const c = {};
    c.found = !!(f && r.hero && r.save && r.link && r.share && r.notice);
    if (!c.found) return { checks: c, pass: false };
    c.frameChecked = near(f.w, 400) && near(f.h, heightWant);
    c.buttonsInFrame = [r.save, r.link, r.share].every((b) => inFrame(b, f));
    c.noticeInFrame = inFrame(r.notice, f);
    c.scrollTopZero = r.scrollTop === 0;
    c.alertPresence = !!r.alert === want.alert;
    c.fallbackPresence = !!r.fallback === want.fallback;
    c.expiryPresence = !!r.expiry === want.expiry;
    // 떠 있는 두 칸도 프레임 안이어야 한다(프레임 밖으로 새면 사용자가 못 본다).
    if (r.alert) c.alertInFrame = inFrame(r.alert, f);
    if (r.fallback) c.fallbackInFrame = inFrame(r.fallback, f);
    if (ref) c.heroSameAsDefault = within1(r.hero.w, ref.hero.w) && within1(r.hero.h, ref.hero.h);
    return { checks: c, pass: Object.values(c).every(Boolean) };
  };
  const overlayRun = async (heightWant) => {
    const out = { frameHeight: heightWant, states: {} };
    const record = (name, r, want, ref, triggered) => {
      const j = judgeOverlay(r, want, ref, heightWant);
      out.states[name] = {
        ...j,
        ...(triggered === undefined ? {} : { triggered }),
        pass: j.pass && triggered !== false,
        hero: r.hero ? { w: +r.hero.w.toFixed(1), h: +r.hero.h.toFixed(1) } : null,
        alertRect: round1(r.alert),
        fallbackRect: round1(r.fallback),
        // 관측(게이트 아님): 두 칸이 버튼 줄 윗변을 넘어 내려오는지. 계약은 "버튼 줄 위에 겹쳐 뜸"이라 의미는 사람이 본다.
        reachesActions: r.actions ? [r.alert, r.fallback].filter(Boolean).some((x) => x.bottom > r.actions.top + 1) : null,
      };
      return r;
    };
    // 0) 기본 — 경고·대체 칸 없음. hero 크기의 기준이다.
    const def = await readResult();
    record('default', def, { alert: false, fallback: false, expiry: false }, null);
    // 1) save-fail만 — 캡처가 던지게 한다(canvas.toDataURL/toBlob 스텁). 알림이 뜨면 바로 복원한다.
    await stubCanvas(true);
    const clicked1 = await clickTid('result-save');
    const shown1 = clicked1 && (await waitTid('result-alert'));
    await sleep(500);
    const saveFail = await readResult();
    await stubCanvas(false);
    record('saveFailOnly', saveFail, { alert: true, fallback: false, expiry: false }, def, shown1);
    // 2) fallback만 — 링크 클릭이 기존 경고를 지운다(spec). 캡처는 성공해야 하니 canvas는 복원된 상태다.
    await stubLink('reject');
    const clicked2 = await clickTid('result-link');
    const shown2 = clicked2 && (await waitTid('result-link-fallback'));
    await sleep(500);
    const fb = await readResult();
    record('fallbackOnly', fb, { alert: false, fallback: true, expiry: true }, def, shown2);
    // 3) worst — 링크 발급(expiry) + 대체 칸이 떠 있는 채로 저장을 실패시킨다. 대체 칸은 저장 클릭으론 안 사라진다.
    await stubCanvas(true);
    const clicked3 = await clickTid('result-save');
    const shown3 = clicked3 && (await waitTid('result-alert'));
    await sleep(500);
    const worst = await readResult();
    await stubCanvas(false);
    await stubLink(null);
    record('worst', worst, { alert: true, fallback: true, expiry: true }, def, shown3);
    out.pass = Object.values(out.states).every((s) => s.pass);
    return out;
  };

  // A) 세로 무드 675 ─────────────────────────────────────────────────────────────
  // (시드의 무드: --mood 없으면 기본 minimal = 세로. --mood로 가로를 주면 아래 portrait 판정이 어긋나 실패한다.)
  const resultLayoutPortrait = await guard(async () => resultLayoutOf(await readResult(), 'portrait'));
  const overlay675 = await guard(() => overlayRun(675));

  // resultToast (acceptance-14) — 빈 상태(기본 읽기)와 실제 통보('링크를 복사했어요') 두 상태 모두 프레임 안이다.
  const resultToast = await guard(async () => {
    const emptyRead = await readResult();
    await stubLink('ok');
    await clickTid('result-link');
    const shown = await page
      .waitForFunction(
        (sel) => /복사/.test(document.querySelector(sel)?.textContent ?? ''),
        { timeout: 20000 },
        TID('result-toast'),
      )
      .then(() => true)
      .catch(() => false);
    const filled = await readResult();
    await stubLink(null);
    const checks = {
      present: !!emptyRead.toast && !!filled.toast,
      roleStatus: emptyRead.toastRole === 'status' && filled.toastRole === 'status',
      emptyInFrame: inFrame(emptyRead.toast, emptyRead.frame),
      shown,
      shownInFrame: inFrame(filled.toast, filled.frame),
      belowTopbar: !!filled.toast && !!filled.topbar && filled.toast.top >= filled.topbar.bottom - 1,
    };
    return {
      empty: round1(emptyRead.toast),
      filled: round1(filled.toast),
      filledText: filled.toastText,
      checks,
      pass: Object.values(checks).every(Boolean),
    };
  });

  // B) 가로 무드 675 — 세로 가운데 ───────────────────────────────────────────────
  const resultLayoutLandscape = await guard(async () => {
    await switchMoodInResult('35mm 와이드');
    return resultLayoutOf(await readResult(), 'landscape');
  });

  // C) minimal 복귀 + 뷰포트 667 — 프레임이 100dvh라 프레임도 400×667이 된다. 같은 세 상태를 다시 만든다. ──────
  const overlay667 = await guard(async () => {
    await switchMoodInResult('미니멀');
    await page.setViewport({ width: VW, height: 667, deviceScaleFactor: 1 });
    await sleep(900); // 프레임·hero 스케일 재정착
    try {
      const pre = await readResult();
      const run = await overlayRun(667);
      // 무드 전환이 일시 상태(경고·대체 칸)를 비웠는지 — 안 비워졌으면 기본 상태 기준이 오염돼 이 실행은 믿을 수 없다.
      run.cleanBefore = !pre.alert && !pre.fallback;
      run.pass = run.pass && run.cleanBefore;
      return run;
    } finally {
      await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
    }
  });

  const resultLayout = {
    portrait: resultLayoutPortrait,
    landscape: resultLayoutLandscape,
    pass: !!resultLayoutPortrait?.pass && !!resultLayoutLandscape?.pass,
  };
  const resultOverlay = {
    h675: overlay675,
    h667: overlay667,
    pass: !!overlay675?.pass && !!overlay667?.pass,
  };

  // 게이팅은 뷰포트가 아니라 프레임이다(#609) — 1440×675 뷰포트도 프레임이 400×675면 대조한다.
  const frameIs400 = near(frame.w, 400) && near(frame.h, 675);
  const invariant = frameIs400
    ? {
        checked: true,
        expected: BASELINE,
        // 이 기대값이 어느 도크 높이를 전제로 재진 값인지 출력에 같이 남긴다 — 실패를 읽는 사람이
        // EditorDock.tsx와 대조할 대상을 바로 알게 된다(#707이 두 주 동안 없던 단서).
        dockBodyPx: BASELINE_DOCK_BODY_PX,
        dockModebarPx: BASELINE_DOCK_MODEBAR_PX,
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

  // 메뉴 시트 축(옛 모달 축의 자리)도 **exitCode에 싣는다** — 모달 축은 #609부터 재기만 하고 게이트엔
  // 안 실려 있어 Escape 닫기를 없애도 exit 0이었다(#714 실측). `present:false`(= ⋯ 진입점 소실)도
  // 실패다: 진입점이 사라진 걸 관용하면 `checked:false`를 통과로 넘기던 #609의 조용한 성공과 같은 구멍이다.
  // dockHeight도 마찬가지다 — 새 축은 종료 조건에 실렸는지까지가 한 세트다(#714).

  const out = {
    label: LABEL,
    viewport: { w: VW, h: VH },
    frame,
    theme: THEME,
    url: URL,
    ...base,
    dockHeight,
    afterMenu: after,
    contrast,
    dockContrast,
    dockContrastFails: Object.fromEntries(
      Object.entries(dockContrast).flatMap(([mode, c]) =>
        mode === 'design'
          ? Object.entries(c).map(([tool, cc]) => [`design/${tool}`, cc?.fails ?? []])
          : [[mode, c?.fails ?? []]],
      ),
    ),
    menu,
    frameFit: { items: fits, fails: fitFails, pass: fitFails.length === 0 },
    landingShownOnDraft,
    posterless,
    backdrop,
    carousel,
    exitPaths,
    landingBudget,
    invariant,
    bannerToastCollision,
    resultLayout,
    resultToast,
    resultOverlay,
  };
  console.log(JSON.stringify(out, null, 2));
  const contrastFails = [contrast].flatMap((c) => c?.fails ?? []);
  // checked:false도 실패다 — 못 잰 걸 0으로 넘기는 게 #609가 없앤 그 조용한 성공이다.
  if (
    !menu.pass ||
    !dockHeight.pass ||
    !invariant.checked ||
    !invariant.pass ||
    fitFails.length > 0 ||
    !landingShownOnDraft.pass ||
    !posterless.pass ||
    !backdrop.pass ||
    contrastFails.length > 0 ||
    !carousel.pass ||
    !exitPaths.pass ||
    !landingBudget.pass ||
    !bannerToastCollision.pass ||
    !resultLayout.pass ||
    !resultToast.pass ||
    !resultOverlay.pass
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
