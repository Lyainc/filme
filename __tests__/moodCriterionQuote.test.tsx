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
    expect(html).not.toContain('close to unforgettable');
  });

  test('유저 입력이 없으면 평점(4.5) 구간 프리셋으로 폴백', () => {
    const html = markup({ ...FULL_MOVIE, quote: '' });
    expect(html).toContain('close to unforgettable');
  });

  test('유저 입력·평점 둘 다 없으면 기본 quote로 폴백', () => {
    const html = markup({ ...FULL_MOVIE, quote: '', rating: 0 });
    expect(html).toContain('every ticket, a small piece of a bigger story');
  });

  test('fieldVisibility.quote가 꺼지면 유저 입력 대신 프리셋으로 폴백', () => {
    const html = markup({ ...FULL_MOVIE, quote: 'a perfect Sunday matinee' }, { quote: false });
    expect(html).not.toContain('a perfect Sunday matinee');
    expect(html).toContain('close to unforgettable');
  });

  test('한글 유저 입력은 FONT_QUOTE_KR(--font-quote-kr)로 분기', () => {
    const html = markup({ ...FULL_MOVIE, quote: '인생 영화였다' });
    expect(html).toContain('인생 영화였다');
    expect(html).toContain('--font-quote-kr');
  });

  test('영문(프리셋) quote는 FONT_DISPLAY 유지 — --font-quote-kr 미사용', () => {
    const html = markup({ ...FULL_MOVIE, quote: '' });
    expect(html).not.toContain('--font-quote-kr');
  });

  test('한줄평은 FieldTap 편집 타깃(aria-label) 노출', () => {
    const html = markup({ ...FULL_MOVIE, quote: '' });
    expect(html).toContain('한줄평 편집');
  });
});
