import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// #490/#495 — 무드 루트에 불투명 배경이 있으면 저장물에서 포스터가 통째로 사라지던 회귀.
// #439가 포스터를 raw canvas로 base PNG '아래' 합성하도록 바꿨는데, 그건 base가 포스터 자리에서
// 투명할 때만 성립한다. editorial·stub(PAPER)·35mm·35mm Wide(FS_BASE)는 루트가 inset:0에 불투명
// 배경을 깔아 base가 전면을 칠했고, 그게 합성된 포스터를 덮었다(minimal·criterion은 배경이 없어
// 무사했다 — 그래서 실기기 테스트가 minimal에선 통과하고 editorial에서만 실패했다).
// 여기선 그 배경이 base에서 빠지고(캡처 중 transparent), 캔버스엔 포스터보다 먼저 칠해지는지 본다.

let bgDuringToPng: string | null = null;
let backdropEl: HTMLElement | null = null;
mock.module('html-to-image', () => ({
  toPng: () => {
    // toPng이 도는 순간의 배경 = base PNG에 실제로 찍히는 값.
    bgDuringToPng = backdropEl ? backdropEl.style.backgroundColor : null;
    return Promise.resolve('data:image/png;base64,BASE');
  },
}));

const { captureNodeToJpeg } = require('../src/utils/captureToImage');

type Op = { kind: 'fill'; style: string; x: number; y: number; w: number; h: number } | { kind: 'draw'; isPoster: boolean };
let ops: Op[];
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
let originalToDataURL: typeof HTMLCanvasElement.prototype.toDataURL;
let originalImage: typeof Image;
let posterImg: HTMLImageElement;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode() { return Promise.resolve(); }
  set src(_v: string) { queueMicrotask(() => this.onload?.()); }
}

beforeEach(() => {
  ops = [];
  bgDuringToPng = null;
  const makeCtx = () => ({
    filter: 'none',
    fillStyle: '' as unknown,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, clip() {}, rect() {},
    fillRect(this: { fillStyle: unknown }, x: number, y: number, w: number, h: number) {
      ops.push({ kind: 'fill', style: String(this.fillStyle), x, y, w, h });
    },
    createLinearGradient() { return { addColorStop() {} }; },
    createPattern() { return {}; },
    drawImage(arg: unknown) { ops.push({ kind: 'draw', isPoster: arg === posterImg }); },
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
  backdropEl = null;
});

function stubRect(el: Element, left: number, top: number, width: number, height: number) {
  el.getBoundingClientRect = (() => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} })) as Element['getBoundingClientRect'];
}

/** editorial 구조 근사 — 캡처 노드 > 불투명 배경 루트 > 포스터 컬럼 > poster-root > <img>. */
function buildTicket(opaque: boolean) {
  const node = document.createElement('div');
  stubRect(node, 0, 0, 1534, 960);
  const root = document.createElement('div');
  if (opaque) root.style.background = 'rgb(244, 237, 224)'; // PAPER
  stubRect(root, 0, 0, 1534, 960);
  const posterRoot = document.createElement('div');
  posterRoot.setAttribute('data-poster-root', 'true');
  stubRect(posterRoot, 0, 0, 613, 960);
  posterImg = document.createElement('img');
  posterImg.src = 'blob:x';
  posterImg.dataset.role = 'poster';
  Object.defineProperty(posterImg, 'naturalWidth', { value: 2003, configurable: true });
  Object.defineProperty(posterImg, 'naturalHeight', { value: 3000, configurable: true });
  (posterImg as unknown as { decode: () => Promise<void> }).decode = () => Promise.resolve();
  posterImg.style.objectFit = 'cover';
  stubRect(posterImg, 0, 0, 613, 960);
  posterRoot.appendChild(posterImg);
  root.appendChild(posterRoot);
  node.appendChild(root);
  document.body.appendChild(node);
  backdropEl = root;
  return { node, root };
}

const OPTS = { filename: 't.jpg', width: 1534, height: 960, pixelRatio: 1 };

describe('#490/#495 — 불투명 무드 배경이 합성된 포스터를 덮지 않는다', () => {
  test('불투명 루트 배경은 base PNG에서 빠지고(캡처 중 transparent) 캔버스엔 포스터보다 먼저 칠해진다', async () => {
    const { node, root } = buildTicket(true);

    await captureNodeToJpeg(node, OPTS);

    // base PNG를 뽑는 순간엔 배경이 투명이어야 한다 — 안 그러면 포스터를 덮는다.
    expect(bgDuringToPng).toBe('transparent');
    // 캡처가 끝나면 화면(미리보기)용으로 원래 값이 복원돼야 한다 — 안 그러면 티켓이 투명해진 채 남는다.
    expect(root.style.backgroundColor).toBe('rgb(244, 237, 224)');

    // 배경 fill이 포스터 draw보다 먼저 와야 한다.
    const bgFillIdx = ops.findIndex((o) => o.kind === 'fill' && o.style === 'rgb(244, 237, 224)');
    const posterIdx = ops.findIndex((o) => o.kind === 'draw' && o.isPoster);
    expect(bgFillIdx).toBeGreaterThanOrEqual(0);
    expect(posterIdx).toBeGreaterThanOrEqual(0);
    expect(bgFillIdx).toBeLessThan(posterIdx);

    // 티켓 영역(여백 10 안쪽, 1534×960)에 칠해지고 흰 여백을 침범하지 않는다.
    const fill = ops[bgFillIdx] as { x: number; y: number; w: number; h: number };
    expect(fill).toMatchObject({ x: 10, y: 10, w: 1534, h: 960 });

    node.remove();
  });

  test('배경이 없는 무드(minimal·criterion)는 아무것도 이관하지 않는다 — 기존 동작 그대로', async () => {
    const { node, root } = buildTicket(false);

    await captureNodeToJpeg(node, OPTS);

    expect(bgDuringToPng).toBe(''); // 손대지 않음
    expect(root.style.backgroundColor).toBe('');
    // PAPER 색 fill이 없어야 한다(흰 여백 fill만 존재).
    expect(ops.some((o) => o.kind === 'fill' && o.style === 'rgb(244, 237, 224)')).toBe(false);

    node.remove();
  });
});
