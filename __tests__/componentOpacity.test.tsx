/**
 * #219 componentOpacity — 무드 렌더 sanity + 축 독립 회귀.
 *
 * (1) 4종 무드가 componentOpacity=1(기본) 그리고 분수값(0.5)에서 모두 throw 없이 렌더된다.
 * (2) opacity가 실제로 먹는다: 1 렌더 ≠ 0.5 렌더(오버레이 래퍼/열 opacity가 마크업에 반영).
 * (3) 포스터는 영향 없음(축 독립): componentOpacity를 바꿔도 Poster <img>(crossorigin) 태그는
 *     동일 — 즉 Poster는 opacity 래퍼 바깥에 있다(posterOpacity/밝기와 분리).
 */
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { MoodStub } from '../src/components/moods/MoodStub';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
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
  material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1, posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true, chainScale: 1, formatScale: 1, posterFit: 'cover',
};

const MOODS = [
  ['minimal', MoodMinimal],
  ['35mm', Mood35mm],
  ['criterion', MoodCriterion],
  ['editorial', MoodEditorial],
  ['stub', MoodStub],
  ['35mm-landscape', Mood35mmLandscape],
] as const;

function render(Mood: typeof MoodMinimal, componentOpacity: number) {
  return renderToStaticMarkup(
    <Mood
      movieInfo={MOVIE}
      components={{ ...BASE, componentOpacity }}
      croppedImageUrl="blob:test"
    />
  );
}

const POSTER_IMG = /<img[^>]*crossorigin="anonymous"[^>]*>/;

describe('#219 componentOpacity', () => {
  test.each(MOODS)('%s: opacity 1·0.5 둘 다 throw 없이 렌더', (_layout, Mood) => {
    expect(() => render(Mood as typeof MoodMinimal, 1)).not.toThrow();
    expect(() => render(Mood as typeof MoodMinimal, 0.5)).not.toThrow();
  });

  test.each(MOODS)('%s: componentOpacity가 마크업에 반영(1 ≠ 0.5)', (_layout, Mood) => {
    expect(render(Mood as typeof MoodMinimal, 1)).not.toBe(
      render(Mood as typeof MoodMinimal, 0.5)
    );
  });

  test.each(MOODS)('%s: 포스터 <img>는 componentOpacity와 무관(래퍼 바깥)', (_layout, Mood) => {
    const img1 = render(Mood as typeof MoodMinimal, 1).match(POSTER_IMG)?.[0];
    const img05 = render(Mood as typeof MoodMinimal, 0.5).match(POSTER_IMG)?.[0];
    expect(img1).toBeTruthy();
    expect(img05).toBe(img1);
  });
});
