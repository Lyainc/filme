import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// #490/#495 후속 — "공유 발급본(pixelRatio 1)에서 포스터가 통째로 안 나온다" 재현 시도.
// 다운로드(pixelRatio 2·세로 minimal)는 정상인데 공유 발급(pixelRatio 1·가로 editorial)만
// 포스터가 빠진다는 실기기 보고. compositeRaster는 raster 박스 ∩ 티켓 영역으로 클립하는데,
// 그 교집합 폭/높이가 0 이하면 아무것도 안 그려진다 — 가로 레이아웃·pixelRatio 1에서
// 그 경계가 깨지는지 mock 캔버스로 확인한다(captureComposite.test.ts와 같은 하네스).
mock.module('html-to-image', () => ({
  toPng: () => Promise.resolve('data:image/png;base64,BASE'),
}));

const { captureNodeToJpeg } = require('../src/utils/captureToImage');

interface DrawCall { arg: unknown; dw?: number; dh?: number; isCanvas: boolean }
interface RectCall { x: number; y: number; w: number; h: number }
let draws: DrawCall[];
let rects: RectCall[];
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
let originalToDataURL: typeof HTMLCanvasElement.prototype.toDataURL;
let originalImage: typeof Image;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode() { return Promise.resolve(); }
  set src(_v: string) { queueMicrotask(() => this.onload?.()); }
}

beforeEach(() => {
  draws = [];
  rects = [];
  const makeCtx = () => ({
    filter: 'none',
    fillStyle: '' as unknown,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, clip() {},
    rect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h }); },
    fillRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createPattern() { return {}; },
    drawImage(arg: unknown, _dx?: number, _dy?: number, dw?: number, dh?: number) {
      draws.push({ arg, dw, dh, isCanvas: arg instanceof HTMLCanvasElement });
    },
  });
  originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = ((kind: string) =>
    kind === '2d' ? makeCtx() : null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
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

function stubRect(el: Element, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = (() => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} })) as Element['getBoundingClientRect'];
}

function makeImg(opts: { role?: string; w: number; h: number; style?: Partial<CSSStyleDeclaration> }): HTMLImageElement {
  const img = document.createElement('img');
  img.src = 'blob:x';
  if (opts.role) img.dataset.role = opts.role;
  Object.defineProperty(img, 'naturalWidth', { value: opts.w, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: opts.h, configurable: true });
  (img as unknown as { decode: () => Promise<void> }).decode = () => Promise.resolve();
  Object.assign(img.style, opts.style ?? {});
  return img;
}

// Editorial = 가로 1534×960. 포스터는 root가 아니라 왼쪽 컬럼에 들어간다(MoodEditorial 구조).
const EDITORIAL = { filename: 't.jpg', width: 1534, height: 960 };

describe('#490/#495 — 가로 무드(editorial) + 공유 발급 pixelRatio 1에서도 포스터가 그려진다', () => {
  for (const pixelRatio of [1, 2]) {
    test(`pixelRatio ${pixelRatio}: 포스터가 실제로 draw되고 클립 폭·높이가 양수다`, async () => {
      const node = document.createElement('div');
      stubRect(node, 0, 0, 1534, 960);
      // 왼쪽 컬럼(폭 40%)에 세로 포스터를 contain으로.
      const poster = makeImg({ role: 'poster', w: 2003, h: 3000, style: { objectFit: 'contain', filter: 'saturate(0.92) contrast(1.05) brightness(0.5)' } });
      node.appendChild(poster);
      document.body.appendChild(node);
      stubRect(poster, 0, 0, 613, 960); // 가로 티켓 왼쪽 컬럼

      await captureNodeToJpeg(node, { ...EDITORIAL, pixelRatio });

      // 포스터가 어떤 형태로든(직접 또는 페더 tmp 경유) 그려졌어야 한다.
      expect(draws.length).toBeGreaterThan(1); // 최소 포스터 + base
      const posterDrawn = draws.some((d) => d.arg === poster || d.isCanvas);
      expect(posterDrawn).toBe(true);

      // 클립 사각형이 비어 있으면(폭/높이 ≤ 0) 아무것도 안 그려진다 — 포스터 실종의 직접 원인.
      const posterClip = rects[0];
      expect(posterClip).toBeDefined();
      expect(posterClip.w).toBeGreaterThan(0);
      expect(posterClip.h).toBeGreaterThan(0);

      node.remove();
    });
  }

  test('세로 무드(minimal)와 가로 무드가 같은 pixelRatio 1에서 모두 포스터를 그린다', async () => {
    for (const [w, h, pw, ph] of [[960, 1477, 960, 1477], [1534, 960, 613, 960]] as const) {
      draws = []; rects = [];
      const node = document.createElement('div');
      stubRect(node, 0, 0, w, h);
      const poster = makeImg({ role: 'poster', w: 2003, h: 3000, style: { objectFit: 'contain', filter: 'brightness(0.5)' } });
      node.appendChild(poster);
      document.body.appendChild(node);
      stubRect(poster, 0, 0, pw, ph);

      await captureNodeToJpeg(node, { filename: 't.jpg', width: w, height: h, pixelRatio: 1 });

      expect(rects[0].w).toBeGreaterThan(0);
      expect(rects[0].h).toBeGreaterThan(0);
      expect(draws.length).toBeGreaterThan(1);
      node.remove();
    }
  });
});
