import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// Criterion 한줄평 메타데이터(#391) — 유저 입력 → 평점(0.5 단위) 프리셋 → 기본 quote 폴백 체인,
// 한글 입력 시 FONT_QUOTE_KR(손글씨) 분기 회귀 테스트.

const BASE = makeMoodBase('criterion');

const markup = (movieInfo: typeof FULL_MOVIE, fieldVisibility?: Record<string, boolean>) =>
  renderToStaticMarkup(
    <MoodCriterion
      movieInfo={movieInfo}
      components={BASE}
      croppedImageUrl="blob:x"
      onField={() => {}}
      fieldVisibility={fieldVisibility as never}
    />
  );

describe('Criterion 한줄평 폴백 체인 (#391)', () => {
  test('유저 입력이 있으면 그 텍스트를 그대로 노출', () => {
    const html = markup({ ...FULL_MOVIE, quote: 'a perfect Sunday matinee' });
    expect(html).toContain('a perfect Sunday matinee');
    expect(html).not.toContain('nearly perfect, and knows it');
  });

  test('유저 입력이 없으면 평점(4.5) 구간 프리셋으로 폴백', () => {
    const html = markup({ ...FULL_MOVIE, quote: '' });
    expect(html).toContain('nearly perfect, and knows it');
  });

  test('유저 입력·평점 둘 다 없으면 기본 quote로 폴백', () => {
    const html = markup({ ...FULL_MOVIE, quote: '', rating: 0 });
    expect(html).toContain('the paying customer is the last honest critic');
  });

  test('fieldVisibility.quote가 꺼지면 유저 입력 대신 프리셋으로 폴백', () => {
    const html = markup({ ...FULL_MOVIE, quote: 'a perfect Sunday matinee' }, { quote: false });
    expect(html).not.toContain('a perfect Sunday matinee');
    expect(html).toContain('nearly perfect, and knows it');
  });

  // claude-review PR #407 P1: quote 프리셋은 fv?.rating(RATED 셀 노출 여부)과 무관하게 원본
  // d.rating으로 고른다 — 의도된 동작(RATED 행을 꺼도 quote는 실제 평점을 반영)임을 고정.
  test('RATED 셀 노출을 꺼도(fv.rating=false) quote는 실제 평점 기준 프리셋 유지', () => {
    const html = markup({ ...FULL_MOVIE, quote: '' }, { rating: false });
    expect(html).toContain('nearly perfect, and knows it');
    expect(html).not.toContain('★ 4.5 / 5.0'); // RATED 셀 자체는 안 보임
  });

  test('한글 유저 입력은 FONT_QUOTE_KR(--font-quote-kr)로 분기', () => {
    const html = markup({ ...FULL_MOVIE, quote: '인생 영화였다' });
    expect(html).toContain('인생 영화였다');
    expect(html).toContain('--font-quote-kr');
  });

  test('영문(프리셋) quote는 FONT_DISPLAY 유지 — --font-quote-kr 미사용', () => {
    // signature도 #423에서 언어 분기가 붙었으니(한글 서명 → FONT_QUOTE_KR), quote 자체의
    // 폰트 분기만 격리해서 보려면 signature를 영문으로 둬야 한다(FULL_MOVIE.signature는 한글).
    const html = markup({ ...FULL_MOVIE, quote: '', signature: 'Alex Carter' });
    expect(html).not.toContain('--font-quote-kr');
  });

  test('한줄평은 FieldTap 편집 타깃(aria-label) 노출', () => {
    const html = markup({ ...FULL_MOVIE, quote: '' });
    expect(html).toContain('한줄평 편집');
  });

  // 서명(signature) 폰트도 한줄평과 동일하게 언어 분기(#423) — 값이 아니라 라벨(collected by)
  // 자리는 항상 FONT_DISPLAY 이탤릭이므로, 값 쪽만 갈리는지로 좁혀서 확인.
  test('한글 서명은 --font-quote-kr, 영문 서명은 FONT_DISPLAY 이탤릭으로 분기', () => {
    const krHtml = markup({ ...FULL_MOVIE, signature: '박지수' });
    expect(krHtml).toContain('박지수');
    expect(krHtml).toContain('--font-quote-kr');

    const enHtml = markup({ ...FULL_MOVIE, quote: '', signature: 'Alex Carter' });
    expect(enHtml).toContain('Alex Carter');
    expect(enHtml).not.toContain('--font-quote-kr');
  });
});
