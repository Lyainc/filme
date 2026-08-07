import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { LAYOUTS } from '../src/utils/layouts';

// #512 — 프리뷰(브라우저 CSS 렌더)와 export 합성(captureToImage.ts)이 포스터 영역에서 실제로 같은
// 픽셀을 내는지, 진짜 소프트웨어 canvas 2D(실제 pixel buffer + getImageData/putImageData)로 검증한다.
// captureComposite.test.ts류는 draw call만 기록하는 가짜 컨텍스트라 순서·인자는 잡아도 "결과 픽셀이
// 맞는가"는 못 잡는다 — 이 파일은 SUT의 bakeColorFilter/applyColorOpsInto를 실제 pixel buffer에 대고
// 그대로 실행시켜, 그 결과값을 직접 읽어 비교한다(재구현이 아니라 실제 코드 경로를 태운다).
//
// #490(불투명 무드 배경이 합성된 포스터를 덮음)과 #495(iOS가 ctx.filter를 drawImage에 안 먹여 포스터
// 색보정이 저장물에서만 빠짐)는 둘 다 "실기기(iOS)에서만" 터졌다 — 데스크톱은 ctx.filter가 먹어서
// 무사했다. 그래서 이 스위트는 iOS를 흉내낸 fake context(HONORED=false, ctx.filter를 drawImage에서
// 무시)로 6무드 × 2 pixelRatio(다운로드 2x/공유 1x) 전부를 실제로 캡처해 포스터 영역 픽셀을 직접
// 읽는다. 데스크톱(ctx.filter가 먹는 환경) 경로는 captureComposite.test.ts의 9개 테스트가 이미
// 커버한다(그 파일의 fake context는 getImageData를 구현 안 해 isCtxFilterHonored()가 감지 실패 →
// 기본값 true로 폴백 — #512에서 무수정).

const HONORED = false; // iOS 흉내 — ctx.filter가 drawImage에 안 먹는다.
const MARGIN = 10; // captureToImage.ts EXPORT_MARGIN_PX(비공개 상수)와 동일값(#382/#449).

const POSTER_RGB: [number, number, number] = [180, 60, 40]; // 임의의 식별 가능한 포스터 원색.
// _shared.tsx PRINT_SIM('saturate(0.92) contrast(1.05)') + material=original·coating=none 기본
// brightness(0.5)(defaultBrightnessForTexture) — #490/#495 실제 회귀가 터진 조합 그대로.
const POSTER_FILTER = 'saturate(0.92) contrast(1.05) brightness(0.5)';

// 무드별 실측 사실(_shared.tsx·MoodXxx.tsx 소스에서 직접 확인, #490/#495 리뷰 코멘트와 동일) — 루트에
// 불투명 배경을 까는 4무드(35mm·editorial·stub·35mm-landscape)와 안 까는 2무드(minimal·criterion).
const MOOD_BACKDROPS: Record<string, string | null> = {
  minimal: null,
  criterion: null,
  '35mm': 'rgb(10, 10, 10)', // Mood35mm.tsx FS_BASE
  editorial: 'rgb(244, 237, 224)', // MoodEditorial.tsx PAPER
  stub: 'rgb(244, 237, 224)', // MoodStub.tsx PAPER
  '35mm-landscape': 'rgb(7, 7, 7)', // Mood35mmLandscape.tsx FS_BASE(35mm과 다른 리터럴)
};

interface Rect { x: number; y: number; w: number; h: number }
type RGBA = [number, number, number, number];

function intersect(a: Rect | null, b: Rect): Rect | null {
  if (!a) return b;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= x || bottom <= y) return { x, y, w: 0, h: 0 };
  return { x, y, w: right - x, h: bottom - y };
}

function parseColor(style: unknown): RGBA | null {
  if (typeof style !== 'string' || !style || style === 'transparent') return null;
  let m = style.match(/^#([0-9a-fA-F]{6})$/);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  m = style.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((s) => parseFloat(s));
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return [parts[0], parts[1], parts[2], parts.length > 3 ? Math.round(parts[3] * 255) : 255];
  }
  return null;
}

function isOpaque(c: RGBA | null): boolean {
  return !!c && c[3] >= 250;
}

// ─── html-to-image 모킹 — base PNG를 "그 순간 backdrop 엘리먼트의 실제 backgroundColor"로 태그한다.
// 이게 #490 수정(neutralize-before-toPng)이 실제로 도는지를 재구현 없이 직접 관찰하는 지점이다.
let trackedBackdrop: HTMLElement | null = null;
let trackedBackdropOriginal: RGBA | null = null;
let forcedBaseColor: RGBA | null = null; // safeOverlay 테스트 전용 — backdrop 무관하게 base를 고정.
// 실제로는 data-poster-root 서브트리가 toPng에서 제외돼 그 박스만 base PNG에 구멍으로 남는다
// (#439). forcedBaseColor를 쓰는 fixture는 포스터가 티켓 일부만 차지하므로, 이 구멍을 u<value로
// 흉내낸다(포스터 박스가 티켓 전체인 메인 매트릭스에선 항상 null 그대로 — 필요 없다).
let forcedBaseHoleUMax: number | null = null;

function taggedUrl(c: RGBA | null): string {
  return c ? `data:image/png;base64,BASE#solid=${encodeURIComponent(JSON.stringify(c))}` : 'data:image/png;base64,BASE';
}

// 스프레드 스냅샷 + afterAll 복원 — 살아있는 네임스페이스를 붙들면 복원이 no-op이 된다(#611).
// 안 되돌리면 이 toPng 스텁이 프로세스 끝까지 남아, 캡처의 자연 실패에 기대는 뒤 파일이
// 항상 성공을 받는다(#618, captureComposite와 동일 사유).
const realHtmlToImage = { ...require('html-to-image') };
mock.module('html-to-image', () => ({
  toPng: () => {
    if (forcedBaseColor) return Promise.resolve(taggedUrl(forcedBaseColor));
    const live = trackedBackdrop ? parseColor(trackedBackdrop.style.backgroundColor) : null;
    return Promise.resolve(isOpaque(live) ? taggedUrl(trackedBackdropOriginal) : taggedUrl(null));
  },
}));

// captureToImage.ts는 isCtxFilterHonored()의 감지 결과를 모듈 스코프 변수에 영구 메모이즈한다
// (실제 런타임에선 페이지 수명 내내 환경이 안 바뀌니 맞는 설계다). 그런데 bun test는 한 프로세스
// 안에서 캡처 테스트들이 서로 다른 캔버스 환경을 번갈아 태우므로, 먼저 돈 파일의 판정(예:
// getImageData 미구현 → true 폴백)이 이 파일로 샌다. 그래서 매 테스트 앞에서 감지를 비워 아래
// FakeCtx 환경으로 다시 재게 하고, 끝나면 다시 비워 이후 파일이 자기 환경으로 새로 감지하게 한다.
//
// **`delete require.cache[...]`로 모듈 인스턴스를 새로 받는 방식이었는데 그건 못 쓴다(#611)** —
// 다른 파일이 `@/utils/captureToImage`를 `mock.module`로 한 번이라도 가로채면(resultPanelShareGating)
// 캐시를 지워도 mock 레지스트리가 먼저 잡아 같은(=이미 메모된) 인스턴스를 돌려주기 때문이다.
// 리셋 함수는 그 인스턴스 자체의 메모를 비우므로 가로채기와 무관하게 동작한다.
const { captureNodeToJpeg, applyCssColorFilterToPixel, resetCtxFilterProbeForTest } =
  require('../src/utils/captureToImage') as typeof import('../src/utils/captureToImage');

afterAll(() => {
  mock.module('html-to-image', () => realHtmlToImage);
  resetCtxFilterProbeForTest();
});

// ─── 진짜 소프트웨어 canvas 2D — 실제 Uint8ClampedArray backing buffer + getImageData/putImageData.
// SUT의 bakeColorFilter/applyColorOpsInto가 이 buffer에 대고 그대로 돌아간다(재구현 아님).
let THROW_ON_BLEND = false; // safeOverlay 실패-경로 테스트 전용 — 오버레이 fillRect(비-source-over)만 throw.
const ctxCache = new WeakMap<HTMLCanvasElement, FakeCtx>();

class FakeCtx {
  canvas: HTMLCanvasElement;
  buf: Uint8ClampedArray;
  fillStyle: unknown = '#000000';
  filter = 'none';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  imageSmoothingEnabled = false;
  imageSmoothingQuality = 'low';
  private stack: Array<{ clip: Rect | null; fillStyle: unknown; filter: string; globalAlpha: number; globalCompositeOperation: string }> = [];
  private clipRect: Rect | null = null;
  private pendingRect: Rect | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.buf = new Uint8ClampedArray(Math.max(1, canvas.width) * Math.max(1, canvas.height) * 4);
    allocatedCanvases.push(this);
  }

  save() {
    this.stack.push({ clip: this.clipRect, fillStyle: this.fillStyle, filter: this.filter, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return; // 실제 Canvas 2D와 동일 — 빈 스택 restore()는 조용히 무시.
    this.clipRect = s.clip;
    this.fillStyle = s.fillStyle;
    this.filter = s.filter;
    this.globalAlpha = s.globalAlpha;
    this.globalCompositeOperation = s.globalCompositeOperation;
  }
  beginPath() { this.pendingRect = null; }
  rect(x: number, y: number, w: number, h: number) { this.pendingRect = { x, y, w, h }; }
  clip() { if (this.pendingRect) this.clipRect = intersect(this.clipRect, this.pendingRect); }

  private blend(rect: Rect, sample: (u: number, v: number) => RGBA) {
    const canvasBounds = { x: 0, y: 0, w: this.canvas.width, h: this.canvas.height };
    const r = intersect(this.clipRect, intersect(canvasBounds, rect)!);
    if (!r || r.w <= 0 || r.h <= 0) return;
    const x0 = Math.max(0, Math.floor(r.x));
    const y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(this.canvas.width, Math.ceil(r.x + r.w));
    const y1 = Math.min(this.canvas.height, Math.ceil(r.y + r.h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const u = rect.w > 0 ? (px + 0.5 - rect.x) / rect.w : 0;
        const v = rect.h > 0 ? (py + 0.5 - rect.y) / rect.h : 0;
        const [sr, sg, sb, sa255] = sample(u, v);
        const i = (py * this.canvas.width + px) * 4;
        const sa = (sa255 / 255) * this.globalAlpha;
        if (this.globalCompositeOperation === 'destination-in') {
          const da = this.buf[i + 3] / 255;
          this.buf[i + 3] = Math.round(da * sa * 255);
          continue;
        }
        // source-over(기본) — 이 스위트가 쓰는 blend 모드는 이 둘뿐이라 나머지는 안 구현.
        const da = this.buf[i + 3] / 255;
        const outA = sa + da * (1 - sa);
        if (outA <= 0) { this.buf[i] = 0; this.buf[i + 1] = 0; this.buf[i + 2] = 0; this.buf[i + 3] = 0; continue; }
        this.buf[i] = Math.round((sr * sa + this.buf[i] * da * (1 - sa)) / outA);
        this.buf[i + 1] = Math.round((sg * sa + this.buf[i + 1] * da * (1 - sa)) / outA);
        this.buf[i + 2] = Math.round((sb * sa + this.buf[i + 2] * da * (1 - sa)) / outA);
        this.buf[i + 3] = Math.round(outA * 255);
      }
    }
  }

  fillRect(x: number, y: number, w: number, h: number) {
    // safeOverlay 실패-경로 주입 지점 — compositeOverlay는 clip() 직후 이 fillRect를 부르므로,
    // 여기서 throw하면 정확히 "clip 이후~restore 이전" 구간에서 실패하는 실제 시나리오가 된다.
    if (THROW_ON_BLEND && this.globalCompositeOperation !== 'source-over') {
      throw new Error('injected overlay fillRect failure');
    }
    const c = parseColor(this.fillStyle);
    if (!c) return; // gradient/pattern fillStyle — 이 스위트 어떤 통과 케이스도 실제 색이 필요 없다.
    this.blend({ x, y, w, h }, () => c);
  }

  drawImage(src: unknown, dx: number, dy: number, dw?: number, dh?: number) {
    // isCtxFilterHonored()의 1×1 probe는 3-arg 오버로드(drawImage(image, dx, dy))를 쓴다 —
    // dw/dh 미지정 시 소스의 자연 크기로 그린다(실제 Canvas 2D와 동일 동작).
    if (dw === undefined || dh === undefined) {
      const nat = naturalSize(src);
      dw = nat.w;
      dh = nat.h;
    }
    const sampler = resolveSampler(src);
    const filterStr = this.filter;
    const useFilter = HONORED && !!filterStr && filterStr !== 'none';
    this.blend({ x: dx, y: dy, w: dw, h: dh }, (u, v) => {
      const [r, g, b, a] = sampler(u, v);
      if (!useFilter || a === 0) return [r, g, b, a];
      const [fr, fg, fb] = applyCssColorFilterToPixel(filterStr, r, g, b);
      return [fr, fg, fb, a];
    });
  }

  getImageData(x: number, y: number, w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const sx = x + i;
        const sy = y + j;
        if (sx < 0 || sy < 0 || sx >= this.canvas.width || sy >= this.canvas.height) continue;
        const si = (sy * this.canvas.width + sx) * 4;
        const di = (j * w + i) * 4;
        data[di] = this.buf[si]; data[di + 1] = this.buf[si + 1]; data[di + 2] = this.buf[si + 2]; data[di + 3] = this.buf[si + 3];
      }
    }
    return { data, width: w, height: h };
  }
  putImageData(imgData: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number) {
    const { data, width: w, height: h } = imgData;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const dx2 = x + i;
        const dy2 = y + j;
        if (dx2 < 0 || dy2 < 0 || dx2 >= this.canvas.width || dy2 >= this.canvas.height) continue;
        const di = (dy2 * this.canvas.width + dx2) * 4;
        const si = (j * w + i) * 4;
        this.buf[di] = data[si]; this.buf[di + 1] = data[si + 1]; this.buf[di + 2] = data[si + 2]; this.buf[di + 3] = data[si + 3];
      }
    }
  }
  createLinearGradient() { return { addColorStop() {} }; }
  createPattern() { return {}; }
}

function naturalSize(src: unknown): { w: number; h: number } {
  if (src instanceof HTMLCanvasElement) return { w: src.width, h: src.height };
  const img = src as { naturalWidth?: number; naturalHeight?: number };
  return { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
}

function resolveSampler(src: unknown): (u: number, v: number) => RGBA {
  const testColor = (src as { __testColor?: RGBA }).__testColor;
  if (testColor) return () => testColor;
  if (Object.prototype.hasOwnProperty.call(src as object, '__solidColor')) {
    const solid = (src as { __solidColor: RGBA | null }).__solidColor;
    return (u) => (forcedBaseHoleUMax !== null && u < forcedBaseHoleUMax ? [0, 0, 0, 0] : solid ?? [0, 0, 0, 0]);
  }
  if (src instanceof HTMLCanvasElement) {
    const ctx = ctxCache.get(src);
    if (!ctx) return () => [0, 0, 0, 0];
    return (u, v) => {
      const sx = Math.min(ctx.canvas.width - 1, Math.max(0, Math.floor(u * ctx.canvas.width)));
      const sy = Math.min(ctx.canvas.height - 1, Math.max(0, Math.floor(v * ctx.canvas.height)));
      const i = (sy * ctx.canvas.width + sx) * 4;
      return [ctx.buf[i], ctx.buf[i + 1], ctx.buf[i + 2], ctx.buf[i + 3]];
    };
  }
  throw new Error('resolveSampler: 이 테스트 픽스처가 다루지 않는 drawImage source');
}

// base PNG 로드용 <img> 더블 — loadImage()가 만드는 new Image()를 가로챈다. toPng이 반환한 URL의
// #solid= 태그를 실제 색으로 해석해 drawImage 샘플러(__solidColor)에 노출한다.
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  __solidColor: RGBA | null = null;
  decode() { return Promise.resolve(); }
  set src(v: string) {
    const m = v.match(/#solid=(.+)$/);
    this.__solidColor = m ? (JSON.parse(decodeURIComponent(m[1])) as RGBA) : null;
    queueMicrotask(() => this.onload?.());
  }
}

function stubRect(el: Element, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = (() => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} })) as Element['getBoundingClientRect'];
}

/** 캡처 노드 > (backdrop 있으면 그 wrapper) > data-poster-root > <img>. 포스터가 티켓 전체를 덮는다(cover). */
function buildFixture(moodId: string, width: number, height: number): HTMLElement {
  const node = document.createElement('div');
  stubRect(node, 0, 0, width, height);

  let posterParent: HTMLElement = node;
  const backdropColor = MOOD_BACKDROPS[moodId];
  if (backdropColor) {
    const root = document.createElement('div');
    root.style.backgroundColor = backdropColor;
    stubRect(root, 0, 0, width, height);
    node.appendChild(root);
    posterParent = root;
    trackedBackdrop = root;
    trackedBackdropOriginal = parseColor(backdropColor);
  } else {
    trackedBackdrop = null;
    trackedBackdropOriginal = null;
  }

  const posterRoot = document.createElement('div');
  posterRoot.setAttribute('data-poster-root', 'true');
  stubRect(posterRoot, 0, 0, width, height);
  posterParent.appendChild(posterRoot);

  const posterImg = document.createElement('img');
  posterImg.src = 'blob:poster';
  posterImg.dataset.role = 'poster';
  Object.defineProperty(posterImg, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(posterImg, 'naturalHeight', { value: height, configurable: true });
  (posterImg as unknown as { decode: () => Promise<void> }).decode = () => Promise.resolve();
  posterImg.style.objectFit = 'cover';
  posterImg.style.filter = POSTER_FILTER;
  (posterImg as unknown as { __testColor: RGBA }).__testColor = [...POSTER_RGB, 255];
  stubRect(posterImg, 0, 0, width, height);
  posterRoot.appendChild(posterImg);

  document.body.appendChild(node);
  return node;
}

let mainCtx: FakeCtx | null = null;
// SUT가 캡처 한 번에 만든 모든 2D 캔버스 — 오프스크린 크기 상한을 관찰하는 지점(#538).
const allocatedCanvases: FakeCtx[] = [];
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
let originalToDataURL: typeof HTMLCanvasElement.prototype.toDataURL;
let originalImage: typeof Image;

beforeEach(() => {
  resetCtxFilterProbeForTest(); // 아래 FakeCtx 환경으로 감지를 다시 재게 한다(#611)
  mainCtx = null;
  allocatedCanvases.length = 0;
  THROW_ON_BLEND = false;
  forcedBaseColor = null;
  forcedBaseHoleUMax = null;
  trackedBackdrop = null;
  trackedBackdropOriginal = null;

  originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    if (kind !== '2d') return null;
    let ctx = ctxCache.get(this);
    if (!ctx) {
      ctx = new FakeCtx(this);
      ctxCache.set(this, ctx);
      if (!mainCtx) mainCtx = ctx; // SUT는 메인 캔버스를 가장 먼저 만든다(tmp 캔버스보다 앞).
    }
    return ctx;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;

  originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = (() => 'data:image/jpeg;base64,OUT') as unknown as typeof HTMLCanvasElement.prototype.toDataURL;

  originalImage = globalThis.Image;
  (globalThis as { Image: unknown }).Image = FakeImage;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  (globalThis as { Image: unknown }).Image = originalImage;
});

function closeEnough(actual: number, expected: number, tolerance = 2) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

// #660 — @2x는 캔버스 면적이 @1x의 4배라 bun 기본 5000ms에 여유가 없다. 격리 5회 반복 2.04~2.46초,
// 전체 스위트 동시 실행 3.04~3.46초로 측정했고, 이슈 본문이 기록한 실측 최악치(격리 5.1~5.6초,
// 전체 스위트 리소스 경합 시 22초)까지 덮는다. **CI(.github/workflows/ci.yml)는 이미
// `bun test --timeout 30000`으로 돌아 30초 여유가 있는데, bun은 테스트별 명시 timeout이
// 크든 작든 CLI `--timeout`을 무조건 이긴다** — 여기 값을 30000보다 낮게 주면 CI에서 오히려
// 마진이 줄어 #660이 없애려던 flakiness를 반대로 재도입한다. 그래서 CI 기준선(30000)보다
// 위인 35000ms로 잡는다. @1x는 실측 0.5~0.8초로 여유가 커서 기본값 그대로 둔다.
const PIXEL_RATIO_2X_TIMEOUT_MS = 35000;

describe('#512 — 6무드 × 2 pixelRatio, iOS(ctx.filter 미적용) 환경에서 포스터 픽셀이 프리뷰와 일치', () => {
  for (const layout of LAYOUTS) {
    for (const pixelRatio of [1, 2] as const) {
      test(`${layout.id} @${pixelRatio}x — 합성된 포스터 픽셀 = 색보정 적용된 프리뷰 등가값`, async () => {
        const node = buildFixture(layout.id, layout.width, layout.height);

        await captureNodeToJpeg(node, { filename: 't.jpg', width: layout.width, height: layout.height, pixelRatio });

        expect(mainCtx).not.toBeNull();
        const sx = Math.round((MARGIN + layout.width / 2) * pixelRatio);
        const sy = Math.round((MARGIN + layout.height / 2) * pixelRatio);
        const pixel = mainCtx!.getImageData(sx, sy, 1, 1).data;
        const [r, g, b, a] = [pixel[0], pixel[1], pixel[2], pixel[3]];
        const [er, eg, eb] = applyCssColorFilterToPixel(POSTER_FILTER, ...POSTER_RGB);

        // 회귀 시나리오 두 가지를 이 한 픽셀이 동시에 잡는다: (1) #490 되돌리면 backdrop 원색(예:
        // PAPER 244,237,224)이 나오고, (2) #495 되돌리면(iOS에서 ctx.filter가 먹었다고 착각) 보정 안 된
        // 원색(180,60,40)이 나온다 — 둘 다 기대값(er,eg,eb)과 확실히 어긋난다.
        expect(a).toBeGreaterThan(0);
        closeEnough(r, er);
        closeEnough(g, eg);
        closeEnough(b, eb);

        node.remove();
      }, pixelRatio === 2 ? PIXEL_RATIO_2X_TIMEOUT_MS : undefined);
    }
  }
});

describe('#512 — safeOverlay 실패 경로: 오버레이가 throw해도 clip이 새지 않는다', () => {
  test('coating 오버레이 fillRect가 clip 이후 throw해도 캡처는 성공하고, 포스터 밖 base 영역도 정상 렌더된다', async () => {
    forcedBaseColor = [50, 90, 160, 255]; // 포스터·backdrop과 확실히 구분되는 base 색.
    forcedBaseHoleUMax = 613 / 1534; // data-poster-root 제외로 생기는 구멍(#439) — posterW/width.

    const width = 1534;
    const height = 960;
    const posterW = 613; // editorial 근사 — 포스터가 캔버스 왼쪽 일부만 차지(#490 회귀 테스트와 동일 근사).
    const node = document.createElement('div');
    stubRect(node, 0, 0, width, height);

    const posterRoot = document.createElement('div');
    posterRoot.setAttribute('data-poster-root', 'true');
    posterRoot.dataset.coating = 'hologram'; // gradient 레시피(soft-light) — save()가 await 없이 동기로 온다.
    posterRoot.dataset.coatingIntensity = '1';
    stubRect(posterRoot, 0, 0, posterW, height);

    const posterImg = document.createElement('img');
    posterImg.src = 'blob:poster';
    posterImg.dataset.role = 'poster';
    Object.defineProperty(posterImg, 'naturalWidth', { value: posterW, configurable: true });
    Object.defineProperty(posterImg, 'naturalHeight', { value: height, configurable: true });
    (posterImg as unknown as { decode: () => Promise<void> }).decode = () => Promise.resolve();
    posterImg.style.objectFit = 'cover';
    posterImg.style.filter = POSTER_FILTER;
    (posterImg as unknown as { __testColor: RGBA }).__testColor = [...POSTER_RGB, 255];
    stubRect(posterImg, 0, 0, posterW, height);
    posterRoot.appendChild(posterImg);
    node.appendChild(posterRoot);
    document.body.appendChild(node);

    THROW_ON_BLEND = true;
    const result = await captureNodeToJpeg(node, { filename: 't.jpg', width, height, pixelRatio: 1 });
    expect(result).toBe('data:image/jpeg;base64,OUT'); // 캡처가 안 죽었다 — 오버레이 실패가 전체를 무너뜨리지 않는다(#490/#495 후속).

    // 포스터 영역(오버레이 clip 박스 안쪽)은 여전히 정상 — 색보정이 살아있다.
    const posterSample = mainCtx!.getImageData(Math.round(MARGIN + posterW / 2), Math.round(MARGIN + height / 2), 1, 1).data;
    const [er, eg, eb] = applyCssColorFilterToPixel(POSTER_FILTER, ...POSTER_RGB);
    closeEnough(posterSample[0], er);
    closeEnough(posterSample[1], eg);
    closeEnough(posterSample[2], eb);

    // 포스터 박스 밖(오버레이 clip 밖, 여전히 티켓 내부) — clip이 안 풀렸다면(claude-review PR #513
    // 이전 상태) base가 여기까지 못 그려져 흰 여백(255,255,255)으로 남는다.
    const outsideX = Math.round(MARGIN + width - 50);
    const outsideSample = mainCtx!.getImageData(outsideX, Math.round(MARGIN + height / 2), 1, 1).data;
    closeEnough(outsideSample[0], 50);
    closeEnough(outsideSample[1], 90);
    closeEnough(outsideSample[2], 160);

    node.remove();
  });
});

// ─── #538 — iOS 색보정 베이킹 오프스크린이 클립을 넘지 않는다 ────────────────────────────────
// ctx.filter가 안 먹는 환경(이 스위트가 그 환경이다)에서 drawImageColorFiltered는 색보정을 픽셀로
// 구우려고 오프스크린 캔버스를 잡는다. 예전엔 그 크기가 **목적지 사각형 전체**라, fit='cover'로
// 슬롯 밖까지 넘치는 draw에선 어차피 클립에 잘려 버려질 픽셀까지 통째로 잡아 굽고 있었다.
// 여기서 고정하는 건 "오프스크린은 클립 교집합 이하" — 넘치는 몫이 베이킹 시간·피크 메모리다.
describe('#538 — 색보정 베이킹 오프스크린은 클립 교집합을 넘지 않는다', () => {
  test('cover로 목적지가 슬롯 밖까지 넘쳐도 오프스크린은 슬롯 크기에 머문다', async () => {
    const width = 1000;
    const height = 1000;
    const posterW = 400; // 포스터 슬롯 = 클립. 여기가 베이킹 상한이어야 한다.

    const node = document.createElement('div');
    stubRect(node, 0, 0, width, height);
    const posterRoot = document.createElement('div');
    posterRoot.setAttribute('data-poster-root', 'true');
    stubRect(posterRoot, 0, 0, posterW, height);

    const posterImg = document.createElement('img');
    posterImg.src = 'blob:poster';
    posterImg.dataset.role = 'poster';
    // 아주 납작한 원본(1000×400)을 세로 슬롯(400×1000)에 cover → draw 사각형 2500×1000.
    // 클립(400×1000)의 6.25배다. 수정 전 코드는 이 2500×1000을 통째로 오프스크린으로 잡았다.
    Object.defineProperty(posterImg, 'naturalWidth', { value: 1000, configurable: true });
    Object.defineProperty(posterImg, 'naturalHeight', { value: 400, configurable: true });
    (posterImg as unknown as { decode: () => Promise<void> }).decode = () => Promise.resolve();
    posterImg.style.objectFit = 'cover';
    posterImg.style.filter = POSTER_FILTER;
    (posterImg as unknown as { __testColor: RGBA }).__testColor = [...POSTER_RGB, 255];
    stubRect(posterImg, 0, 0, posterW, height);
    posterRoot.appendChild(posterImg);
    node.appendChild(posterRoot);
    document.body.appendChild(node);

    await captureNodeToJpeg(node, { filename: 't.jpg', width, height, pixelRatio: 1 });

    // 메인 캔버스(티켓 전체 + 여백)는 당연히 클립보다 크다 — 상한 대상은 그 외 오프스크린뿐.
    const offscreens = allocatedCanvases.filter((c) => c !== mainCtx && c.canvas.width > 1 && c.canvas.height > 1);
    expect(offscreens.length).toBeGreaterThan(0); // 베이킹 경로를 실제로 탔다는 확인
    const clipArea = posterW * height;
    for (const c of offscreens) {
      // +2px는 소수 좌표를 정수 픽셀로 감싸며 생기는 여유.
      expect(c.canvas.width).toBeLessThanOrEqual(posterW + 2);
      expect(c.canvas.width * c.canvas.height).toBeLessThanOrEqual(clipArea + 2 * (posterW + height));
    }

    // 색보정은 그대로 걸려 있어야 한다 — 오프스크린을 줄인 게 보정을 건너뛴 게 되면 안 된다.
    const sample = mainCtx!.getImageData(MARGIN + Math.round(posterW / 2), MARGIN + Math.round(height / 2), 1, 1).data;
    const [er, eg, eb] = applyCssColorFilterToPixel(POSTER_FILTER, ...POSTER_RGB);
    closeEnough(sample[0], er);
    closeEnough(sample[1], eg);
    closeEnough(sample[2], eb);

    node.remove();
  });
});
