/** Capture actual JPEGs for six moods, materials and coatings.
 * bun scripts/capture-export.mjs --layout minimal --out /tmp/minimal.jpg
 * bun scripts/capture-export.mjs --compare /tmp/before.jpg /tmp/after.jpg
 * Headless capture disables native share and receives the debug JPEG event.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL_ = arg('url', 'http://localhost:3000/');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const launch = () =>
  puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--force-device-scale-factor=1'],
  });

/**
 * bun에서 `await browser.close()`가 **resolve하지 않는다**(실측: Chrome 프로세스는 죽는데
 * 그 Promise가 안 풀려 스크립트가 7분 넘게 매달렸다). 배치 루프가 매 실행마다 그걸 기다리면
 * 대조표를 못 만든다 — 닫기는 걸고 짧게만 기다린 뒤 넘어간다.
 */
const closeBrowser = (browser) =>
  Promise.race([browser.close().catch(() => {}), sleep(3000)]);

const t0 = Date.now();
const marks = {};
const mark = (name) => {
  marks[name] = ((Date.now() - t0) / 1000).toFixed(1);
};

// ── 대조 모드 ────────────────────────────────────────────────────────────────
/**
 * 두 JPEG의 채널 최대 절대차. 디코더는 Chrome 자신을 쓴다 — 저장물을 만든 것과 같은
 * 디코더라 디코더 차이가 대조에 안 섞이고, 새 의존성도 안 붙는다.
 */
async function compare(pathA, pathB, tolerance, diffOut) {
  const toDataUrl = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const result = await page.evaluate(
      async (a, b, diffOut) => {
        const load = (src) =>
          new Promise((res, rej) => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => rej(new Error('decode failed'));
            img.src = src;
          });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.naturalWidth !== ib.naturalWidth || ia.naturalHeight !== ib.naturalHeight) {
          return {
            sizeMismatch: `${ia.naturalWidth}x${ia.naturalHeight} vs ${ib.naturalWidth}x${ib.naturalHeight}`,
          };
        }
        const px = (img) => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, c.width, c.height).data;
        };
        const da = px(ia);
        const db = px(ib);
        const W = ia.naturalWidth;
        let max = 0;
        let sum = 0;
        let n = 0;
        let over3 = 0;
        // 넘는 픽셀의 bbox — "얼마나"만큼 "어디가" 갈렸는지가 원인 추적의 절반이다.
        let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
        for (let i = 0; i < da.length; i += 4) {
          let worst = 0;
          for (let k = 0; k < 3; k++) {
            const d = Math.abs(da[i + k] - db[i + k]);
            if (d > worst) worst = d;
            sum += d;
            n += 1;
          }
          if (worst > max) max = worst;
          if (worst > 3) {
            over3 += 1;
            const p = i / 4;
            const x = p % W;
            const y = (p - x) / W;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
        return {
          size: `${W}x${ia.naturalHeight}`,
          maxAbsDiff: max,
          meanAbsDiff: +(sum / n).toFixed(4),
          pixelsOver3: over3,
          pixelsOver3Pct: +((over3 / (da.length / 4)) * 100).toFixed(4),
          over3Bbox: over3 ? { x0, y0, x1, y1 } : null,
          // 차이를 ×20 증폭한 PNG — "얼마나"만 보고 원인을 못 좁힐 때 어디가 갈렸는지 눈으로 본다.
          diffPng: diffOut
            ? (() => {
                const c = document.createElement('canvas');
                c.width = W;
                c.height = ia.naturalHeight;
                const g = c.getContext('2d');
                const im = g.createImageData(W, c.height);
                for (let i = 0; i < da.length; i += 4) {
                  for (let k = 0; k < 3; k++) {
                    im.data[i + k] = Math.min(255, Math.abs(da[i + k] - db[i + k]) * 20);
                  }
                  im.data[i + 3] = 255;
                }
                g.putImageData(im, 0, 0);
                return c.toDataURL('image/png');
              })()
            : null,
        };
      },
      toDataUrl(pathA),
      toDataUrl(pathB),
      Boolean(diffOut),
    );
    if (diffOut && result.diffPng) {
      writeFileSync(diffOut, Buffer.from(result.diffPng.split(',')[1], 'base64'));
    }
    delete result.diffPng;
    const pass = !result.sizeMismatch && result.maxAbsDiff <= tolerance;
    console.log(JSON.stringify({ mode: 'compare', a: pathA, b: pathB, tolerance, ...result, pass }, null, 2));
    // exit()가 아니라 exitCode다 — 여기서 즉시 종료하면 finally의 closeBrowser가 안 돌아,
    // 이 파일이 길게 방어한 그 헤드리스 Chrome 잔류가 "대조 실패"라는 흔한 경로에서만 생긴다
    // (claude-review PR #643 P2).
    if (!pass) process.exitCode = 1;
  } finally {
    await closeBrowser(browser);
  }
}

// ── 캡처 모드 ────────────────────────────────────────────────────────────────
/**
 * 후가공이 실제로 보이려면 포스터가 톤 전 구간을 덮어야 한다 — overlay·soft-light는
 * 0.5를 축으로 갈리고 screen은 어두운 쪽에서만 뜬다. 그래서 x축 회색 램프 × y축 색 램프
 * 2D 그라데이션을 코드로 그린다(실행 간 비트 단위로 동일 = 대조의 전제).
 */
const POSTER_DRAW = `
  const c = document.createElement('canvas');
  c.width = 960; c.height = 1440;
  const g = c.getContext('2d');
  const img = g.createImageData(c.width, c.height);
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      const gray = Math.round((x / (c.width - 1)) * 255);
      const t = y / (c.height - 1);
      img.data[i] = Math.round(gray * (1 - 0.4 * t) + 255 * 0.4 * t);
      img.data[i + 1] = Math.round(gray * (1 - 0.2 * t));
      img.data[i + 2] = Math.round(gray * (1 - 0.6 * t) + 200 * 0.6 * t);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
`;

/**
 * `--bg` 전용 티켓 배경 이미지(#671·#672). 포스터(회색 그라디언트)와 **색이 확실히 갈리는**
 * 굵은 사선 줄무늬라, 저장물에서 이게 포스터 슬롯 안으로 새면 --compare 증폭 diff에 바로 뜬다
 * (클립이 빠지면 정확히 그 증상이 난다 — #490/#495 z-order).
 *
 * 실제 업로드가 useLogoCrop → getCroppedImg로 만드는 것과 같은 PNG다. 브라우저 안에서 그려
 * data: URL로 굽는 이유는 seed가 localStorage에 실려야 하는데 blob:은 페이지 수명이 갈리기
 * 때문이고, data:는 saveDraft의 blob: 비우기 대상도 아니라 복원 왕복에도 그대로 남는다.
 */
const BG_PATTERN_DRAW = `
  const c = document.createElement('canvas');
  c.width = 480; c.height = 480;
  const g = c.getContext('2d');
  g.fillStyle = '#1f6feb';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#f78166';
  g.lineWidth = 28;
  for (let i = -c.height; i < c.width * 2; i += 72) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + c.height, c.height);
    g.stroke();
  }
`;




async function switchLayout(page, label) {
  const clickRail = await page.evaluate(() => {
    const b = document.querySelector('[data-rail-id="mood"]');
    if (!b) return false;
    b.click();
    return true;
  });
  if (!clickRail) throw new Error('무드 rail 아이콘을 못 찾음(data-rail-id="mood")');
  await sleep(400);
  const clicked = await page.evaluate((label) => {
    const b = [...document.querySelectorAll('button[role="radio"]')].find((x) =>
      (x.getAttribute('aria-label') || '').startsWith(label),
    );
    if (!b) return false;
    b.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`무드 라디오 버튼을 못 찾음: ${label}`);
  await sleep(300);
}

/**
 * `--field-off <csv>`(#755) — Admission 하위 필드를 개별로 끄는 오버라이드. 나열한 필드만
 * `fieldVisibility[f]=false`로 심고 나머진 PersistedState 기본값(ALL_FIELDS_ON)을 그대로 둔다
 * (usePhototicket.ts의 `{ ...prev.fieldVisibility, ...(saved.fieldVisibility ?? {}) }` 병합이
 * 그 전제) — 그래서 아무것도 안 주면 기존 --full-fields 캡처와 동일하게 fieldVisibility 자체가
 * seed에 안 실려 회귀가 없다. `screen`을 끄면 `theater`도 같이 끈다 — MoodStub의 HALL 행은
 * theater·screen 두 값을 fieldPieces로 합성해서(_shared.tsx), screen만 꺼도 theater 값이 남으면
 * HALL 행이 그대로 산다. theater는 이 네 필드 목록에 없는 다섯 번째 필드라 독립 플래그를 안 열고
 * screen에 묶는다.
 */
const ADMISSION_FIELDS = ['seat', 'watchDate', 'watchTime', 'screen'];
function buildFieldVisibilityOverride(fieldOff) {
  const overrides = {};
  for (const f of fieldOff) {
    if (!ADMISSION_FIELDS.includes(f)) {
      throw new Error(`--field-off는 admission 하위 필드만 지원: ${f} (허용: ${ADMISSION_FIELDS.join(',')})`);
    }
    overrides[f] = false;
    if (f === 'screen') overrides.theater = false;
  }
  return overrides;
}

/**
 * stub 무드 전용 실측(#755) — PATTERN_BOX(MoodStub.tsx, 고정 y1060~1102)와 "The Film" 섹션
 * 헤드 사이 겹침을 판정하려면 헤드의 자연 픽셀(960 캔버스 기준) top이 필요하다.
 * `data-ticket-scale-wrapper`(TicketRenderer.tsx)가 natural-pixel 루트고 `transform:scale()`만
 * 걸려 있어, `offsetWidth`(변환 전 레이아웃 폭)와 `getBoundingClientRect().width`(변환 후 렌더
 * 폭)의 비가 곧 현재 프리뷰 배율이다 — 그 배율로 나누면 배율과 무관한 자연 픽셀 좌표가 나온다.
 */
async function measureStubFilmHead(page) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const wrapper = document.querySelector('[data-ticket-scale-wrapper]');
    const filmHead = [...document.querySelectorAll('span')].find((el) => el.textContent.trim() === 'The Film');
    if (!wrapper || !filmHead) return null;
    const wRect = wrapper.getBoundingClientRect();
    const fRect = filmHead.getBoundingClientRect();
    const scale = wRect.width / wrapper.offsetWidth;
    return {
      filmHeadTop: +((fRect.top - wRect.top) / scale).toFixed(1),
      filmHeadBottom: +((fRect.bottom - wRect.top) / scale).toFixed(1),
    };
  });
}

async function capture({ layout, material, coating, intensity, bg, bgScale, fullFields, fieldOff, switchTo, toggleFill, out, timeoutMs }) {
  const seed = {
    movieInfo: {
      title: '인터스텔라',
      titleOg: 'Interstellar',
      releaseDate: '2014',
      watchDate: '2024-03-15',
      watchTime: '19:30',
      theater: 'CGV 용산아이파크몰',
      screen: '4관 IMAX',
      seat: 'H12',
      bookingNumber: '1234567890123456',
      // --full-fields(#728 Stub 실측) — 최소 seed는 rating/runtime/actors/reissue가 전부 비어
      // "필드 최소" 변형만 낸다. 필드가 다 켜졌을 때 space-evenly가 어떻게 눌리는지를 보려면
      // 반대 극단이 필요해서 여기서 채운다.
      ...(fullFields ? {
        rating: 4.5,
        runtime: '132분',
        actors: '매튜 매커너히, 앤 해서웨이, 제시카 차스테인, 마이클 케인, 케이시 애플렉',
        isReissue: true,
        reissueDate: '2024-12-25',
      } : {}),
    },
    components: {
      layout,
      material,
      coating,
      materialIntensity: intensity,
      coatingIntensity: intensity,
      // 배경 배율(#680) — `--bg`가 이미지를 주입할 때만 의미가 있다. 저장물에 확대가 실제로
      // 실리는지(ac3)를 재려면 같은 트리를 1.0/1.5로 두 번 떠서 --compare해야 해서 knob을 연다.
      backgroundPatternScale: bgScale,
      ...(fullFields ? {
        chainVisible: true,
        chainLabel: 'CGV',
        formatVisible: true,
        formatLabel: 'IMAX',
      } : {}),
    },
    // 포스터 주입이 "첫 업로드"로 오판돼 fieldVisibility가 통째로 갈리는 걸 막는다
    // (measure-editorial-stub.mjs와 같은 함정).
    hadPoster: true,
    ...(fieldOff.length ? { fieldVisibility: buildFieldVisibilityOverride(fieldOff) } : {}),
  };

  const browser = await launch();
  const logs = [];
  try {
    const page = await browser.newPage();
    page.on('dialog', (d) => d.dismiss());
    page.on('console', (m) => {
      const t = m.text();
      if (t.startsWith('[capture:')) logs.push(t);
    });
    await page.setViewport({ width: 400, height: 675, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((s, bgDrawSrc, bg) => {
      // 배경 레이어는 그릴 이미지가 있어야 선다(없으면 스타일이 비어 안 그려진다, #672).
      if (bg) {
        const c = new Function(`${bgDrawSrc}; return c;`)();
        // **blob:이어야 한다 — data:가 아니라.** html-to-image의 parseURLs는 data:를 처리 대상에서
        // 아예 빼므로(embed-resources), data:로 재면 실제 앱이 만드는 blob:의 fetch→인라인 경로를
        // 통째로 건너뛴 걸 재게 된다. useLogoCrop/getCroppedImg 산출물이 blob:이라 여기도 맞춘다.
        // 이 URL은 evaluateOnNewDocument가 도는 그 document에 속하므로 페이지 수명 동안 살아 있다.
        const blob = c.toDataURL('image/png');
        const bin = atob(blob.split(',')[1]);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        s.components.backgroundPatternImage = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
      }
      localStorage.setItem('filme:phototicket:v1', JSON.stringify(s));
      localStorage.setItem('phototicket:theme', 'dark');
      // 헤드리스에선 navigator.share가 영영 settle하지 않는다(파일 상단 진단) — 공유 미지원
      // 데스크톱과 같은 다운로드 경로로 떨어뜨려 CTA가 실제로 완료되게 한다.
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    }, seed, BG_PATTERN_DRAW, bg);
    await page.goto(`${URL_}?debug=1`, { waitUntil: 'networkidle2' });
    mark('loaded');

    // 랜딩을 먼저 지운다(#755) — #727부터 랜딩은 draft 존재와 무관하게 항상 fixed로 뜨고
    // `landingDismissed`를 사용자가 명시로 세워야 내려간다. 이 게이트를 안 거치고 바로 포스터
    // input을 주입해 크롭까지 마치면, MobileEditorShell의 handlePosterCropComplete가
    // `fresh = !landingDismissed`를 true로 읽어 "랜딩에서 올라온 첫 포스터"로 오판해
    // `startFreshDoc({keepPoster:true})`를 불러 seed movieInfo(title·releaseDate 등)를 통째로
    // 지운다 — croppedImageUrl은 남아 '완료' 버튼은 뜨지만 canExport(title·releaseDate 필요)가
    // 계속 false라 '완료'가 무한 no-op한다(실측: aria-disabled=true + "제목과 개봉연도가
    // 필요해요" 토스트). "이어서 만들기"(data-testid="landing-restore")는 onRestore가
    // `setLandingDismissed(true)` 하나뿐이라 다른 부작용이 없다.
    await page.waitForSelector('[data-testid="landing-restore"]', { visible: true, timeout: 10000 });
    await page.click('[data-testid="landing-restore"]');
    await sleep(200);

    // 포스터 주입 → 크롭 '적용'. '적용'은 뜬 직후 누르면 completedCrop이 아직 안 서서 no-op이라
    // (disabled는 false다) 대기 후 클릭한다.
    await page.evaluate(async (drawSrc) => {
      const el = [...document.querySelectorAll('input[type=file]')].find((i) =>
        (i.accept || '').includes('image/jpeg'),
      );
      if (!el) throw new Error('포스터 input을 못 찾음(accept image/jpeg)');
      const c = new Function(`${drawSrc}; return c;`)();
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.95));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'poster.jpg', { type: 'image/jpeg' }));
      el.files = dt.files;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, POSTER_DRAW);
    const clickByText = async (text) => {
      const ok = await page.evaluate((t) => {
        const b = [...document.querySelectorAll('button')].find(
          (x) => (x.textContent || '').trim().includes(t),
        );
        if (!b) return false;
        b.click();
        return true;
      }, text);
      if (!ok) throw new Error(`버튼을 못 찾음: ${text}`);
    };
    await page.waitForFunction(
      () => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === '적용'),
      { timeout: 30000 },
    );
    await sleep(1500);
    await clickByText('적용');
    await sleep(1500);

    mark('cropped');
    const stubMeasure = layout === 'stub' ? await measureStubFilmHead(page) : null;
    if (switchTo) {
      await switchLayout(page, switchTo);
      mark('switched');
    }
    if (toggleFill) {
      // "포스터 채우기" 축은 'size' rail에만 있고 minimal 등 POSTER_FILL_MOODS 무드에서만 뜬다
      // (#527) — contain→cover 전환도 layout 전환과 같은 재매핑 대상이다(#509).
      const opened = await page.evaluate(() => {
        const b = document.querySelector('[data-rail-id="size"]');
        if (!b) return false;
        b.click();
        return true;
      });
      if (!opened) throw new Error('크기 rail 아이콘을 못 찾음(data-rail-id="size")');
      await sleep(400);
      await clickByText('꽉 채우기');
      await sleep(300);
      mark('fillToggled');
    }
    await clickByText('완료');
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('button')].some((b) =>
          (b.textContent || '').includes('사진에 저장'),
        ),
      { timeout: 20000 },
    );
    // 프리뷰 디바운스(280ms)와 폰트 로드가 끝난 뒤 캡처하도록 여유를 준다.
    await sleep(1200);

    await page.evaluate(() => {
      window.__exportDataUrl = null;
      window.addEventListener('capture-debug-result', (e) => {
        window.__exportDataUrl = e.detail;
      });
    });
    mark('resultOpen');
    await clickByText('사진에 저장');
    await page.waitForFunction(() => window.__exportDataUrl != null, { timeout: timeoutMs });
    mark('captured');
    const dataUrl = await page.evaluate(() => window.__exportDataUrl);
    if (!dataUrl.startsWith('data:image/jpeg')) throw new Error(`JPEG이 아님: ${dataUrl.slice(0, 40)}`);
    const bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
    writeFileSync(out, bytes);

    // 오버레이가 실제로 합성됐는지 로그로 확인 — 안 걸린 채 "통과"하는 조용한 성공을 막는다.
    const wanted = [material, coating].filter((t) => t !== 'original' && t !== 'none');
    const drawn = logs.filter((l) => l.startsWith('[capture:overlay]'));
    const missing = wanted.filter((t) => !drawn.some((l) => l.includes(`texture=${t}`)));
    if (missing.length) throw new Error(`오버레이가 안 그려짐: ${missing.join(',')} (로그: ${drawn.join(' | ')})`);
    console.log(
      JSON.stringify(
        { mode: 'capture', layout, material, coating, intensity, fullFields, fieldOff, switchTo, toggleFill, out, bytes: bytes.length, overlays: drawn, marks, stubMeasure },
        null,
        2,
      ),
    );
  } finally {
    await closeBrowser(browser);
  }
}

const cmpIdx = argv.indexOf('--compare');
if (cmpIdx >= 0) {
  const [a, b] = argv.slice(cmpIdx + 1, cmpIdx + 3);
  if (!a || !b) throw new Error('--compare <a.jpg> <b.jpg>');
  await compare(a, b, Number(arg('tolerance', '3')), arg('diff-out', null));
} else {
  const out = arg('out', null);
  if (!out) throw new Error('--out <경로> 필요');
  await capture({
    layout: arg('layout', 'minimal'),
    material: arg('material', 'original'),
    coating: arg('coating', 'none'),
    intensity: Number(arg('intensity', '1')),
    bg: argv.includes('--bg'),
    bgScale: Number(arg('bg-scale', '1')),
    fullFields: argv.includes('--full-fields'),
    fieldOff: (arg('field-off', '') || '').split(',').filter(Boolean),
    switchTo: arg('switch-to', null),
    toggleFill: argv.includes('--toggle-fill'),
    out,
    timeoutMs: Number(arg('timeout', '60000')),
  });
}
// bun에선 browser.close() 뒤에도 프로세스가 안 끝난다(실측: Chrome은 죽었는데 bun이 5분 넘게
// 살아 있어 파이프가 EOF를 못 받는다). 배치 루프가 매 실행 타임아웃을 기다리지 않게 명시적 종료.
process.exit(process.exitCode ?? 0);
