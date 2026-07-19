import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// #439: raster(포스터·로고)를 html-to-image의 foreignObject 경로에서 빼고 canvas 2D로 직접 합성한다.
// 여기선 (1) toPng에 넘기는 filter가 올바른 노드를 제외하는지, (2) 합성 순서·좌표·좌우 안 잘림,
// (3) 블러 배경이 ctx.filter 대신 다운스케일→업스케일로 처리되는지를 검증한다. mock.module은
// hoisting 안 됨 — 등록 후 require로 SUT를 가져와야 가로채진다(CLAUDE.md).
let pngFilter: ((n: unknown) => boolean) | undefined;
let pngBackground: unknown;
mock.module('html-to-image', () => ({
  toPng: (_node: unknown, opts: { filter?: (n: unknown) => boolean; backgroundColor?: unknown }) => {
    pngFilter = opts.filter;
    pngBackground = opts.backgroundColor;
    return Promise.resolve('data:image/png;base64,BASE');
  },
}));

const { captureNodeToJpeg } = require('../src/utils/captureToImage');

const OPTS = { filename: 't.jpg', width: 960, height: 1477 };

// happy-dom은 canvas 2D를 지원 안 해(getContext('2d') → null) 합성이 즉시 throw한다. 실제 합성
// 경로를 검증하려면 getContext·toDataURL을 스텁하고, 합성 base PNG 로드용 Image도 즉시 onload로 만든다.
interface DrawCall { arg: unknown; filter: string; dw?: number; dh?: number; isCanvas: boolean }
interface RectCall { x: number; y: number; w: number; h: number }
let draws: DrawCall[];
let rects: RectCall[];
let fillRects: RectCall[];
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
  fillRects = [];
  pngFilter = undefined;
  pngBackground = 'unset';

  // getContext는 canvas마다 새 기록 컨텍스트를 준다(메인 캔버스 vs 블러용 tmp 캔버스 구분). 모두 공유
  // 배열에 push해 순서를 그대로 검증한다.
  const makeCtx = () => ({
    filter: 'none',
    fillStyle: '',
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    save() {},
    restore() {},
    beginPath() {},
    clip() {},
    rect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h }); },
    fillRect(x: number, y: number, w: number, h: number) { fillRects.push({ x, y, w, h }); },
    drawImage(this: { filter: string }, arg: unknown, _dx?: number, _dy?: number, dw?: number, dh?: number) {
      draws.push({ arg, filter: this.filter, dw, dh, isCanvas: arg instanceof HTMLCanvasElement });
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

function makeImg(opts: { role?: string; src?: string; w: number; h: number; style?: Partial<CSSStyleDeclaration> }): HTMLImageElement {
  const img = document.createElement('img');
  img.src = opts.src ?? 'blob:x';
  if (opts.role) img.dataset.role = opts.role;
  Object.defineProperty(img, 'naturalWidth', { value: opts.w, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: opts.h, configurable: true });
  (img as unknown as { decode: () => Promise<void> }).decode = () => Promise.resolve();
  Object.assign(img.style, opts.style ?? {});
  return img;
}

describe('#439 — toPng filter는 포스터 서브트리·로고·placeholder를 제외한다', () => {
  test('data-poster-root·blob 로고 <img>·data-hide-on-export는 false, 나머지는 true', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 480, 738.5);
    const poster = makeImg({ role: 'poster', w: 1800, h: 2700, style: { objectFit: 'cover' } });
    node.appendChild(poster);
    document.body.appendChild(node);
    stubRect(poster, 0, 0, 480, 738.5);

    await captureNodeToJpeg(node, OPTS);

    expect(typeof pngFilter).toBe('function');
    expect(pngBackground).toBeUndefined(); // 투명 base라야 포스터/로고 자리가 구멍으로 남는다

    const posterRoot = document.createElement('div');
    posterRoot.setAttribute('data-poster-root', 'true');
    const hideEl = document.createElement('div');
    hideEl.setAttribute('data-hide-on-export', 'true');
    const stamp = makeImg({ src: 'blob:logo', w: 100, h: 40 });
    const normal = document.createElement('div');

    expect(pngFilter!(posterRoot)).toBe(false);
    expect(pngFilter!(hideEl)).toBe(false);
    expect(pngFilter!(stamp)).toBe(false);
    expect(pngFilter!(normal)).toBe(true);

    node.remove();
  });
});

describe('#439 — z-order + contain 포스터는 좌우가 안 잘린다', () => {
  test('포스터(contain)를 base보다 먼저, 로고를 나중에 그리고, contain은 박스 폭을 꽉 채운다(좌우 무손실)', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477); // scale 1 (자연 크기)

    // 세로로 긴 포스터(1800x2580=0.698)를 세로 티켓(0.65) 슬롯 전체에 contain — 폭에 맞고 위아래 레터박스.
    const fg = makeImg({ role: 'poster', w: 1800, h: 2580, style: { objectFit: 'contain', filter: 'brightness(0.5)' } });
    const stamp = makeImg({ src: 'blob:logo', w: 975, h: 184, style: { objectFit: 'contain' } });
    node.appendChild(fg);
    node.appendChild(stamp);
    document.body.appendChild(node);
    stubRect(fg, 0, 0, 960, 1477); // 포스터 슬롯 = 노드 전체
    stubRect(stamp, 50, 130, 100, 26);

    const result = await captureNodeToJpeg(node, OPTS);
    expect(result).toBe('data:image/jpeg;base64,OUT');

    // 흰 배경 채움 = export 여백. canvasW=(960+20)*2=1960, canvasH=(1477+20)*2=2994.
    expect(fillRects).toEqual([{ x: 0, y: 0, w: 1960, h: 2994 }]);

    // blur 없는 포스터라 단순 경로(1 draw). 순서: 포스터 → base(FakeImage) → 로고.
    expect(draws.length).toBe(3);
    expect(draws[0].arg).toBe(fg);
    expect(draws[1].arg).toBeInstanceOf(FakeImage);
    expect(draws[2].arg).toBe(stamp);

    // 핵심 회귀: contain 포스터의 draw 폭 = 박스 폭(1920) → 좌우 무손실. 세로는 레터박스로 더 작다.
    const boxW = 1920; // (960)*2, 여백 안쪽 폭
    expect(draws[0].dw).toBeCloseTo(boxW, 0);
    expect(draws[0].dh!).toBeLessThan(2954); // 박스 높이(1477*2)보다 작음 = 위아래 레터박스
    // 포스터 clip 박스: (여백10)*2=20 시작, 티켓 내용 영역 1920×2954.
    expect(rects[0]).toEqual({ x: 20, y: 20, w: 1920, h: 2954 });

    node.remove();
  });
});

describe('#439 — 블러 배경은 ctx.filter blur 대신 다운스케일→업스케일로 합성한다', () => {
  test('blur 필터가 있으면 tmp 캔버스로 축소 후 확대해 그리고, 메인 draw filter엔 blur가 없다', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477);
    // 블러 레터박스 배경(data-poster-bg): cover + scale(1.2) + blur(28px) + 색보정.
    const bg = makeImg({ role: 'poster', w: 1800, h: 2580, style: { objectFit: 'cover', transform: 'scale(1.2)', filter: 'saturate(0.92) brightness(0.5) blur(28px)' } });
    node.appendChild(bg);
    document.body.appendChild(node);
    stubRect(bg, -96, -147, 1152, 1772); // scale(1.2) 반영된 렌더 박스(음수 오프셋)

    await captureNodeToJpeg(node, OPTS);

    // blur 경로: (1) img→tmp 축소 draw, (2) tmp(canvas)→메인 확대 draw, (3) base(FakeImage).
    expect(draws.length).toBe(3);
    // 첫 draw는 원본 <img>를 작은 tmp로 축소, 둘째는 그 캔버스를 확대.
    expect(draws[0].arg).toBe(bg);
    expect(draws[1].isCanvas).toBe(true);
    // 확대 draw의 filter엔 blur가 없다(색보정만 유지). blur는 다운스케일이 만든다.
    expect(draws[1].filter).not.toContain('blur');
    expect(draws[1].filter).toContain('brightness');
    // tmp 축소 draw는 원본보다 훨씬 작아야 한다(블러용).
    expect(draws[0].dw!).toBeLessThan(500);

    node.remove();
  });

  test('blur 없는 포스터는 tmp 캔버스 없이 한 번에 그리고 filter를 그대로 스케일한다', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477);
    const fg = makeImg({ role: 'poster', w: 1800, h: 2580, style: { objectFit: 'contain', filter: 'brightness(0.5)' } });
    node.appendChild(fg);
    document.body.appendChild(node);
    stubRect(fg, 0, 0, 960, 1477);

    await captureNodeToJpeg(node, OPTS);

    // 포스터 1 draw + base 1 draw. tmp 캔버스 draw 없음.
    expect(draws.length).toBe(2);
    expect(draws[0].arg).toBe(fg);
    expect(draws[0].isCanvas).toBe(false);
    expect(draws[0].filter).toBe('brightness(0.5)');

    node.remove();
  });
});
