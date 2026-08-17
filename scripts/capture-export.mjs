/**
 * 저장물(export JPEG) 회수 · 픽셀 대조 하네스 (#506 acceptance 2).
 *
 *   bun scripts/capture-export.mjs --coating gloss --intensity 1 --out /tmp/gloss.jpg
 *   bun scripts/capture-export.mjs --material artpaper --intensity 0.6 --out /tmp/artpaper.jpg
 *   bun scripts/capture-export.mjs --emboss --out /tmp/emboss.jpg
 *   bun scripts/capture-export.mjs --coating gloss --emboss --out /tmp/gloss-emboss.jpg
 *   bun scripts/capture-export.mjs --layout minimal --emboss --switch-to "35mm Wide" --out /tmp/switched.jpg
 *   bun scripts/capture-export.mjs --layout minimal --emboss --toggle-fill --out /tmp/filled.jpg
 *   bun scripts/capture-export.mjs --layout stub --bg --out /tmp/bg.jpg
 *   bun scripts/capture-export.mjs --layout editorial --bg --bg-scale 1.5 --out /tmp/bg15.jpg
 *   bun scripts/capture-export.mjs --lasso --out /tmp/lasso.jpg
 *   bun scripts/capture-export.mjs --emboss --lasso --out /tmp/brush-and-lasso.jpg
 *   bun scripts/capture-export.mjs --compare /tmp/a.jpg /tmp/b.jpg
 *
 * `--switch-to <무드 label>`·`--toggle-fill`(#509 재매핑 검증)은 초기 무드에서 형압을 칠한
 * 뒤 리로드 없이 다른 무드로 전환하거나(layout) "포스터 채우기"를 켜고서(posterFit) 캡처한다
 * — 재매핑 전이라면 updateComponents가 이 전환에서 embossStamps를 비워
 * `[capture:overlay] emboss...` 로그 자체가 안 뜬다(마스크가 사라짐). 재매핑 후엔 전환해도
 * 마스크가 남아 그 로그가 그대로 뜬다 — capture()의 emboss 로그 단언이 이 차이를 그대로 잡는다.
 *
 * `--lasso`(#509 2단계 c10)는 ChipRadio로 도구를 '올가미'로 바꾼 뒤 폐곡선을 그려 EmbossPath를
 * 커밋한다 — `--emboss`와 함께 주면 브러시 스탬프 + 올가미 다각형이 같은 비트맵에 동시에
 * 굽히는지(c5, 서로 다른 축이 아니라 같은 형압 축 안의 두 입력이 하나로 합쳐짐)까지 검증한다.
 *
 * 목적은 후가공(코팅 gradient 4종 · 재질 noise 3종 · 형압 #509)의 **저장물**을 브랜치별로
 * 뽑아 픽셀로 대조하는 것 — 프리뷰가 아니라 `captureNodeToJpeg`가 실제로 뱉는 바이트다.
 * `--emboss`/`--lasso`는 material/coating과 달리 localStorage 시드로 못 넣는다(형압 마스크는
 * c8로 세션 한정이라 PersistedState 밖) — 대신 실제 rail UI를 몰아 브러시 드래그·올가미
 * 트레이스를 재현한다(paintEmboss/paintEmbossLasso).
 *
 * ── 헤드리스에서 '사진에 저장'이 안 끝나는 이유 (실측 확정) ──────────────────
 * 앱 버그가 아니다. macOS 헤드리스 Chrome에서 `navigator.canShare({files:[…]})`가
 * **true**를 준다 — 그래서 ResultPanel이 `shareTicketAsJpeg` 경로를 타고
 * `navigator.share(…)`를 부르는데, OS 공유 시트가 뜰 수 없는 환경이라 그 Promise가
 * 영영 settle하지 않아 CTA가 "저장 중..."에 묶인다. 캡처 자체는 그 전에 이미 끝나 있다
 * (진단 실행: `[capture:main] out=404483`이 t<3s에 찍히는데 CTA는 계속 "저장 중...").
 * main에서도 같은 값이라 특정 변경 탓이 아니다.
 *
 * 그래서 하네스는 `navigator.canShare`를 false로 스텁해 다운로드 경로(공유 미지원
 * 데스크톱과 동일)로 떨어뜨린다. 회수는 `?debug=1`에서 captureToImage가 이미 쏘는
 * `capture-debug-result` 이벤트(detail = JPEG data URL)를 받아 파일로 쓴다 — 그 문자열이
 * 곧 `dataUrlToJpegBlob`이 디코드해 파일로 나가는 바로 그 바이트다.
 *
 * 서버 전제(#601): dev(:3000)·prod 어느 쪽이든 되지만 **지금 워킹트리/`.next`를 서빙하는**
 * 서버여야 한다. 브랜치별 대조는 detached checkout → 캡처 → 복귀로 만든다(dev 서버가
 * 워킹트리를 그대로 서빙하므로 재기동이 필요 없다).
 *
 * 출력은 stdout JSON 한 덩어리. --compare는 채널 최대 절대차가 --tolerance(기본 3,
 * JPEG 인코딩 잡음 수준)를 넘으면 exit 1.
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

/**
 * 형압(#509) 마스크는 c8(세션 한정)이라 PersistedState(localStorage 시드)에 안 실린다 —
 * material/coating처럼 seed로 주입할 수 없다. 그래서 실제 UI를 그대로 몬다: rail 'emboss'
 * 항목 열기 → 도구 칩 탭으로 진입 → 포스터 위 드래그(page.mouse, 합성 PointerEvent가
 * 아니라 CDP 실제 입력이라 React 핸들러가 진짜 유저 제스처와 동일하게 받는다) → 같은 칩
 * 재탭으로 종료. 종료를 꼭 해야 하는 이유 — 브러시 레이어가 `position:fixed`라 안 끄면
 * 이어지는 '완료'·'사진에 저장' 클릭을 그 레이어가 가로챈다.
 */

/**
 * 진입/종료가 도구 칩 탭 하나로 접혔다(#679) — 이 스크립트는 2026-08-18까지 못 따라갔다.
 *
 * 예전엔 "형압 칠하기 시작"·"올가미로 선택 시작"·"탭해서 종료" 전폭 CTA가 있었고 이 하네스가
 * 그 문구를 textContent로 찾았는데, #679가 CTA를 없애고 칩 탭 자체가 진입/종료를 겸하게
 * 바꿨다(`__tests__/embossPanelTapToEnter.test.tsx:36`이 그 부재를 잠근다). 그래서
 * `--emboss`·`--lasso`가 **반드시 throw했다** — 두 플래그가 통째로 죽어 있었다.
 *
 * 지금은 아래 `selectEmbossTool` 하나가 진입·도구전환·종료를 전부 맡는다. 같은 칩을 다시
 * 누르는 게 종료이므로 별도 종료 헬퍼가 필요 없다.
 */
async function ensureEmbossPanelOpen(page) {
  const alreadyOpen = await page.evaluate(
    () =>
      ![...document.querySelectorAll('[role="radiogroup"]')].every(
        (g) => (g.getAttribute('aria-label') || '') !== '형압 도구',
      ),
  );
  if (alreadyOpen) return;
  const clickRail = await page.evaluate(() => {
    const b = document.querySelector('[data-rail-id="emboss"]');
    if (!b) return false;
    b.click();
    return true;
  });
  if (!clickRail) throw new Error('형압 rail 아이콘을 못 찾음(data-rail-id="emboss")');
  await sleep(400); // grid-rows 패널 펼침 트랜지션(300ms)
}

async function paintEmboss(page) {
  await ensureEmbossPanelOpen(page);

  await selectEmbossTool(page, '브러시');

  const rect = await page.evaluate(() => {
    const el = document.querySelector('[data-poster-root]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error('포스터 rect를 못 얻음(형압 대상 없음)');

  // 대각선 스와이프 하나 — 넓게 지나가 브러시(기본 반경 7%) 겹침으로 이어진 선을 만든다.
  const x0 = rect.left + rect.width * 0.25;
  const y0 = rect.top + rect.height * 0.25;
  const x1 = rect.left + rect.width * 0.7;
  const y1 = rect.top + rect.height * 0.75;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await sleep(20);
  }
  await page.mouse.up();
  await sleep(200);

  // 같은 칩 재탭 = 종료. 안 끄면 브러시 레이어가 이후 '완료'·'사진에 저장' 클릭을 가로챈다.
  await selectEmbossTool(page, '브러시');
}

/** ChipRadio "형압 도구"에서 label과 정확히 같은 텍스트의 라디오 버튼을 클릭한다(#509 2단계). */
async function selectEmbossTool(page, label) {
  const clicked = await page.evaluate((label) => {
    const group = [...document.querySelectorAll('[role="radiogroup"]')].find(
      (g) => (g.getAttribute('aria-label') || '') === '형압 도구',
    );
    if (!group) return false;
    const b = [...group.querySelectorAll('button[role="radio"]')].find((x) => (x.textContent || '').trim() === label);
    if (!b) return false;
    b.click();
    return true;
  }, label);
  if (!clicked) throw new Error(`형압 도구 라디오를 못 찾음: ${label}`);
  await sleep(150);
}

/**
 * 자석 올가미(#509 2단계, c10) — paintEmboss와 같은 진입/종료 골격이지만 ChipRadio로 도구를
 * '올가미'로 바꾼 뒤 사각형에 가까운 폐곡선을 그린다. EmbossBrushLayer의 계약상 포인터업
 * 시점에 3점 미만이면 조용히 버려지므로, 네 변을 여러 스텝으로 지나 MIN_LASSO_SPACING(자연
 * 분율 0.01)을 넘는 정점을 충분히 쌓는다 — 대각선 한 줄로 끝나는 paintEmboss와 다른 이유.
 */
async function paintEmbossLasso(page) {
  await ensureEmbossPanelOpen(page);
  await selectEmbossTool(page, '올가미');

  const rect = await page.evaluate(() => {
    const el = document.querySelector('[data-poster-root]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error('포스터 rect를 못 얻음(올가미 대상 없음)');

  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.5;
  const rx = rect.width * 0.2;
  const ry = rect.height * 0.15;
  // 사각형 네 꼭짓점 + 시작점 복귀 — 실제 닫힘 판정은 포인터업 하나로 이미 충족되지만(>=3점),
  // 궤적을 시작점으로 되돌리는 게 사용자가 자석 올가미를 쓰는 실제 제스처와 더 가깝다.
  const corners = [
    [cx - rx, cy - ry],
    [cx + rx, cy - ry],
    [cx + rx, cy + ry],
    [cx - rx, cy + ry],
    [cx - rx, cy - ry],
  ];
  await page.mouse.move(corners[0][0], corners[0][1]);
  await page.mouse.down();
  for (let seg = 1; seg < corners.length; seg++) {
    const [x0, y0] = corners[seg - 1];
    const [x1, y1] = corners[seg];
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      await sleep(15);
    }
  }
  await page.mouse.up();
  await sleep(200);

  // 같은 칩 재탭 = 종료(위 paintEmboss와 같은 이유).
  await selectEmbossTool(page, '올가미');
}

/**
 * 무드 rail을 열어 다른 무드로 전환한다(#509 재매핑 검증) — LayoutStrip 버튼은
 * `role="radio" aria-label="${label} · ${caption}"`라 label 접두 매칭으로 찾는다.
 * 페이지 리로드 없이(React state 유지) 전환해야 "폐기 없이 정합 유지"를 실제로 재현한다.
 */
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

async function capture({ layout, material, coating, intensity, bg, bgScale, emboss, lasso, switchTo, toggleFill, out, timeoutMs }) {
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
    },
    // 포스터 주입이 "첫 업로드"로 오판돼 fieldVisibility가 통째로 갈리는 걸 막는다
    // (measure-editorial-stub.mjs와 같은 함정).
    hadPoster: true,
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
    if (emboss) {
      await paintEmboss(page);
      mark('embossed');
    }
    if (lasso) {
      await paintEmbossLasso(page);
      mark('lassoed');
    }
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
    if ((emboss || lasso) && !drawn.some((l) => l.includes('emboss'))) {
      throw new Error(`형압 오버레이가 안 그려짐(로그: ${drawn.join(' | ')})`);
    }
    // 올가미(2단계) — EmbossPath가 실제로 커밋·투영·굽기까지 갔는지는 stamps 유무와 별개로
    // paths 카운트로만 확인된다(compositeEmbossOverlay의 debug 로그, captureToImage.ts).
    if (lasso && !drawn.some((l) => l.includes('emboss') && /paths=[1-9]/.test(l))) {
      throw new Error(`올가미 다각형이 안 커밋되거나 안 그려짐(로그: ${drawn.join(' | ')})`);
    }

    console.log(
      JSON.stringify(
        { mode: 'capture', layout, material, coating, intensity, emboss, lasso, switchTo, toggleFill, out, bytes: bytes.length, overlays: drawn, marks },
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
    emboss: argv.includes('--emboss'),
    lasso: argv.includes('--lasso'),
    switchTo: arg('switch-to', null),
    toggleFill: argv.includes('--toggle-fill'),
    out,
    timeoutMs: Number(arg('timeout', '60000')),
  });
}
// bun에선 browser.close() 뒤에도 프로세스가 안 끝난다(실측: Chrome은 죽었는데 bun이 5분 넘게
// 살아 있어 파이프가 EOF를 못 받는다). 배치 루프가 매 실행 타임아웃을 기다리지 않게 명시적 종료.
process.exit(process.exitCode ?? 0);
