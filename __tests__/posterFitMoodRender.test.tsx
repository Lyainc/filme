/**
 * #420 → #440 — 무드의 posterFit 렌더 분기 검증(posterFitProps 공통 정책 통일).
 * (claude-review PR #429 2차 P1: ImageCropModal/ImageUploader 배선은 테스트됐지만
 * 실제 사용자가 보는 Poster fit/align/background 분기는 아무 테스트도 exercise 안 함).
 *
 * componentOpacity.test.tsx(#219)와 같은 renderToStaticMarkup + 정규식 패턴 — Poster
 * <img>의 object-fit/object-position, 감싸는 div의 background가 posterFit(+테마)에
 * 따라 실제로 바뀌는지 마크업에서 직접 확인한다. #440에서 35mm의 contain 하드코딩이
 * 제거돼 전 무드가 posterFit을 일관되게 읽는다(35mm도 cover 토글 시 cover).
 */
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import type { MovieInfo, TicketComponents } from '../src/types';

const MOVIE: MovieInfo = {
  title: 'TITLE', titleOg: 'ORIGINAL', releaseDate: '2026-05-01',
  releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '', isReissue: false, watchDate: '2026-05-03',
  watchDateFormat: 'kr-compact', watchTime: '20:30', theater: 'CGV',
  screen: 'IMAX', seat: 'G14', actors: 'Actor', rating: 4.5,
  runtime: '150 MIN', bookingNumber: 'BOOK-1234', signature: '@x',
};

const BASE: TicketComponents = {
  layout: 'minimal', chain: '', format: '', chainLabel: '', formatLabel: '',
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true, posterFit: 'cover',
};

function render(
  Mood: typeof MoodMinimal,
  posterFit: 'cover' | 'contain',
  themeColor = '#FFFFFF'
) {
  return renderToStaticMarkup(
    <Mood
      movieInfo={MOVIE}
      components={{ ...BASE, posterFit, themeColor }}
      croppedImageUrl="blob:test"
    />
  );
}

const POSTER_IMG = /<img[^>]*crossorigin="anonymous"[^>]*>/;
// Poster 래퍼 div(aria-hidden, background 보유) — style의 마지막 선언이 background(_shared.tsx 순서).
const POSTER_WRAPPER_BG = /aria-hidden="true" style="[^"]*background:([^";]*)"/;

describe.each([
  ['minimal', MoodMinimal],
  ['criterion', MoodCriterion],
] as const)('#420 posterFit 렌더 분기 — %s', (_name, Mood) => {
  test('posterFit=cover → object-fit:cover, 중앙 정렬(기존 동작)', () => {
    const img = render(Mood, 'cover').match(POSTER_IMG)?.[0] ?? '';
    expect(img).toContain('object-fit:cover');
    expect(img).toContain('object-position:50% 50%');
  });

  test('posterFit=contain → object-fit:contain, 상단 정렬', () => {
    const img = render(Mood, 'contain').match(POSTER_IMG)?.[0] ?? '';
    expect(img).toContain('object-fit:contain');
    expect(img).toContain('object-position:50% 0%');
  });

  test('posterFit=cover → letterbox 배경은 Poster 기본값(#0a0a0a), 테마 무관', () => {
    expect(render(Mood, 'cover').match(POSTER_WRAPPER_BG)?.[1]).toBe('#0a0a0a');
    expect(render(Mood, 'cover', '#000000').match(POSTER_WRAPPER_BG)?.[1]).toBe('#0a0a0a');
  });

  test('posterFit=contain → letterbox 배경이 테마(ink)에 맞춰 갈린다', () => {
    // themeColor='#FFFFFF'(밝은 잉크, inkIsDark=false) → 어두운 letterbox.
    expect(render(Mood, 'contain', '#FFFFFF').match(POSTER_WRAPPER_BG)?.[1]).toBe('#0a0a0a');
    // themeColor='#000000'(luminance 낮음 → inkIsDark=true, 어두운 잉크) → 크림 letterbox.
    expect(render(Mood, 'contain', '#000000').match(POSTER_WRAPPER_BG)?.[1]).toBe('#f5f0e8');
  });
});

describe('#440 posterFit 렌더 분기 — 35mm(정책 통일: contain 하드코딩 제거)', () => {
  test('posterFit=cover → object-fit:cover, 중앙 정렬', () => {
    const img = render(Mood35mm, 'cover').match(POSTER_IMG)?.[0] ?? '';
    expect(img).toContain('object-fit:cover');
    expect(img).toContain('object-position:50% 50%');
  });

  test('posterFit=contain(기본) → object-fit:contain, 중앙 정렬(상하 레터박스)', () => {
    const img = render(Mood35mm, 'contain').match(POSTER_IMG)?.[0] ?? '';
    expect(img).toContain('object-fit:contain');
    expect(img).toContain('object-position:50% 50%');
  });

  test('letterbox 배경은 FS_BASE(#0a0a0a)로 고정 — posterFit 무관', () => {
    expect(render(Mood35mm, 'cover').match(POSTER_WRAPPER_BG)?.[1]).toBe('#0a0a0a');
    expect(render(Mood35mm, 'contain').match(POSTER_WRAPPER_BG)?.[1]).toBe('#0a0a0a');
  });
});
