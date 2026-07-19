import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// html-to-image의 toJpeg 호출 수를 세 워밍업(버리는 캡처)이 콘텐츠별로 도는지 검증한다.
// mock.module은 hoisting 안 됨 — 등록 후 require로 SUT를 가져와야 가로채진다(CLAUDE.md).
let calls: Array<{ pixelRatio: number; imgSrc?: string; canvases: Array<{ width: number; height: number }> }> = [];
// 워밍업(pixelRatio:1) 한 번만 실패시켜 재시도 경로를 검증할 때 켠다.
let failWarmupOnce = false;
mock.module('html-to-image', () => ({
  toJpeg: (_node: unknown, opts: { pixelRatio: number }) => {
    const el = _node as HTMLElement;
    const img = el.querySelector?.('img');
    const canvases = Array.from(el.querySelectorAll?.('canvas') ?? []).map((c) => ({
      width: (c as HTMLCanvasElement).width,
      height: (c as HTMLCanvasElement).height,
    }));
    calls.push({ pixelRatio: opts.pixelRatio, imgSrc: img?.src, canvases });
    if (failWarmupOnce && opts.pixelRatio === 1) {
      failWarmupOnce = false;
      return Promise.reject(new Error('warmup boom'));
    }
    return Promise.resolve('data:image/jpeg;base64,AAAA');
  },
}));

const { captureNodeToJpeg, __resetWarmupCacheForTest } = require('../src/utils/captureToImage');

// happy-dom img는 decode() 미구현이라 decodeImage가 load 이벤트를 기다리며 멎을 수 있다.
// 즉시 resolve하는 decode를 심어 캡처 로직만 격리해 검증한다. naturalWidth/Height 둘 다
// 명시적으로 심는다 — 한쪽만 세팅하면 다른 쪽이 happy-dom 기본값(0)에 암묵 의존하게 된다
// (claude-review PR #458 P2).
function nodeWithPoster(src: string, dims: { w: number; h: number } = { w: 100, h: 100 }): HTMLElement {
  const div = document.createElement('div');
  const img = document.createElement('img');
  img.src = src;
  Object.defineProperty(img, 'naturalWidth', { value: dims.w, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: dims.h, configurable: true });
  (img as unknown as { decode: () => Promise<void> }).decode = () => Promise.resolve();
  div.appendChild(img);
  return div;
}

const OPTS = { filename: 't.jpg', width: 960, height: 1477 };

describe('#175 캡처 워밍업 — 콘텐츠(이미지 src)별로 덥힌다', () => {
  beforeEach(() => {
    calls = [];
    failWarmupOnce = false;
    // 모듈 레벨 워밍업 캐시를 비워 테스트 격리를 명시한다(고유 URL에 암묵 의존하지 않게, #175 리뷰).
    __resetWarmupCacheForTest();
  });

  test('새 포스터의 첫 캡처는 워밍업(ratio 1) + 본 캡처(ratio 2)', async () => {
    await captureNodeToJpeg(nodeWithPoster('blob:first'), OPTS);
    expect(calls.map((c) => c.pixelRatio)).toEqual([1, 2]);
  });

  test('같은 포스터 두 번째 캡처는 본 캡처만(이미 덥혀짐)', async () => {
    await captureNodeToJpeg(nodeWithPoster('blob:same'), OPTS); // 첫 캡처 — 덥힘
    calls = [];
    await captureNodeToJpeg(nodeWithPoster('blob:same'), OPTS); // 두 번째 — 워밍업 없어야
    expect(calls.map((c) => c.pixelRatio)).toEqual([2]);
  });

  test('포스터를 바꾸면 다시 워밍업한다 — 세션 전역 한 번이 아니다', async () => {
    await captureNodeToJpeg(nodeWithPoster('blob:before'), OPTS); // 첫 포스터 덥힘
    calls = [];
    await captureNodeToJpeg(nodeWithPoster('blob:after'), OPTS); // 교체 — 다시 콜드
    expect(calls.map((c) => c.pixelRatio)).toEqual([1, 2]);
  });

  test('이미지 없는 노드는 워밍업 없이 본 캡처만', async () => {
    await captureNodeToJpeg(document.createElement('div'), OPTS);
    expect(calls.map((c) => c.pixelRatio)).toEqual([2]);
  });

  test('워밍업이 실패하면 시그니처를 비워 다음 캡처가 다시 워밍업한다', async () => {
    failWarmupOnce = true;
    // 1차: 워밍업(ratio 1) reject → catch에서 시그니처 delete → 본 캡처(ratio 2)는 정상.
    await captureNodeToJpeg(nodeWithPoster('blob:retry'), OPTS);
    expect(calls.map((c) => c.pixelRatio)).toEqual([1, 2]);
    calls = [];
    // 2차: 시그니처가 비워졌으므로 같은 src도 다시 워밍업한다(실패가 영구 콜드로 굳지 않음).
    await captureNodeToJpeg(nodeWithPoster('blob:retry'), OPTS);
    expect(calls.map((c) => c.pixelRatio)).toEqual([1, 2]);
  });
});

describe('#439 blob: 포스터 — 캡처 시점 <canvas> 노드 치환 + 캡처 후 원복', () => {
  // html-to-image의 foreignObject 중첩 <img> 렌더가 완결을 보장 못 해(embed-images.ts 경로),
  // blob:/data: src 치환 두 라운드로도 실기기에서 특정 이미지가 계속 빠졌다 — canvas는 html-to-image
  // 내부에서 완전히 다른(그리고 견고한) 경로를 타므로 노드 자체를 canvas로 바꾼다(captureToImage.ts
  // blobImgToCanvas 주석 참고). happy-dom은 canvas 2D를 기본 지원 안 해(getContext('2d') → null)
  // blobImgToCanvas가 조용히 null을 리턴하고 스킵하므로, 실제 치환 경로를 검증하려면 getContext를 스텁한다.
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    calls = [];
    failWarmupOnce = false;
    __resetWarmupCacheForTest();
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    const fakeCtx = { drawImage: () => {} } as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.getContext = ((kind: string) =>
      kind === '2d' ? fakeCtx : null) as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  test('본 캡처(ratio 2) 순간엔 <img> 대신 <canvas>가 들어가고, 캡처 후 원래 <img>로 복원된다', async () => {
    const node = nodeWithPoster('blob:378');
    const img = node.querySelector('img')!;

    await captureNodeToJpeg(node, OPTS);

    // 워밍업(ratio 1)은 원래 <img> 그대로 돈다 — 버리는 캡처라 치환 대상이 아니다.
    const warmupCall = calls.find((c) => c.pixelRatio === 1);
    expect(warmupCall?.imgSrc).toBe('blob:378');
    expect(warmupCall?.canvases.length).toBe(0);

    // 본 캡처(ratio 2)는 <img>가 <canvas>로 바뀐 상태로 toJpeg에 전달된다.
    const mainCall = calls.find((c) => c.pixelRatio === 2);
    expect(mainCall?.imgSrc).toBeUndefined();
    expect(mainCall?.canvases.length).toBe(1);

    // 캡처가 끝나면 라이브 DOM에 원래 <img>가 되돌아오고 canvas는 사라진다.
    expect(node.querySelector('img')).toBe(img);
    expect(node.querySelector('canvas')).toBeNull();
    expect(img.src).toBe('blob:378');
  });

  test('getContext 실패(캔버스 미지원)면 원래 <img> 그대로 캡처된다', async () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
    const node = nodeWithPoster('blob:nofallback');

    await captureNodeToJpeg(node, OPTS);

    const mainCall = calls.find((c) => c.pixelRatio === 2);
    expect(mainCall?.imgSrc).toBe('blob:nofallback');
    expect(mainCall?.canvases.length).toBe(0);
  });
});

describe('#439 후보④ — blob <img> → <canvas> 노드 치환, 캔버스 크기 상한', () => {
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    calls = [];
    failWarmupOnce = false;
    __resetWarmupCacheForTest();
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    const fakeCtx = { drawImage: () => {} } as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.getContext = ((kind: string) =>
      kind === '2d' ? fakeCtx : null) as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  test('naturalWidth/Height가 상한(2048)을 넘으면 종횡비를 유지한 채 캔버스를 다운스케일한다', async () => {
    await captureNodeToJpeg(nodeWithPoster('blob:huge', { w: 3068, h: 2301 }), OPTS);

    const mainCall = calls.find((c) => c.pixelRatio === 2);
    // 3068:2301 ≈ 4:3 — 긴 변(3068)이 2048로 스케일되면 짧은 변도 같은 비율로 줄어야 한다.
    expect(mainCall?.canvases).toEqual([{ width: 2048, height: Math.round(2301 * (2048 / 3068)) }]);
  });

  test('상한 이하 이미지는 원본 해상도 그대로 캔버스에 그린다', async () => {
    await captureNodeToJpeg(nodeWithPoster('blob:normal'), OPTS); // 기본 100x100

    const mainCall = calls.find((c) => c.pixelRatio === 2);
    expect(mainCall?.canvases).toEqual([{ width: 100, height: 100 }]);
  });

  test('같은 blob src를 공유하는 두 <img>(contain fit의 배경+전경 포스터)는 각각 독립된 <canvas>로 치환된다', async () => {
    const node = document.createElement('div');
    for (let i = 0; i < 2; i++) {
      const img = document.createElement('img');
      img.src = 'blob:shared';
      img.dataset.role = 'poster';
      Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 100, configurable: true });
      (img as unknown as { decode: () => Promise<void> }).decode = () => Promise.resolve();
      node.appendChild(img);
    }

    await captureNodeToJpeg(node, OPTS);

    // 캔버스는 DOM 한 곳에만 존재할 수 있어 공유 src라도 독립된 두 <canvas>가 만들어진다
    // (dedup 캐시는 더 없다 — drawImage는 이미 디코드된 <img>에서 그리는 값싼 작업이라
    // 중복 인코딩 비용이 있던 이전 data:/blob: 치환 방식과 달리 아낄 이유가 없다).
    const mainCall = calls.find((c) => c.pixelRatio === 2);
    expect(mainCall?.canvases.length).toBe(2);
    // 캡처 후 두 <img> 모두 원래대로 복원된다.
    expect(node.querySelectorAll('img').length).toBe(2);
    expect(node.querySelectorAll('canvas').length).toBe(0);
    node.querySelectorAll('img').forEach((img) => {
      expect((img as HTMLImageElement).src).toBe('blob:shared');
    });
  });
});
