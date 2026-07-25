/**
 * #420 → #440 → #525 — 무드의 포스터 fit 렌더 검증(posterFitProps 공통 정책).
 * (claude-review PR #429 2차 P1: ImageCropModal/ImageUploader 배선은 테스트됐지만
 * 실제 사용자가 보는 Poster fit/align/background는 아무 테스트도 exercise 안 함).
 *
 * componentOpacity.test.tsx(#219)와 같은 renderToStaticMarkup + 정규식 패턴 — Poster
 * <img>의 object-fit/object-position, 감싸는 div의 background를 마크업에서 직접 확인한다.
 * #525에서 posterFit 토글('cover')이 폐지돼 **6무드 전부 contain 단일 정책**이다 — 크롭이
 * 포스터 표준 0.667로 서므로, 슬롯 비율과 어긋나 남는 여백은 항상 blur 배경이 덮는다(룰 3·5).
 */
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { MoodStub } from '../src/components/moods/MoodStub';
import { POSTER_FRAME_INSET_Y } from '../src/components/moods/_shared';
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
  chainVisible: true, formatVisible: true, chainScale: 1, formatScale: 1,
};

function render(Mood: typeof MoodMinimal, themeColor = '#FFFFFF') {
  return renderToStaticMarkup(
    <Mood
      movieInfo={MOVIE}
      components={{ ...BASE, themeColor }}
      croppedImageUrl="blob:test"
    />
  );
}

// 전경 포스터 <img> 특정 — 배경 blur <img>(data-poster-bg, object-position 없음)가
// 앞서므로 object-position을 가진 전경만 잡는다(#440 레터박스 blur 배경).
const POSTER_IMG = /<img[^>]*object-position[^>]*>/;
// Poster 래퍼 div(aria-hidden, data-poster-root, background 보유) — style의 마지막 선언이 background
// (_shared.tsx 순서). aria-hidden과 style 사이에 data-poster-root(#439)가 끼므로 [^>]*로 흡수한다.
const POSTER_WRAPPER_BG = /aria-hidden="true"[^>]*style="[^"]*background:([^";]*)"/;
// 레터박스 채움용 blur 포스터 배경(#440).
const POSTER_BG_BLUR = /<img[^>]*data-poster-bg="true"[^>]*blur\(/;
// frameInsetY 사이징 wrapper(#449) — 선명 포스터 img를 감싸는 div의 top/bottom 인셋.
// _shared.tsx Poster의 style 선언 순서(position→top→bottom→left→right)에 그대로 대응.
// React는 style 값이 0이면 단위(px)를 안 붙인다 — frameInsetY 미배선 무드는 unit 없이 "0"으로
// 나오므로 px suffix를 옵셔널로 둔다. left/right는 항상 0(unit 없음).
const POSTER_FRAME_WRAPPER = /<div style="position:absolute;top:(-?\d+)(?:px)?;bottom:(-?\d+)(?:px)?;left:0;right:0">/;

// 6무드 전부가 만족해야 하는 단일 정책(#525) — contain + 중앙 정렬 + blur 레터박스 배경.
describe.each([
  ['minimal', MoodMinimal],
  ['criterion', MoodCriterion],
  ['35mm', Mood35mm],
  ['editorial', MoodEditorial],
  ['stub', MoodStub],
] as const)('#525 포스터 fit 단일 정책 — %s', (_name, Mood) => {
  test('object-fit:contain, 중앙 정렬(#449, 구 top 정렬 폐기)', () => {
    const img = render(Mood).match(POSTER_IMG)?.[0] ?? '';
    expect(img).toContain('object-fit:contain');
    expect(img).toContain('object-position:50% 50%');
  });

  test('남는 여백은 blur 포스터 배경이 덮는다(#440 → #525 룰 3)', () => {
    expect(render(Mood)).toMatch(POSTER_BG_BLUR);
  });
});

// 풀블리드 2무드(minimal·criterion)만 frameInsetY로 상하 블러 레터박스 최소 노출을 보장한다.
// 나머지는 자연 간극이 이미 크거나 별도 컬럼 레이아웃이라 #449 스코프 밖(인셋 0) — 35mm은
// v5(#524)에서 풀블리드가 아니라 고정 0.667 컷이 돼서 여기로 내려왔다(강제 띠 = 레터박스 0 파괴).
describe.each([
  ['minimal', MoodMinimal, POSTER_FRAME_INSET_Y],
  ['criterion', MoodCriterion, POSTER_FRAME_INSET_Y],
  ['35mm', Mood35mm, 0],
  ['editorial', MoodEditorial, 0],
  ['stub', MoodStub, 0],
] as const)('#449 frameInsetY — %s', (_name, Mood, inset) => {
  test(`위/아래 인셋 ${inset}px`, () => {
    const m = render(Mood).match(POSTER_FRAME_WRAPPER);
    expect(m?.[1]).toBe(String(inset));
    expect(m?.[2]).toBe(String(inset));
  });
});

describe('레터박스 배경색', () => {
  test.each([
    ['minimal', MoodMinimal],
    ['criterion', MoodCriterion],
  ] as const)('%s — 테마(ink)에 맞춰 갈린다', (_name, Mood) => {
    // themeColor='#FFFFFF'(밝은 잉크, inkIsDark=false) → 어두운 letterbox.
    expect(render(Mood, '#FFFFFF').match(POSTER_WRAPPER_BG)?.[1]).toBe('#0a0a0a');
    // themeColor='#000000'(luminance 낮음 → inkIsDark=true, 어두운 잉크) → 크림 letterbox.
    expect(render(Mood, '#000000').match(POSTER_WRAPPER_BG)?.[1]).toBe('#f5f0e8');
  });

  test('35mm — 컷 배경 검정 고정, 테마 무관(v5부터 amber도 하드코딩, #524 c8)', () => {
    expect(render(Mood35mm, '#FFFFFF').match(POSTER_WRAPPER_BG)?.[1]).toBe('#000');
    expect(render(Mood35mm, '#000000').match(POSTER_WRAPPER_BG)?.[1]).toBe('#000');
  });
});

// v5 재설계(#524)로 35mm 계열은 풀블리드 슬롯을 안 쓴다 — 포스터가 고정 비율 컷 안에 갇히므로
// 컷이 fit을 정한다. 세로 컷 560×840은 정확히 0.667이라 표준 크롭이 contain으로 레터박스 0이 되고,
// 가로 컷 926×617(3:2)은 세로 크롭을 cover로 채운다(#525 단일 정책의 명시적 예외 — 근거는 무드 주석).
describe('#524 35mm 계열 컷 fit', () => {
  test('35mm 포스터 컷(0.667) — contain이지만 frameInsetY는 0(강제 레터박스 띠가 레터박스 0을 깨뜨린다)', () => {
    const m = render(Mood35mm).match(POSTER_FRAME_WRAPPER);
    expect(m?.[1]).toBe('0');
    expect(m?.[2]).toBe('0');
  });

  test('35mm Wide 포스터 컷(3:2) — object-fit:cover, blur 레터박스 배경 없음', () => {
    const html = render(Mood35mmLandscape);
    expect((html.match(POSTER_IMG)?.[0] ?? '')).toContain('object-fit:cover');
    expect(html).not.toContain('data-poster-bg');
  });
});
