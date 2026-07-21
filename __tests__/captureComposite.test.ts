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
let gcos: string[]; // globalCompositeOperation 설정 이력(#459 페더 destination-in 검증)
let gAlphas: number[]; // globalAlpha 설정 이력(#471 noise 유효 opacity = alpha×intensity 검증)
let gradStops: { o: number; c: string }[]; // createLinearGradient addColorStop 이력
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
  gcos = [];
  gAlphas = [];
  gradStops = [];
  pngFilter = undefined;
  pngBackground = 'unset';

  // getContext는 canvas마다 새 기록 컨텍스트를 준다(메인 캔버스 vs 블러/페더용 tmp 캔버스 구분). 모두
  // 공유 배열에 push해 순서를 그대로 검증한다. globalCompositeOperation·createLinearGradient는 #459
  // 페더 경로(destination-in 알파 마스크) 검증용으로 기록한다.
  const makeCtx = () => {
    const c = {
      filter: 'none',
      fillStyle: '' as unknown,
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      _gco: 'source-over',
      get globalCompositeOperation() { return this._gco; },
      set globalCompositeOperation(v: string) { this._gco = v; gcos.push(v); },
      _ga: 1,
      get globalAlpha() { return this._ga; },
      set globalAlpha(v: number) { this._ga = v; gAlphas.push(v); },
      save() {},
      restore() {},
      beginPath() {},
      clip() {},
      rect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h }); },
      fillRect(x: number, y: number, w: number, h: number) { fillRects.push({ x, y, w, h }); },
      createLinearGradient() {
        return { addColorStop(o: number, col: string) { gradStops.push({ o, c: col }); } };
      },
      // #471 물리재질 종이결 — noise 타일을 pattern으로 반복. 스텁은 존재만 보장(값은 안 봄).
      createPattern() { return {}; },
      drawImage(this: { filter: string }, arg: unknown, _dx?: number, _dy?: number, dw?: number, dh?: number) {
        draws.push({ arg, filter: this.filter, dw, dh, isCanvas: arg instanceof HTMLCanvasElement });
      },
    };
    return c;
  };

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

describe('#439/#459 — z-order + contain 포스터는 좌우가 안 잘리고, 상하 레터박스 씸은 페더된다', () => {
  test('포스터(contain 레터박스)를 페더용 tmp 캔버스로 그려 base보다 먼저·로고를 나중에, 폭은 꽉 채운다(좌우 무손실)', async () => {
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
    expect(fillRects.some((r) => r.x === 0 && r.y === 0 && r.w === 1960 && r.h === 2994)).toBe(true);

    // #459 페더: 상하 레터박스 씸이 있으므로 포스터는 tmp 캔버스로 우회 그린다.
    // 순서: (1) 원본 img→tmp 축소, (2) tmp(canvas)→메인, (3) base(FakeImage), (4) 로고.
    expect(draws.length).toBe(4);
    expect(draws[0].arg).toBe(fg); // 원본 <img>를 tmp에 그림
    expect(draws[0].isCanvas).toBe(false);
    expect(draws[1].isCanvas).toBe(true); // 페더된 tmp를 메인에 얹음
    expect(draws[2].arg).toBeInstanceOf(FakeImage); // base(CSS 레이어)
    expect(draws[3].arg).toBe(stamp); // 로고는 페더 안 함(role !== poster)

    // 페더 알파 마스크가 실제로 적용됐다: destination-in + 가장자리 투명 그라데이션(하드 컷 아님).
    expect(gcos).toContain('destination-in');
    expect(gradStops[0]).toEqual({ o: 0, c: 'rgba(0,0,0,0)' }); // 가장자리 투명
    expect(gradStops[gradStops.length - 1]).toEqual({ o: 1, c: 'rgba(0,0,0,0)' });
    expect(gradStops.some((s) => s.c === '#000' && s.o > 0 && s.o < 1)).toBe(true); // 중앙 불투명

    // 핵심 회귀(#439): 페더 후에도 메인 draw 폭 = 박스 폭(1920) → 좌우 무손실. 세로는 레터박스로 더 작다.
    const boxW = 1920; // (960)*2, 여백 안쪽 폭
    expect(draws[1].dw).toBeCloseTo(boxW, 0);
    expect(draws[1].dh!).toBeLessThan(2954); // 박스 높이(1477*2)보다 작음 = 위아래 레터박스
    // 포스터 clip 박스: (여백10)*2=20 시작, 티켓 내용 영역 1920×2954.
    expect(rects[0]).toEqual({ x: 20, y: 20, w: 1920, h: 2954 });

    node.remove();
  });

  test('레터박스가 없는 contain 포스터(종횡비 일치)는 페더 없이 한 번에 그린다(무손실 가장자리 보존)', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477);
    // 슬롯과 종횡비가 사실상 같은 포스터(1300x2000=0.65 ≈ 1920/2954) → 레터박스 ~0 → 페더 없음.
    const fg = makeImg({ role: 'poster', w: 1300, h: 2000, style: { objectFit: 'contain', filter: 'brightness(0.5)' } });
    node.appendChild(fg);
    document.body.appendChild(node);
    stubRect(fg, 0, 0, 960, 1477);

    await captureNodeToJpeg(node, OPTS);

    // 포스터 1 draw + base 1 draw. tmp 캔버스·destination-in 없음.
    expect(draws.length).toBe(2);
    expect(draws[0].arg).toBe(fg);
    expect(draws[0].isCanvas).toBe(false);
    expect(draws[0].filter).toBe('brightness(0.5)');
    expect(gcos).not.toContain('destination-in');

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

  test('#459 — blur 없는 contain 포스터라도 레터박스가 있으면 페더 tmp로 그리되, 색보정은 tmp에 적용·메인엔 filter 없이 얹는다', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477);
    const fg = makeImg({ role: 'poster', w: 1800, h: 2580, style: { objectFit: 'contain', filter: 'brightness(0.5)' } });
    node.appendChild(fg);
    document.body.appendChild(node);
    stubRect(fg, 0, 0, 960, 1477); // 0.698 포스터 → 상하 레터박스 → 페더

    await captureNodeToJpeg(node, OPTS);

    // 페더 tmp 경로: (1) 원본 img→tmp(색보정 적용), (2) tmp→메인(filter none), (3) base.
    expect(draws.length).toBe(3);
    expect(draws[0].arg).toBe(fg);
    expect(draws[0].isCanvas).toBe(false);
    expect(draws[0].filter).toBe('brightness(0.5)'); // 색보정은 tmp에 그릴 때 적용(px 단위 없어 스케일 무변)
    expect(draws[1].isCanvas).toBe(true);
    expect(draws[1].filter).toBe('none'); // 페더된 tmp는 filter 없이 얹는다
    expect(gcos).toContain('destination-in');

    node.remove();
  });
});

describe('#434/#475 — 후가공 sheen 오버레이(compositeOverlay)를 포스터 위에 canvas blend로 합성한다', () => {
  test('data-coating/data-coating-intensity를 실은 poster-root는 그 레시피 blend·intensity 스케일로 오버레이 fillRect를 호출한다', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477); // scale 1
    const posterRoot = document.createElement('div');
    posterRoot.setAttribute('data-poster-root', 'true');
    posterRoot.dataset.coating = 'hologram'; // soft-light
    posterRoot.dataset.coatingIntensity = '0.5';
    // cover 포스터 = 레터박스 없음 → 페더 gradStops가 안 섞여 오버레이 stop만 남는다.
    const fg = makeImg({ role: 'poster', w: 1300, h: 2000, style: { objectFit: 'cover' } });
    posterRoot.appendChild(fg);
    node.appendChild(posterRoot);
    document.body.appendChild(node);
    stubRect(posterRoot, 0, 0, 960, 1477); // 오버레이 영역 = 포스터 슬롯 = 노드 전체
    stubRect(fg, 0, 0, 960, 1477);

    await captureNodeToJpeg(node, OPTS);

    // hologram blend(soft-light)로 globalCompositeOperation을 설정해 포스터 위에 blend.
    expect(gcos).toContain('soft-light');
    // intensity(0.5) × hologram 첫 stop alpha(0.5) = 0.25가 canvas gradient stop에 반영된다.
    const holoStop = gradStops.find((s) => s.c.startsWith('rgba(255, 150, 180'));
    expect(holoStop).toBeDefined();
    expect(holoStop!.c).toContain('0.25');
    // 오버레이 fillRect가 poster-root 박스(여백20 시작, 티켓 내용 1920×2954)에 그려진다 — clip도 동일.
    expect(fillRects.some((r) => r.x === 20 && r.y === 20 && r.w === 1920 && r.h === 2954)).toBe(true);

    node.remove();
  });

  test('data-material/data-coating가 둘 다 없으면(원본+코팅없음 조합) 오버레이를 그리지 않는다', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477);
    const posterRoot = document.createElement('div');
    posterRoot.setAttribute('data-poster-root', 'true');
    // data-material/data-coating 미설정 — compositeOverlay가 두 축 다 스킵해야 한다.
    const fg = makeImg({ role: 'poster', w: 1300, h: 2000, style: { objectFit: 'cover' } });
    posterRoot.appendChild(fg);
    node.appendChild(posterRoot);
    document.body.appendChild(node);
    stubRect(posterRoot, 0, 0, 960, 1477);
    stubRect(fg, 0, 0, 960, 1477);

    await captureNodeToJpeg(node, OPTS);

    // cover라 페더도 없어 blend 오버레이/그라데이션이 전혀 안 생긴다.
    expect(gcos).not.toContain('soft-light');
    expect(gradStops.length).toBe(0);

    node.remove();
  });

  test('#475 c2/c3 — material·coating이 둘 다 실리면 재질→코팅 순으로 2회 합성한다(z-order: 코팅이 재질 위)', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477);
    const posterRoot = document.createElement('div');
    posterRoot.setAttribute('data-poster-root', 'true');
    posterRoot.dataset.material = 'vintage'; // noise, blend=soft-light
    posterRoot.dataset.materialIntensity = '1';
    posterRoot.dataset.coating = 'metal'; // gradient, blend=soft-light(같은 blend라 gcos 카운트로 순서 구분 못 함 → fillRect 횟수로 검증)
    posterRoot.dataset.coatingIntensity = '1';
    const fg = makeImg({ role: 'poster', w: 1300, h: 2000, style: { objectFit: 'cover' } });
    posterRoot.appendChild(fg);
    node.appendChild(posterRoot);
    document.body.appendChild(node);
    stubRect(posterRoot, 0, 0, 960, 1477);
    stubRect(fg, 0, 0, 960, 1477);

    await captureNodeToJpeg(node, OPTS);

    // 재질(noise pattern) 1회 + 코팅(gradient) 1회 = 오버레이 fillRect 2회, 둘 다 같은 poster-root 박스.
    const overlayFills = fillRects.filter((r) => r.x === 20 && r.y === 20 && r.w === 1920 && r.h === 2954);
    expect(overlayFills.length).toBe(2);
    // 코팅(metal, gradient)만 createLinearGradient를 쓴다 — 재질(vintage, noise)은 안 쓴다.
    expect(gradStops.length).toBeGreaterThan(0);
    // globalAlpha 이력에 재질(vintage alpha 0.55 × intensity 1)이 기록돼 재질 패스가 실제로 그려졌음을 확인.
    expect(gAlphas).toContain(0.55);

    node.remove();
  });
});

describe('#471/#475 — 물리재질 종이결(noise)을 SVG-raster pattern으로 저장물에 반영한다', () => {
  test('data-material=artpaper poster-root는 noise 레시피 blend로 poster 박스에 pattern fillRect를 그린다', async () => {
    const node = document.createElement('div');
    stubRect(node, 0, 0, 960, 1477); // scale 1
    const posterRoot = document.createElement('div');
    posterRoot.setAttribute('data-poster-root', 'true');
    posterRoot.dataset.material = 'artpaper'; // noise, blend=overlay
    posterRoot.dataset.materialIntensity = '0.5';
    const fg = makeImg({ role: 'poster', w: 1300, h: 2000, style: { objectFit: 'cover' } });
    posterRoot.appendChild(fg);
    node.appendChild(posterRoot);
    document.body.appendChild(node);
    stubRect(posterRoot, 0, 0, 960, 1477);
    stubRect(fg, 0, 0, 960, 1477);

    await captureNodeToJpeg(node, OPTS);

    // noise 레시피 blend(artpaper=overlay)로 globalCompositeOperation을 설정한다.
    expect(gcos).toContain('overlay');
    // 유효 opacity = alpha(artpaper 0.65, #475 강화) × intensity(0.5) = 0.325를 globalAlpha에 실어야 한다.
    // recipe.alpha나 intensity 중 하나를 빠뜨리는 회귀를 잡는다(#434 hologram 대칭 검증, claude-review PR #473 P1).
    expect(gAlphas).toContain(0.325);
    // noise는 createLinearGradient를 쓰지 않는다(gradient 계열과 구분되는 경로).
    expect(gradStops.length).toBe(0);
    // 오버레이 fillRect가 poster-root 박스(여백20 시작, 티켓 내용 1920×2954)에 그려진다.
    expect(fillRects.some((r) => r.x === 20 && r.y === 20 && r.w === 1920 && r.h === 2954)).toBe(true);

    node.remove();
  });
});
