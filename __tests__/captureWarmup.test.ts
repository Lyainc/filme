import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

// html-to-image의 toJpeg 호출 수를 세 워밍업(버리는 캡처)이 콘텐츠별로 도는지 검증한다.
// mock.module은 hoisting 안 됨 — 등록 후 require로 SUT를 가져와야 가로채진다(CLAUDE.md).
let calls: Array<{ pixelRatio: number; imgSrc?: string }> = [];
// 워밍업(pixelRatio:1) 한 번만 실패시켜 재시도 경로를 검증할 때 켠다.
let failWarmupOnce = false;
mock.module('html-to-image', () => ({
  toJpeg: (_node: unknown, opts: { pixelRatio: number }) => {
    const img = (_node as HTMLElement).querySelector?.('img');
    calls.push({ pixelRatio: opts.pixelRatio, imgSrc: img?.src });
    if (failWarmupOnce && opts.pixelRatio === 1) {
      failWarmupOnce = false;
      return Promise.reject(new Error('warmup boom'));
    }
    return Promise.resolve('data:image/jpeg;base64,AAAA');
  },
}));

const { captureNodeToJpeg, __resetWarmupCacheForTest } = require('../src/utils/captureToImage');

// happy-dom img는 decode() 미구현이라 decodeImage가 load 이벤트를 기다리며 멎을 수 있다.
// 즉시 resolve하는 decode를 심어 캡처 로직만 격리해 검증한다.
function nodeWithPoster(src: string): HTMLElement {
  const div = document.createElement('div');
  const img = document.createElement('img');
  img.src = src;
  // happy-dom img는 complete=true·naturalWidth=0(=깨진 이미지)로 떠 decodeImage가 throw한다.
  // 정상 디코드 완료 상태로 심어 캡처 로직만 격리한다.
  Object.defineProperty(img, 'naturalWidth', { value: 100, configurable: true });
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

describe('#378 blob: 포스터 — 캡처 시점 data: 치환 + 캡처 후 원복', () => {
  // happy-dom은 canvas 2D를 기본 지원 안 해(getContext('2d') → null) blobSrcToDataUrl이
  // 조용히 null을 리턴하고 스킵한다. 실제 치환 경로를 검증하려면 getContext/toDataURL을 스텁한다.
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let originalToDataURL: typeof HTMLCanvasElement.prototype.toDataURL;

  beforeEach(() => {
    calls = [];
    failWarmupOnce = false;
    __resetWarmupCacheForTest();
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const fakeCtx = { drawImage: () => {} } as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.getContext = ((kind: string) =>
      kind === '2d' ? fakeCtx : null) as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = (() =>
      'data:image/png;base64,AAAA') as typeof HTMLCanvasElement.prototype.toDataURL;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
  });

  test('본 캡처(ratio 2) 순간엔 img.src가 data:이고, 캡처 후 원래 blob:로 복원된다', async () => {
    const node = nodeWithPoster('blob:378');
    const img = node.querySelector('img')!;

    await captureNodeToJpeg(node, OPTS);

    // 워밍업(ratio 1)은 원래 blob: 그대로 돈다 — 버리는 캡처라 치환 대상이 아니다.
    const warmupCall = calls.find((c) => c.pixelRatio === 1);
    expect(warmupCall?.imgSrc).toBe('blob:378');

    // 본 캡처(ratio 2)는 data: URL로 치환된 상태로 toJpeg에 전달된다.
    const mainCall = calls.find((c) => c.pixelRatio === 2);
    expect(mainCall?.imgSrc?.startsWith('data:')).toBe(true);

    // 캡처가 끝나면 라이브 DOM의 img.src는 원래 blob: URL로 복원된다.
    expect(img.src).toBe('blob:378');
  });
});
