import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { truncateActorsToWidth } from '../src/components/moods/_shared';
import { CHAR_WIDTH_FACTOR, installFakeCanvasContext } from './setup/canvasStub';

/**
 * truncateActorsToWidth(#493) 회귀 테스트 — fitFontSizeToWidth.test.ts와 동일 패턴으로
 * happy-dom의 null canvas 2D 컨텍스트를 가짜 measureText로 교체해 실제 폭 계산 경로를 태운다.
 */

describe('truncateActorsToWidth', () => {
  let fake: ReturnType<typeof installFakeCanvasContext>;

  beforeEach(() => {
    fake = installFakeCanvasContext();
  });
  afterEach(() => {
    fake.restore();
  });

  test('빈 문자열은 빈 문자열을 반환한다', () => {
    expect(truncateActorsToWidth('', 1000, { fontFamily: 'TAWEmpty', fontSize: 16 })).toBe('');
  });

  test('배우 1명은 폭과 무관하게 그대로 반환한다(자를 대상이 없음)', () => {
    const name = 'a'.repeat(50);
    expect(truncateActorsToWidth(name, 1, { fontFamily: 'TAWSingle', fontSize: 16 })).toBe(name);
  });

  test('가용폭 안에 들어오면 원본 그대로(6명이어도 안 잘림) — 고정 count 캡 버그 회귀', () => {
    // 6명 × "가, " 스타일 짧은 이름 — widthAt = 전체 길이×16×0.6인데 maxWidth를 넉넉히 주면 안 잘림.
    const actors = '가, 나, 다, 라, 마, 바';
    const result = truncateActorsToWidth(actors, 1000, { fontFamily: 'TAWFits', fontSize: 16 }, false);
    expect(result).toBe('가, 나, 다, 라, 마, 바');
  });

  test('가용폭을 넘치면 들어맞는 가장 큰 N까지만 남기고 "외 M명"으로 자른다', () => {
    // 6명, 각 "이름N"(3자) → "이름1, 이름2, ..." 풀텍스트 폭 = widthAt. N=3까지가 fit하도록 maxWidth 계산.
    const parts = ['이름1', '이름2', '이름3', '이름4', '이름5', '이름6'];
    const actors = parts.join(', ');
    const fontSize = 16;
    const widthOf = (s: string) => s.length * fontSize * CHAR_WIDTH_FACTOR;
    const withMore = (n: number) => `${parts.slice(0, n).join(', ')} 외 ${parts.length - n}명`;
    const maxWidth = widthOf(withMore(3)); // 정확히 3명 버전 폭 — 그보다 넉넉해야 3명이 fit
    const result = truncateActorsToWidth(actors, maxWidth + 1, { fontFamily: 'TAWShrink', fontSize }, false);
    expect(result).toBe(withMore(3));
  });

  test('가장 짧은 1명 버전조차 안 들어가면 그래도 1명 버전을 반환한다(CSS ellipsis가 최종 방어선)', () => {
    const actors = '가나다라마바사, 아자차카타파하, 거너더러머버서';
    const result = truncateActorsToWidth(actors, 1, { fontFamily: 'TAWClamp', fontSize: 16 }, false);
    expect(result).toBe('가나다라마바사 외 2명');
  });

  test('동일 인자로 재호출하면 캐시를 써서 measureText를 다시 부르지 않는다', () => {
    const actors = '가, 나, 다, 라, 마, 바, 사';
    const opts = { fontFamily: 'TAWCache', fontSize: 16 };
    const first = truncateActorsToWidth(actors, 50, opts);
    const callsAfterFirst = fake.getMeasureCalls();
    const second = truncateActorsToWidth(actors, 50, opts);
    expect(second).toBe(first);
    expect(fake.getMeasureCalls()).toBe(callsAfterFirst);
  });

  test('fontsReady=false면 캐시에 쓰지 않는다 — 같은 인자라도 매번 다시 측정한다', () => {
    const actors = '가, 나, 다, 라, 마, 바, 사';
    const opts = { fontFamily: 'TAWNotReady', fontSize: 16 };
    truncateActorsToWidth(actors, 50, opts, false);
    const callsAfterFirst = fake.getMeasureCalls();
    truncateActorsToWidth(actors, 50, opts, false);
    expect(fake.getMeasureCalls()).toBeGreaterThan(callsAfterFirst);
  });

  test('컨텍스트를 얻을 수 없으면(canvas 미지원) 원본을 그대로 반환한다', () => {
    fake.restore(); // happy-dom의 실제 getContext('2d')는 null
    const actors = '가, 나, 다, 라, 마, 바';
    expect(truncateActorsToWidth(actors, 1, { fontFamily: 'TAWNoCtx', fontSize: 16 })).toBe(actors);
  });
});
