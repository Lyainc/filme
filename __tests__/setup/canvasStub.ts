/**
 * 텍스트 폭 계산 테스트 공용 스텁 — happy-dom은 canvas 2D 컨텍스트를 안 준다(`getContext('2d')` → null).
 * 그대로 두면 `fitFontSizeToWidth`·`truncateActorsToWidth`의 실제 측정 경로가 통째로 안 돌아 폴백만
 * 검증하게 되므로, measureText를 "글자수 × fontSize × CHAR_WIDTH_FACTOR"로 근사하는 가짜 컨텍스트를
 * `HTMLCanvasElement.prototype`에 심는다.
 *
 * posterStubs.ts와 같은 규약이다 — restore를 돌려주니 afterEach에서 그대로 호출하면 된다.
 * getMeasureCalls는 같은 인자로 다시 부른 호출이 fitFontSizeCache(_shared.tsx)를 타는지 보려고
 * 있다 — 두 번째 호출에서 카운터가 안 늘어야 캐시 적중이다. 탐색 전략(이분 탐색 여부) 자체는
 * 이 카운터로 못 잡는다(선형 스캔으로 퇴화해도 첫 호출 측정 횟수·최종 폰트 크기가 다 그대로다).
 */

/** 가짜 글리프 폭 = fontSize의 이 배수. 폭 기대값을 직접 계산하는 테스트가 같은 상수를 써야 한다. */
export const CHAR_WIDTH_FACTOR = 0.6;

export function installFakeCanvasContext(): { restore: () => void; getMeasureCalls: () => number } {
  let currentFont = '400 16px sans-serif';
  let measureCalls = 0;

  const fakeCtx = {
    set font(v: string) { currentFont = v; },
    get font() { return currentFont; },
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
    restore: () => { HTMLCanvasElement.prototype.getContext = original; },
    getMeasureCalls: () => measureCalls,
  };
}
