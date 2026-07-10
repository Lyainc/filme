import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { fitFontSizeToWidth } from '../src/components/moods/_shared';

/**
 * fitFontSizeToWidth(#318) 이진탐색 회귀 테스트.
 *
 * happy-dom은 canvas 2D 컨텍스트를 구현하지 않아(`getContext('2d')` → null) 실제
 * measureText를 검증할 수 없다. HTMLCanvasElement.prototype.getContext를 테스트 동안만
 * 교체해 "폭 = 글자수 × 폰트크기 × factor"에 비례하는 가짜 measureText를 주고, 그 위에서
 * 이진탐색이 올바른 크기로 수렴하는지 검증한다.
 *
 * 각 테스트는 서로 다른 fontFamily 문자열을 키로 써서, _shared.tsx의 모듈 스코프
 * fitFontSizeCache(캐시)와 다른 테스트 파일의 호출이 겹쳐도(bun test는 파일 간 모듈
 * 상태를 공유한다 — 격리 안 됨) 캐시 충돌이 나지 않게 한다.
 */
const CHAR_WIDTH_FACTOR = 0.6;

function installFakeCanvasContext() {
  let currentFont = '400 16px sans-serif';
  let measureCalls = 0;

  const fakeCtx = {
    set font(v: string) {
      currentFont = v;
    },
    get font() {
      return currentFont;
    },
    measureText(text: string) {
      measureCalls++;
      const sizeMatch = /(\d+(?:\.\d+)?)px/.exec(currentFont);
      const size = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
      return { width: text.length * size * CHAR_WIDTH_FACTOR };
    },
  } as unknown as CanvasRenderingContext2D;

  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === '2d' ? fakeCtx : null;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return {
    restore: () => {
      HTMLCanvasElement.prototype.getContext = original;
    },
    getMeasureCalls: () => measureCalls,
  };
}

describe('fitFontSizeToWidth', () => {
  let fake: ReturnType<typeof installFakeCanvasContext>;

  beforeEach(() => {
    fake = installFakeCanvasContext();
  });
  afterEach(() => {
    fake.restore();
  });

  test('빈 텍스트는 maxSize를 그대로 반환한다', () => {
    expect(fitFontSizeToWidth('', 1000, { fontFamily: 'FitTestEmpty', minSize: 20, maxSize: 60 })).toBe(60);
  });

  test('maxSize에서 이미 폭 안에 들어오면 축소 없이 maxSize를 반환한다', () => {
    // widthAt(60) = 4자 × 60 × 0.6 = 144 <= 500
    const size = fitFontSizeToWidth('abcd', 500, { fontFamily: 'FitTestFits', minSize: 20, maxSize: 60 });
    expect(size).toBe(60);
  });

  test('폭을 넘치는 텍스트는 이진탐색으로 들어맞는 가장 큰 크기로 축소된다', () => {
    // widthAt(size) = 20자 × size × 0.6 = 12×size. maxWidth=300 → size<=25에서 fit.
    const text = 'a'.repeat(20);
    const size = fitFontSizeToWidth(text, 300, { fontFamily: 'FitTestShrink', minSize: 10, maxSize: 60 });
    expect(size).toBe(25);
    expect(12 * size).toBeLessThanOrEqual(300); // 실제로 들어맞고
    expect(12 * (size + 1)).toBeGreaterThan(300); // 한 단계 더 크면 넘친다 — 이진탐색이 맞는 상한에 수렴
  });

  test('minSize에서도 폭을 넘치면 minSize로 클램프한다', () => {
    const text = 'a'.repeat(100);
    const size = fitFontSizeToWidth(text, 50, { fontFamily: 'FitTestClamp', minSize: 20, maxSize: 60 });
    expect(size).toBe(20);
  });

  test('동일 인자로 재호출하면 캐시를 써서 같은 값을 반환하고 measureText를 다시 부르지 않는다', () => {
    const text = 'b'.repeat(20);
    const opts = { fontFamily: 'FitTestCache', minSize: 10, maxSize: 60 };
    const first = fitFontSizeToWidth(text, 300, opts);
    const callsAfterFirst = fake.getMeasureCalls();
    const second = fitFontSizeToWidth(text, 300, opts);
    expect(second).toBe(first);
    expect(fake.getMeasureCalls()).toBe(callsAfterFirst);
  });

  test('컨텍스트를 얻을 수 없으면(canvas 미지원) maxSize로 안전하게 폴백한다', () => {
    fake.restore(); // happy-dom의 실제 getContext('2d')는 null을 반환
    const size = fitFontSizeToWidth('제목 텍스트', 1, { fontFamily: 'FitTestNoCtx', minSize: 5, maxSize: 40 });
    expect(size).toBe(40);
  });

  // claude-review PR #345 P1: 폰트 로드 전 잰 값이 캐시에 박히면 로드 후에도 안 바뀌던 버그.
  test('fontsReady=false면 결과를 캐시에 쓰지 않는다 — 같은 인자라도 매번 다시 측정한다', () => {
    const text = 'c'.repeat(20);
    const opts = { fontFamily: 'FitTestNotReady', minSize: 10, maxSize: 60 };
    fitFontSizeToWidth(text, 300, opts, false);
    const callsAfterFirst = fake.getMeasureCalls();
    fitFontSizeToWidth(text, 300, opts, false);
    // 캐시 미스라 두 번째 호출도 measureText를 다시 부른다(호출 수가 늘어난다).
    expect(fake.getMeasureCalls()).toBeGreaterThan(callsAfterFirst);
  });

  test('fontsReady=false로 잰 뒤 true로 재호출하면 그제서야 캐시에 쓰고, 그다음부터 재사용한다', () => {
    const text = 'd'.repeat(20);
    const opts = { fontFamily: 'FitTestReadyLater', minSize: 10, maxSize: 60 };
    fitFontSizeToWidth(text, 300, opts, false); // 폰트 로드 전 — 캐시 안 씀
    fitFontSizeToWidth(text, 300, opts, true); // 폰트 로드 후 첫 정확한 측정 — 캐시에 씀
    const callsAfterReady = fake.getMeasureCalls();
    fitFontSizeToWidth(text, 300, opts, true); // 캐시 히트 — measureText 안 부름
    expect(fake.getMeasureCalls()).toBe(callsAfterReady);
  });
});
