import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// #768 — iOS Safari 저장물에서 티켓 스탬프(BackgroundPatternLayer, [data-bg-pattern])가 빠지던 회귀.
// html-to-image는 그 CSS background-image를 data: URL로 인라인해 foreignObject에 넣는데 iOS가 그
// raster를 조용히 떨어뜨린다(#439와 같은 함정). 그래서 스탬프는 toPng에서 빠지고 캔버스에 직접
// 합성돼야 한다: 종이(불투명 조상 배경) → 스탬프 → base 순서, cover/center, opacity 반영.

let filterSeen: ((n: unknown) => boolean) | null = null;
let columnBgDuringToPng: string | null = null;
let columnEl: HTMLElement | null = null;
// 스프레드 스냅샷 + afterAll 복원(#611, captureOpaqueBackdrop과 같은 사유).
const realHtmlToImage = { ...require('html-to-image') };
mock.module('html-to-image', () => ({
  toPng: (_node: unknown, opts: { filter: (n: unknown) => boolean }) => {
    filterSeen = opts.filter;
    columnBgDuringToPng = columnEl ? columnEl.style.backgroundColor : null;
    return Promise.resolve('data:image/png;base64,BASE');
  },
}));

const { captureNodeToJpeg, resetCtxFilterProbeForTest } = require('../src/utils/captureToImage');

const STAMP_SRC = 'data:image/jpeg;base64,STAMP';
type Op =
  | { kind: 'fill'; style: string }
  | { kind: 'draw'; src: string; alpha: number; x: number; y: number; w: number; h: number }
  | { kind: 'clip'; x: number; y: number; w: number; h: number };
let ops: Op[];
// foreignObject 능력 검사(probe)가 읽는 픽셀 알파. 0이면 iOS처럼 "안 그림" → 직접 합성 경로.
let probeAlpha: number | null = null;
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
let originalToDataURL: typeof HTMLCanvasElement.prototype.toDataURL;
let originalImage: typeof Image;

// 스탬프 원본 400×200(2:1) — 300×42 박스에 cover로 들어가면 폭 기준(배율 0.75)으로 300×150.
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 400;
  naturalHeight = 200;
  _src = '';
  decode() { return Promise.resolve(); }
  set src(v: string) { this._src = v; queueMicrotask(() => this.onload?.()); }
  get src() { return this._src; }
}

beforeEach(() => {
  ops = [];
  filterSeen = null;
  columnBgDuringToPng = null;
  probeAlpha = null;
  resetCtxFilterProbeForTest();
  const makeCtx = () => {
    let pendingRect: { x: number; y: number; w: number; h: number } | null = null;
    return {
      filter: 'none',
      fillStyle: '' as unknown,
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      globalCompositeOperation: 'source-over',
      globalAlpha: 1,
      save() {}, restore(this: { globalAlpha: number }) { this.globalAlpha = 1; }, beginPath() {},
      rect(x: number, y: number, w: number, h: number) { pendingRect = { x, y, w, h }; },
      clip() { if (pendingRect) ops.push({ kind: 'clip', ...pendingRect }); },
      fillRect(this: { fillStyle: unknown }) { ops.push({ kind: 'fill', style: String(this.fillStyle) }); },
      createLinearGradient() { return { addColorStop() {} }; },
      createPattern() { return {}; },
      // probeAlpha가 null이면 getImageData가 없는 ctx — 능력 검사 판정 불가 → 직접 합성으로 폴백.
      ...(probeAlpha === null ? {} : { getImageData: () => ({ data: [0, 0, 0, probeAlpha] }) }),
      drawImage(this: { globalAlpha: number }, img: { src?: string }, x: number, y: number, w: number, h: number) {
        ops.push({ kind: 'draw', src: String(img.src ?? ''), alpha: this.globalAlpha, x, y, w, h });
      },
    };
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
  columnEl = null;
});

afterAll(() => {
  mock.module('html-to-image', () => realHtmlToImage);
  resetCtxFilterProbeForTest();
});

function stubRect(el: Element, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = (() => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} })) as Element['getBoundingClientRect'];
}

/** BackgroundPatternLayer 구조 — 바깥(박스·opacity·overflow hidden) > 안쪽(cover 이미지, scale). */
function buildLayer(parent: HTMLElement, opacity: string, innerScale = 1) {
  const layer = document.createElement('div');
  layer.setAttribute('data-bg-pattern', 'true');
  layer.style.opacity = opacity;
  stubRect(layer, 604, 1111, 300, 42);
  const inner = document.createElement('div');
  inner.setAttribute('data-bg-pattern-image', 'true');
  inner.style.backgroundImage = `url("${STAMP_SRC}")`;
  // transform:scale은 getBoundingClientRect에 반영된 렌더 박스로 들어온다(중앙 기준 확대).
  const w = 300 * innerScale;
  const h = 42 * innerScale;
  stubRect(inner, 604 + (300 - w) / 2, 1111 + (42 - h) / 2, w, h);
  layer.appendChild(inner);
  parent.appendChild(layer);
  return layer;
}

/** 캡처 노드 > 컬럼(불투명 종이, 포스터 조상 아님 = editorial 메인 컬럼 근사) > 스탬프. */
function buildTicket(opacity = '0.6', innerScale = 1) {
  const node = document.createElement('div');
  stubRect(node, 0, 0, 960, 1534);
  const column = document.createElement('div');
  column.style.background = 'rgb(244, 237, 224)';
  stubRect(column, 0, 0, 960, 1534);
  const layer = buildLayer(column, opacity, innerScale);
  node.appendChild(column);
  document.body.appendChild(node);
  columnEl = column;
  return { node, column, layer };
}

const OPTS = { filename: 't.jpg', width: 960, height: 1534, pixelRatio: 1 };

describe('#768 — foreignObject 배경을 그리는 엔진(Chrome)은 기존 경로 그대로', () => {
  test('probe가 그려지면 스탬프는 base에 남고 캔버스 합성·조상 배경 이관이 없다', async () => {
    probeAlpha = 255;
    const { node, layer } = buildTicket('0.6');
    await captureNodeToJpeg(node, OPTS);
    expect(filterSeen!(layer)).toBe(true);
    expect(columnBgDuringToPng).toBe('rgb(244, 237, 224)');
    expect(ops.some((o) => o.kind === 'draw' && o.src === STAMP_SRC && o.w === 300)).toBe(false);
    expect(ops.some((o) => o.kind === 'fill' && o.style === 'rgb(244, 237, 224)')).toBe(false);
    node.remove();
  });
});

describe('#768 — 안 그리는 엔진(iOS)에선 스탬프가 base에서 빠지고 캔버스에 직접 합성된다', () => {
  test('toPng filter가 [data-bg-pattern]을 뺀다(iOS foreignObject raster 함정 회피)', async () => {
    probeAlpha = 0;
    const { node, layer } = buildTicket();
    await captureNodeToJpeg(node, OPTS);
    expect(filterSeen).not.toBeNull();
    expect(filterSeen!(layer)).toBe(false);
    expect(filterSeen!(document.createElement('div'))).toBe(true);
    node.remove();
  });

  test('종이 → 스탬프 → base 순서로, 박스에 클립·cover/center·opacity로 그린다', async () => {
    const { node, column } = buildTicket('0.6');
    await captureNodeToJpeg(node, OPTS);

    // 포스터 조상이 아닌 불투명 컬럼도 base에서 빠지고(캡처 중 transparent) 원래 값으로 복원된다.
    expect(columnBgDuringToPng).toBe('transparent');
    expect(column.style.backgroundColor).toBe('rgb(244, 237, 224)');

    const paperIdx = ops.findIndex((o) => o.kind === 'fill' && o.style === 'rgb(244, 237, 224)');
    const stampIdx = ops.findIndex((o) => o.kind === 'draw' && o.src === STAMP_SRC);
    const baseIdx = ops.findIndex((o) => o.kind === 'draw' && o.src.endsWith('BASE'));
    expect(paperIdx).toBeGreaterThanOrEqual(0);
    expect(paperIdx).toBeLessThan(stampIdx);
    expect(stampIdx).toBeLessThan(baseIdx);

    // 박스(여백 10 더한 604+10, 1111+10, 300×42)로 클립하고, 400×200을 cover(0.75) → 300×150 중앙 정렬.
    const clip = ops[stampIdx - 1];
    expect(clip).toMatchObject({ kind: 'clip', x: 614, y: 1121, w: 300, h: 42 });
    expect(ops[stampIdx]).toMatchObject({ kind: 'draw', alpha: 0.6, x: 614, y: 1121 + (42 - 150) / 2, w: 300, h: 150 });
    node.remove();
  });

  test('스탬프에만 걸린 조상 배경은 포스터 다음에 칠한다 — 포스터 blur 번짐을 덮던 순서 유지', async () => {
    const { node } = buildTicket('1');
    // editorial처럼 포스터 컬럼이 메인 컬럼(스탬프 조상)의 앞 형제로 선다.
    const posterRoot = document.createElement('div');
    posterRoot.setAttribute('data-poster-root', 'true');
    stubRect(posterRoot, 0, 0, 640, 960);
    const poster = document.createElement('img');
    poster.src = 'blob:poster';
    poster.dataset.role = 'poster';
    Object.defineProperty(poster, 'naturalWidth', { value: 960, configurable: true });
    Object.defineProperty(poster, 'naturalHeight', { value: 1440, configurable: true });
    (poster as unknown as { decode: () => Promise<void> }).decode = () => Promise.resolve();
    stubRect(poster, 0, 0, 640, 960);
    posterRoot.appendChild(poster);
    node.insertBefore(posterRoot, node.firstChild);

    await captureNodeToJpeg(node, OPTS);
    const posterIdx = ops.findIndex((o) => o.kind === 'draw' && o.src === 'blob:poster');
    const paperIdx = ops.findIndex((o) => o.kind === 'fill' && o.style === 'rgb(244, 237, 224)');
    const stampIdx = ops.findIndex((o) => o.kind === 'draw' && o.src === STAMP_SRC);
    expect(posterIdx).toBeGreaterThanOrEqual(0);
    expect(posterIdx).toBeLessThan(paperIdx);
    expect(paperIdx).toBeLessThan(stampIdx);
    node.remove();
  });

  test('scale(1.5)은 렌더 박스로 반영된다 — 클립은 바깥 박스 그대로, 이미지는 1.5배', async () => {
    const { node } = buildTicket('1', 1.5);
    await captureNodeToJpeg(node, OPTS);
    const stampIdx = ops.findIndex((o) => o.kind === 'draw' && o.src === STAMP_SRC);
    expect(ops[stampIdx - 1]).toMatchObject({ kind: 'clip', x: 614, y: 1121, w: 300, h: 42 });
    const draw = ops[stampIdx] as { w: number; h: number; alpha: number };
    expect(draw.w).toBeCloseTo(450, 5);
    expect(draw.h).toBeCloseTo(225, 5);
    expect(draw.alpha).toBe(1);
    node.remove();
  });
});
