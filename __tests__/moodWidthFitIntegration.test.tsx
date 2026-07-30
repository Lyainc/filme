import { describe, expect, test, afterEach } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { FULL_MOVIE, makeMoodBase } from './fixtures';
import type { MovieInfo } from '../src/types';
import { installFakeCanvasContext } from './setup/canvasStub';

/**
 * #599 — 무드 단위 **폭 맞춤 다단계** 통합 회귀 (#566 PR #597 리뷰 P1의 지적).
 *
 * `moodTitleFitIntegration.test.tsx`(#318)가 덮는 건 제목 한 단계뿐이다. #566이 넣은
 * Criterion 콜로폰은 단계가 셋이고 서로 예산을 넘긴다:
 *
 *   castPrefix 폭 → castAvailW → truncateActorsToWidth → filmLineText → colophonSize
 *                                                                     → colophonLetterSpacing
 *
 * 헬퍼 각각은 `fitFontSizeToWidth.test.ts`·`truncateActorsToWidth` 테스트가 이미 덮으니
 * **여기서 중복하지 않는다.** 이 파일이 유일하게 덮는 건 그 값들이 실제 무드 컴포넌트를
 * 통과해 조합되는 경로다 — `castPrefix`·`COLOPHON_W`·`COLOPHON_FONT` 중 하나가 바뀌면
 * 헬퍼 테스트는 그대로 그린인데 실제 렌더가 깨지는 조용한 회귀가 가능했다.
 *
 * 기대값은 상수에서 유도하지 않고 손계산해 박았다(#599 soft 제약) — 상수를 읽어 기대값을
 * 만들면 상수가 바뀔 때 테스트가 같이 따라가서 회귀를 못 잡는다. 계산 근거는 케이스마다
 * 주석에 있고, 폭 모형은 `installFakeCanvasContext`의 글리프 폭 = 글자수 × fontSize × 0.6이다.
 */

/** Criterion 콜로폰 컨테이너의 style만 뽑는다 — `top:1370px`이 그 div의 고유 좌표다. */
function colophonStyle(html: string): string {
  const m = /style="[^"]*top:1370px[^"]*"/.exec(html);
  if (!m) throw new Error('Criterion 콜로폰 div(top:1370px)를 마크업에서 못 찾았다');
  return m[0];
}

function renderCriterion(movie: MovieInfo): string {
  return renderToStaticMarkup(
    <MoodCriterion
      movieInfo={movie}
      components={makeMoodBase('criterion')}
      croppedImageUrl="blob:x"
      onField={() => {}}
    />,
  );
}

describe('MoodCriterion 콜로폰 폭 맞춤 다단계 통합 (#599, #566)', () => {
  let restore: () => void;
  afterEach(() => restore?.());

  /**
   * **#575 무한루프와 정확히 같은 조합이다.** 축소 결과가 `floor(maxSize) = floor(17.5) = 16`에
   * 떨어지면 이진탐색의 정수 `mid`가 `lo=16`에 갇혀 while이 안 끝났고, 그걸 막는 건
   * `_shared.tsx`의 `mid === lo` 탈출뿐이다.
   *
   * **검출 방식이 빨간불이 아니라 hang이다** — 실측(2026-07-30): 가드를 지우고 돌리면
   * `bun test --timeout`으로도 안 끊긴다(동기 while 루프라 런타임이 끼어들 틈이 없다).
   * 즉 CI에서 이 회귀는 job 타임아웃으로 드러나고, 그건 여전히 red이지만 6시간을 태운다.
   * 자산화 가치는 그대로 있다(이 조합이 없으면 아무것도 안 잡힌다) — 다만 실패를 봤을 때
   * 어셔션이 아니라 무한루프를 먼저 의심할 것.
   *
   * 손계산 (글리프 폭 = 글자수 × fontSize × 0.6, 자간 0.9는 글자마다 더해짐):
   *   castPrefix = "99분 · RELEASED 2014.03.20. · RE-RELEASED 2023.09.15." = 52자
   *   측정 대상은 구분자까지 = 55자 → 55×17.5×0.6 + 0.9×55 = 577.5 + 49.5 = 627px
   *   castAvailW = COLOPHON_W(792) - 627 = 165px   ← 소스 주석의 실측 165와 일치
   *   full "Ralph Fiennes, Tony Revolori"(28자) = 319.2px > 165 → withMore(1)로 떨어진다
   *   actorsVal = "Ralph Fiennes 외 1명" = 18자 (205.2px — 하한이라 아직 예산 초과다)
   *   filmLineText = 52 + 3 + 18 = 73자
   *   예산 = 792 - 0.9×73 = 726.3
   *   widthAt(17.5) = 766.5 > 726.3(축소 발동) · widthAt(15) = 657 ≤ · widthAt(16) = 700.8 ≤
   *   → lo=16, hi=17.5에서 mid=floor(16.75)=16=lo → 16px
   */
  test('재개봉 ON + 긴 배우명 2인 → 콜로폰이 floor(maxSize)=16px으로 축소된다 (#575 무한루프 조합)', () => {
    restore = installFakeCanvasContext().restore;
    const html = renderCriterion({ ...FULL_MOVIE, runtime: '99분', actors: 'Ralph Fiennes, Tony Revolori' });
    const style = colophonStyle(html);

    expect(style).toContain('font-size:16px');
    expect(style).not.toContain('font-size:17.5px');

    // 1단계가 실제로 발동했는지 — 두 번째 이름은 사라지고 "외 1명"으로 접혀야 한다.
    expect(html).toContain('Ralph Fiennes 외 1명');
    expect(html).not.toContain('Tony Revolori');

    // 자간도 축소분만큼 비례로 줄어야 한다(#590) — base 0.9를 그대로 두면 예산을 다시 넘긴다.
    // 0.9 × (16 / 17.5) = 0.8228…
    const ls = /letter-spacing:([\d.]+)px/.exec(style);
    expect(ls).not.toBeNull();
    expect(Number(ls![1])).toBeCloseTo(0.822857, 5);
  });

  /**
   * 축소가 안 걸리는 쪽 — 예산이 남으면 base 17.5가 그대로 서야 한다. 상한이 조용히
   * 사라지는(항상 축소되는) 회귀를 잡는 반대 방향 케이스.
   *
   * castPrefix = "99분"(3자) → 측정 6자 = 68.4px → castAvailW = 723.6
   * 배우가 한 명(쉼표 없음)이라 truncateActorsToWidth는 그대로 통과 → "랄프 파인즈"(6자)
   * filmLineText = 3 + 3 + 6 = 12자 → widthAt(17.5) = 126 ≤ 예산 781.2 → 축소 없음
   */
  test('짧은 조합은 축소 없이 base 17.5px 유지', () => {
    restore = installFakeCanvasContext().restore;
    const html = renderCriterion({
      ...FULL_MOVIE,
      releaseDate: '', reissueDate: '', isReissue: false,
      runtime: '99분', actors: '랄프 파인즈',
    });
    const style = colophonStyle(html);

    expect(style).toContain('font-size:17.5px');
    expect(style).toContain('letter-spacing:0.9px');
  });

  /**
   * `castAvailW`가 **음수**로 내려가는 극단 — 앞 조각이 행 폭을 다 먹으면 CAST 몫이 음수다.
   * 1단계는 `withMore(1)` 하한에서 멎고(그보다 짧게 만들 방법이 없다), 2단계가 폰트 하한
   * `COLOPHON_MIN_SIZE`까지 내려가 끝난다. 크래시도 무한루프도 없이 수렴해야 한다.
   *
   * runtime 80자 → 측정 83자 = 946.2px → castAvailW = 792 - 946.2 = **-154.2px**
   * actorsVal = "Ralph Fiennes 외 1명"(18자)
   * filmLineText = 80 + 3 + 18 = 101자 → 예산 701.1
   * widthAt(13) = 787.8 > 701.1 → 하한에서도 안 들어가므로 minSize 13px
   */
  test('castAvailW가 음수여도 withMore(1) + 폰트 하한 13px으로 수렴한다', () => {
    restore = installFakeCanvasContext().restore;
    const html = renderCriterion({
      ...FULL_MOVIE,
      releaseDate: '', reissueDate: '', isReissue: false,
      runtime: 'X'.repeat(80), actors: 'Ralph Fiennes, Tony Revolori',
    });
    const style = colophonStyle(html);

    expect(style).toContain('font-size:13px');
    expect(html).toContain('Ralph Fiennes 외 1명');
  });
});

/**
 * Editorial `avec` — Criterion과 같은 `truncateActorsToWidth` 경로지만 예산이 조건부가 아니라
 * 상수(`ACTORS_AVAIL_W`)이고 폰트 축소 단계가 없다. 즉 여기선 1단계가 유일한 방어선이라,
 * 잘린 결과가 예산 안에 들어가는지가 그대로 렌더 오버플로 여부다.
 */
describe('MoodEditorial avec 폭 맞춤 통합 (#599, #566)', () => {
  let restore: () => void;
  afterEach(() => restore?.());

  /**
   * 손계산 (폰트 33, 자간 없음 → 글자당 33×0.6 = 19.8px):
   *   예산 ACTORS_AVAIL_W = 480px → 들어가는 최대 글자수 = floor(480 / 19.8) = 24자
   *   full  = 15+2+15+2+15 = 49자 = 970.2px  > 480 → 축약
   *   n=1: "A…A 외 2명" = 20자 = 396px ≤ 480 ✓
   *   n=2: "A…A, B…B 외 1명" = 37자 = 732.6px > 480 → 여기서 멈춤
   *   → 최종 20자(396px), 예산 480 안쪽이고 24자 상한도 안 넘는다
   */
  test('세 명 중 한 명 + "외 2명"까지만 남기고 예산(480px) 안에 든다', () => {
    restore = installFakeCanvasContext().restore;
    const a = 'A'.repeat(15);
    const html = renderToStaticMarkup(
      <MoodEditorial
        movieInfo={{ ...FULL_MOVIE, actors: `${a}, ${'B'.repeat(15)}, ${'C'.repeat(15)}` }}
        components={makeMoodBase('editorial')}
        croppedImageUrl="blob:x"
        onField={() => {}}
      />,
    );

    const rendered = `${a} 외 2명`;
    expect(html).toContain(rendered);
    expect(html).not.toContain('B'.repeat(15));
    // 렌더된 문자열이 실제로 예산 안이다 — 20자 × 19.8 = 396 ≤ 480.
    expect(rendered.length * 19.8).toBeLessThanOrEqual(480);
  });
});
