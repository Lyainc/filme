import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { MoodStub } from '../src/components/moods/MoodStub';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
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
  material: 'original', coating: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: DARK_CHROMATIC,
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

  // 타이핑/삭제 중 ColorPicker가 emit하는 불완전 hex('#8E')는 무효 CSS color라
  // 잉크로 새면 텍스트가 투명해진다 — resolveInk가 fallback으로 떨궈야 한다(#177 리뷰 P1).
  test.each([
    ['minimal', MoodMinimal],
    ['criterion', MoodCriterion],
  ] as const)('%s 가 불완전 hex(#8E)는 잉크로 안 쓴다', (layout, Mood) => {
    const html = renderToStaticMarkup(
      <Mood movieInfo={MOVIE} components={{ ...BASE, layout, themeColor: '#8E' }} croppedImageUrl="blob:test" />
    ).toLowerCase();
    // 무효 hex가 color:로 새지 않는다 — fallback(#0d0c0a)이 쓰인다.
    expect(html).not.toContain('color:#8e');
    expect(html).toContain('#0d0c0a');
  });

  test('editorial 도 불완전 hex(#8E)를 accent로 안 쓴다', () => {
    const html = renderToStaticMarkup(
      <MoodEditorial movieInfo={MOVIE} components={{ ...BASE, layout: 'editorial', themeColor: '#8E' }} croppedImageUrl="blob:test" />
    ).toLowerCase();
    expect(html).not.toContain('color:#8e');
  });

  test('어떤 무드도 유효 hex 에서 throw 하지 않는다', () => {
    for (const Mood of [MoodMinimal, Mood35mm, MoodCriterion, MoodEditorial, MoodStub, Mood35mmLandscape]) {
      expect(() => markup(Mood as typeof MoodMinimal, BASE.layout)).not.toThrow();
    }
  });
});
