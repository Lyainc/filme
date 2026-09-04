import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { measureTextWidth, resetResolvedCssVarCacheForTest } from '../src/components/moods/_shared';

/**
 * #751 통합 회귀 테스트 — `resolveCanvasFontFamily.test.ts`는 그 헬퍼 자체만 격리해서 보고,
 * `measureTextWidth`/`fitFontSizeToWidth`가 실제로 그 헬퍼를 거쳐 `ctx.font`에 값을 넘기는지는
 * 아무 테스트도 안 잠그고 있었다(#751 재검증). `var(--...)` 토큰이 치환 없이 그대로 `ctx.font`에
 * 들어가면 canvas가 조용히 무시하고 직전 폰트로 측정한다 — 이 갭이 그 회귀를 잡는다.
 *
 * 가짜 canvas는 `ctx.font`에 실제로 대입된 문자열을 그대로 노출한다(`__tests__/setup/canvasStub.ts`의
 * 규약과 같은 형태를 이 파일 안에서 직접 구성 — 마지막 대입값을 밖에서 읽어야 해서 그 공용
 * 스텁의 좁은 인터페이스로는 부족하다).
 */
function installFontCapturingCanvas() {
  let lastFont = '';
  const fakeCtx = {
    set font(v: string) { lastFont = v; },
    get font() { return lastFont; },
    measureText: () => ({ width: 0 }),
  } as unknown as CanvasRenderingContext2D;

  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string) {
    return kind === '2d' ? fakeCtx : null;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return {
    restore: () => { HTMLCanvasElement.prototype.getContext = original; },
    getLastFont: () => lastFont,
  };
}

describe('measureTextWidth × resolveCanvasFontFamily 배선 (#751)', () => {
  let main: HTMLElement | null = null;
  let fake: ReturnType<typeof installFontCapturingCanvas>;

  // bun은 테스트 파일 전체를 한 프로세스에서 실행 순서 무관하게 돈다(#611과 같은 부류) — 이 파일
  // 앞에 <main> 없이 FONT_KR/FONT_SANS로 fitFontSizeToWidth를 부르는 기존 테스트(moodStubResync
  // 등, #751 code-review 지적)가 먼저 돌면 resolvedCssVarCache['font-sans']가 빈 문자열로 이미
  // 오염된 채 이 파일이 시작할 수 있다. beforeEach에서도 리셋해 그 프로세스 전역 오염과 무관하게
  // 매 테스트가 깨끗한 캐시로 시작하게 한다.
  beforeEach(() => {
    resetResolvedCssVarCacheForTest();
  });

  afterEach(() => {
    fake.restore();
    main?.remove();
    main = null;
    resetResolvedCssVarCacheForTest();
  });

  test('var(--x)가 <main>에 정의돼 있으면 ctx.font에 치환된 값이 들어간다 — 원본 토큰이 새지 않는다', () => {
    fake = installFontCapturingCanvas();
    main = document.createElement('main');
    main.setAttribute('data-font-root', '');
    main.style.setProperty('--mtw-test', '"ResolvedFamily"');
    document.body.appendChild(main);

    measureTextWidth('hi', { fontFamily: 'var(--mtw-test), fallback', fontSize: 50 });

    expect(fake.getLastFont()).toContain('"ResolvedFamily"');
    expect(fake.getLastFont()).not.toContain('var(--mtw-test)');
  });

  test('<main>이 없으면(테스트 DOM 기본) var() 토큰이 치환 없이 그대로 ctx.font에 들어간다 — 회귀 없음 확인', () => {
    fake = installFontCapturingCanvas();
    measureTextWidth('hi', { fontFamily: 'var(--mtw-missing), fallback', fontSize: 50 });

    expect(fake.getLastFont()).toContain('var(--mtw-missing)');
  });

  test('var()가 없는 평범한 fontFamily는 그대로 통과한다 — 리터럴 폰트 경로 회귀 없음', () => {
    fake = installFontCapturingCanvas();
    measureTextWidth('hi', { fontFamily: '"JetBrains Mono", monospace', fontSize: 50 });

    expect(fake.getLastFont()).toContain('"JetBrains Mono", monospace');
  });

  // #751 code-review 지적 — 지금까지의 테스트는 전부 가짜 var 이름(--mtw-test 등)만 써서 프로덕션
  // 실제 var 이름(--font-sans)이 진짜 리졸브되는지는 어떤 bun test도 안 봤다(브라우저 --compare
  // 실측으로만 확인됨). beforeEach 리셋 덕에 다른 파일의 오염과 무관하게 안전하게 실제 이름으로
  // 검증할 수 있다 — FONT_SANS/FONT_KR가 실제로 이 경로를 타는지 잠근다.
  test('실제 프로덕션 var 이름(--font-sans)도 <main data-font-root>에서 치환된다', () => {
    fake = installFontCapturingCanvas();
    main = document.createElement('main');
    main.setAttribute('data-font-root', '');
    main.style.setProperty('--font-sans', '"pretendard", "pretendard Fallback"');
    document.body.appendChild(main);

    measureTextWidth('hi', { fontFamily: 'var(--font-sans), "Pretendard Variable", sans-serif', fontSize: 50 });

    expect(fake.getLastFont()).toContain('"pretendard", "pretendard Fallback"');
    expect(fake.getLastFont()).not.toContain('var(--font-sans)');
  });
});
