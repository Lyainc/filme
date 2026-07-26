import React from 'react';
import type { ComponentType } from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { isInkDark, resolveInk } from '../src/components/moods/_shared';
import { TONE_FIXED_MOODS } from '../src/constants/fields';
import type { LayoutId, MovieInfo, TicketComponents } from '../src/types';
import { ALL_MOODS } from './setup/moods';
import type { MoodProps } from '../src/components/moods/_shared';

// #8E4E69: 중간 톤 보라. luminance ≈ 0.12 < 0.18 이라 isInkDark=true 로 분류되지만,
// 사용자가 고른 색이므로 ink로 그대로 반영돼야 한다(이전엔 '#0d0c0a'로 묻혔다, #177).
//
// v5 재설계(#524 c10) — 35mm · 35mm Wide · Criterion 3무드는 시안 색을 하드코딩해 themeColor
// 파생을 버렸다(c8). "6무드 전부 themeColor→ink 파생"이라는 이 파일의 단언은 그 3무드에
// 성립하지 않으므로 대상을 Minimal(+ Editorial accent)로 좁힌다. 죽은 ColorPicker는 테스트가
// 아니라 TONE_FIXED_MOODS(src/constants/fields.ts)가 비활성화로 막는다.
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

function markup(Mood: ComponentType<MoodProps>, layout: TicketComponents['layout']) {
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
  ] as const)('%s 가 #8E4E69 를 ink로 반영', (layout, Mood) => {
    // 고친 뒤엔 themeColor가 ink로 마크업에 등장한다(이전 분기에선 어디에도 안 나왔다).
    expect(markup(Mood, layout)).toContain('8e4e69');
  });

  // 타이핑/삭제 중 ColorPicker가 emit하는 불완전 hex('#8E')는 무효 CSS color라 잉크로 새면
  // 텍스트가 투명해진다(#177 리뷰 P1). 이건 resolveInk 자체의 계약이라 헬퍼에 직접 건다 —
  // 무드 케이스만 남기면 그 무드가 톤 고정 무드로 넘어갈 때 가드도 같이 사라진다.
  test('resolveInk가 불완전 hex(#8E)를 fallback으로 떨군다', () => {
    expect(resolveInk('#8E', '#0d0c0a')).toBe('#0d0c0a');
    expect(resolveInk(DARK_CHROMATIC, '#0d0c0a')).toBe(DARK_CHROMATIC);
  });

  test.each([
    ['minimal', MoodMinimal],
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
    for (const [, Mood] of ALL_MOODS) {
      expect(() => markup(Mood, BASE.layout)).not.toThrow();
    }
  });
});

/**
 * TONE_FIXED_MOODS 표-대-렌더 대조(#524) — 표가 렌더 동작과 어긋나면 두 방향 모두 사용자에게
 * 샌다: 표에서 빠진 톤 고정 무드는 아무 일도 안 하는 ColorPicker를 남기고, 표에 잘못 들어간
 * 무드는 살아있는 컨트롤을 잠근다. 앞으로 무드가 시안 색을 하드코딩할 때마다 편집자가 표를
 * 같이 고쳤는지 여기서 잡는다(launcherFieldGating의 "런처 필드 = 무드 렌더 필드"와 같은 성격).
 */
describe('TONE_FIXED_MOODS = themeColor를 안 읽는 무드 (#524)', () => {
  test.each(ALL_MOODS)('%s', (layout, Mood) => {
    const ignoresTheme = markup(Mood, layout as LayoutId) === renderToStaticMarkup(
      <Mood movieInfo={MOVIE} components={{ ...BASE, layout, themeColor: '#FFFFFF' }} croppedImageUrl="blob:test" />
    ).toLowerCase();
    expect(ignoresTheme).toBe(TONE_FIXED_MOODS.has(layout as LayoutId));
  });
});
