import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { isInkDark } from '../src/components/moods/_shared';
import type { MovieInfo, TicketComponents } from '../src/types';

// #8E4E69: 중간 톤 보라. luminance ≈ 0.12 < 0.18 이라 isInkDark=true 로 분류되지만,
// 사용자가 고른 색이므로 ink로 그대로 반영돼야 한다(이전엔 '#0d0c0a'로 묻혔다, #177).
const DARK_CHROMATIC = '#8E4E69';

const MOVIE: MovieInfo = {
  title: 'TITLE', titleOg: 'ORIGINAL', releaseDate: '2026-05-01',
  releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '', isReissue: false, watchDate: '2026-05-03',
  watchDateFormat: 'kr-compact', watchTime: '20:30', theater: 'CGV',
  screen: 'IMAX', seat: 'G14', actors: 'Actor', rating: 4.5,
  runtime: '150 MIN', bookingNumber: 'BOOK-1234', signature: '@x',
} as MovieInfo;

const BASE: TicketComponents = {
  layout: 'minimal', chain: '', format: '', chainLabel: '', formatLabel: '',
  texture: 'none', posterOpacity: 0.5, themeColor: DARK_CHROMATIC,
  chainVisible: false, formatVisible: false,
} as TicketComponents;

function markup(Mood: typeof MoodMinimal, layout: TicketComponents['layout']) {
  return renderToStaticMarkup(
    <Mood movieInfo={MOVIE} components={{ ...BASE, layout }} croppedImageUrl="blob:test" />
  ).toLowerCase();
}

describe('#177 어두운 유채색 ink 반영', () => {
  test('전제: #8E4E69 는 isInkDark=true (덮어쓰기 분기가 타지던 케이스)', () => {
    expect(isInkDark(DARK_CHROMATIC)).toBe(true);
  });

  // 어두운 유채색을 골라도 ink는 그 색이어야 한다(near-black '#0d0c0a' 로 묻히지 않음).
  test.each([
    ['minimal', MoodMinimal],
    ['criterion', MoodCriterion],
  ] as const)('%s 가 #8E4E69 를 ink로 반영', (layout, Mood) => {
    // 고친 뒤엔 themeColor가 ink로 마크업에 등장한다(이전 분기에선 어디에도 안 나왔다).
    expect(markup(Mood, layout)).toContain('8e4e69');
  });

  test('어떤 무드도 유효 hex 에서 throw 하지 않는다', () => {
    for (const Mood of [MoodMinimal, Mood35mm, MoodCriterion, MoodEditorial]) {
      expect(() => markup(Mood as typeof MoodMinimal, BASE.layout)).not.toThrow();
    }
  });
});
