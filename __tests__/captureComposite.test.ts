import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// #439: raster(포스터·로고)를 html-to-image의 foreignObject 경로에서 빼고 canvas 2D로 직접 합성한다.
// 여기선 (1) toPng에 넘기는 filter가 올바른 노드를 제외하는지, (2) 합성 순서·좌표·filter 스케일이
// 맞는지를 검증한다. mock.module은 hoisting 안 됨 — 등록 후 require로 SUT를 가져와야 가로채진다(CLAUDE.md).
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
interface DrawCall { arg: unknown; filter: string; dw?: number; dh?: number }
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

  const fakeCtx = {
    filter: 'none',
    fillStyle: '',
    save() {},
    restore() {},
    beginPath() {},
    clip() {},
    rect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h }); },
    fillRect(x: number, y: number, w: number, h: number) { fillRects.push({ x, y, w, h }); },
    drawImage(this: { filter: string }, arg: unknown, _dx?: number, _dy?: number, dw?: number, dh?: number) { draws.push({ arg, filter: this.filter, dw, dh }); },
  };

  originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = ((kind: string) =>
    kind === '2d' ? fakeCtx : null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
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

/** getBoundingClientRect을 고정값으로 스텁한다(happy-dom은 항상 0을 반환). */
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
    node.appendChild(makeImg({ role: 'poster', w: 1800, h: 2700, style: { objectFit: 'cover' } }));
    document.body.appendChild(node);
    stubRect(node.querySelector('img')!, 0, 0, 480, 738.5);

    await captureNodeToJpeg(node, OPTS);

    expect(typeof pngFilter).toBe('function');
    // base PNG는 투명 배경이어야 포스터/로고 자리가 구멍으로 남는다.
    expect(pngBackground).toBeUndefined();

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

describe('#439 — z-order 합성: 포스터(뒤) → base → 로고(앞), 좌표·blur 스케일', () => {
  test('포스터를 base보다 먼저, 로고를 base보다 나중에 그리고, filter의 px는 pixelRatio로 스케일한다', async () => {
    const node = document.createElement('div');
    // 노드에 프리뷰 배율(0.5)이 걸린 상태를 흉내 — 분율 환산으로 배율이 상쇄돼야 한다.
    stubRect(node, 0, 0, 480, 738.5);

    // 배경 블러 포스터: cover, transform scale(1.2), blur(28px) → device px에서 blur(56px).
    const posterBg = makeImg({ role: 'poster', w: 1800, h: 2700, style: { objectFit: 'cover', transform: 'scale(1.2)', filter: 'brightness(0.5) blur(28px)' } });
    // 로고 스탬프: contain, 노드 좌상단 아님(분율 매핑 검증).
    const stamp = makeImg({ src: 'blob:logo', w: 975, h: 184, style: { objectFit: 'contain' } });

    node.appendChild(posterBg);
    node.appendChild(stamp);
    document.body.appendChild(node);
    stubRect(posterBg, 0, 0, 480, 738.5); // 풀블리드 → 분율 (0,0,1,1)
    stubRect(stamp, 50, 130, 100, 26);

    const result = await captureNodeToJpeg(node, OPTS);

    expect(result).toBe('data:image/jpeg;base64,OUT');

    // 흰 배경 채움: canvasWidth=(960+20)*2=1960, canvasHeight=(1477+20)*2=2994.
    expect(fillRects).toEqual([{ x: 0, y: 0, w: 1960, h: 2994 }]);

    // 그린 순서: 포스터 <img> → base(FakeImage) → 로고 <img>.
    expect(draws.length).toBe(3);
    expect(draws[0].arg).toBe(posterBg);
    expect(draws[1].arg).toBeInstanceOf(FakeImage);
    expect(draws[2].arg).toBe(stamp);

    // 포스터 clip 박스 = (여백10 + 0)*2, 풀블리드 → 1920×2954. blur는 28→56px로 스케일.
    expect(rects[0]).toEqual({ x: 20, y: 20, w: 1920, h: 2954 });
    expect(draws[0].filter).toBe('brightness(0.5) blur(56px)');
    // 그린 크기 = 렌더 박스(1920×2954)에 cover, transform scale(1.2)는 getBoundingClientRect에 이미
    // 반영된 값으로 취급하므로 '또' 곱하지 않는다(이중 적용 방지, claude-review PR #458 P1). 옛 코드는
    // 여기에 ×1.2가 더 붙어 이 단언이 깨진다.
    const cover = Math.max(1920 / 1800, 2954 / 2700);
    expect(draws[0].dw).toBeCloseTo(1800 * cover, 2);
    expect(draws[0].dh).toBeCloseTo(2700 * cover, 2);

    // 로고 박스: fx=50/480, fy=130/738.5 → (10 + fx*960)*2, (10 + fy*1477)*2. 배율 상쇄 확인.
    expect(rects[1].x).toBeCloseTo((10 + (50 / 480) * 960) * 2, 5);
    expect(rects[1].y).toBeCloseTo((10 + (130 / 738.5) * 1477) * 2, 5);
    expect(draws[2].filter).toBe('none'); // filter 없는 로고

    node.remove();
  });

  test('포스터가 없고 로고만 있어도(로고 단독) base 위에 합성된다', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477);
    const stamp = makeImg({ src: 'blob:logo', w: 200, h: 80, style: { objectFit: 'contain' } });
    node.appendChild(stamp);
    document.body.appendChild(node);
    stubRect(stamp, 60, 52, 120, 48);

    await captureNodeToJpeg(node, OPTS);

    expect(draws.length).toBe(2);
    expect(draws[0].arg).toBeInstanceOf(FakeImage); // base 먼저
    expect(draws[1].arg).toBe(stamp); // 로고 나중(앞)

    node.remove();
  });
});
