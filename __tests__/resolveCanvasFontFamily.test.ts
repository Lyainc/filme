import { afterEach, describe, expect, test } from 'bun:test';
import { resetResolvedCssVarCacheForTest, resolveCanvasFontFamily } from '../src/components/moods/_shared';

/**
 * resolveCanvasFontFamily(#751) 회귀 테스트. Canvas 2D `font` 문법이 var()를 못 읽는 문제(브라우저
 * 실측, Chrome 152)를 우회하려고 이 함수가 var(--x)를 <main>에서 읽은 실제 값으로 치환한다.
 *
 * happy-dom의 getComputedStyle은 인라인 style로 건 커스텀 프로퍼티를 그 엘리먼트 자신에게서는
 * 그대로 돌려주므로(캐스케이드 없이도), `data-font-root` 속성을 단 <main>에 직접 세팅하는
 * 것만으로 이 함수의 대상 조회 경로(`document.querySelector('[data-font-root]')`, #751
 * code-review — 태그 셀렉터는 `t/[id].tsx`의 중첩 `<main>`과 충돌 가능해 속성으로 좁혔다)를
 * 그대로 재현할 수 있다.
 */
describe('resolveCanvasFontFamily', () => {
  let main: HTMLElement | null = null;

  afterEach(() => {
    main?.remove();
    main = null;
    resetResolvedCssVarCacheForTest();
  });

  test('var()가 없으면 원본을 그대로 반환한다', () => {
    expect(resolveCanvasFontFamily('"Literal", sans-serif')).toBe('"Literal", sans-serif');
  });

  test('<main>에 정의된 값으로 var(--x)를 치환한다', () => {
    main = document.createElement('main');
    main.setAttribute('data-font-root', '');
    main.style.setProperty('--rcf-test-a', '"pretendard", "pretendard Fallback"');
    document.body.appendChild(main);

    const result = resolveCanvasFontFamily('var(--rcf-test-a), "Pretendard Variable", sans-serif');
    expect(result).toBe('"pretendard", "pretendard Fallback", "Pretendard Variable", sans-serif');
  });

  test('<main>이 없으면(테스트 DOM) 원래 var() 토큰을 그대로 남긴다 — 무시됨 동작 유지', () => {
    const result = resolveCanvasFontFamily('var(--rcf-test-b), "Fallback"');
    expect(result).toBe('var(--rcf-test-b), "Fallback"');
  });

  test('같은 변수명은 캐시되어 두 번째 호출은 재조회 없이도 같은 값을 낸다', () => {
    main = document.createElement('main');
    main.setAttribute('data-font-root', '');
    main.style.setProperty('--rcf-test-c', '"First"');
    document.body.appendChild(main);

    const first = resolveCanvasFontFamily('var(--rcf-test-c)');
    main.style.setProperty('--rcf-test-c', '"Second"'); // 캐시 히트라 이 변경은 안 반영돼야 정상
    const second = resolveCanvasFontFamily('var(--rcf-test-c)');
    expect(first).toBe('"First"');
    expect(second).toBe('"First"');
  });

  test('resetResolvedCssVarCacheForTest 뒤엔 새로 조회한다 — 오염된 캐시가 다음 테스트로 안 샌다', () => {
    // 이 순서 자체가 리뷰 지적(#751)의 실패 시나리오를 재현한다: <main> 없이 먼저 호출해
    // 빈 문자열을 캐시시킨 뒤, reset 없이 재호출하면 <main>이 생겨도 여전히 원본 토큰을 반환한다.
    resolveCanvasFontFamily('var(--rcf-test-d)');
    main = document.createElement('main');
    main.setAttribute('data-font-root', '');
    main.style.setProperty('--rcf-test-d', '"Real"');
    document.body.appendChild(main);

    const poisoned = resolveCanvasFontFamily('var(--rcf-test-d)');
    expect(poisoned).toBe('var(--rcf-test-d)'); // reset 전엔 여전히 오염된 채

    resetResolvedCssVarCacheForTest();
    const recovered = resolveCanvasFontFamily('var(--rcf-test-d)');
    expect(recovered).toBe('"Real"');
  });
});
