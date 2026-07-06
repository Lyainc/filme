/**
 * #216 회귀 테스트 — 빈 항목 미리보기(ghost) 모드.
 *
 * 검증 3축(데스크톱 보존이 핵심):
 * 1. ghost={true} + 빈 필드 + visible → 각 무드에 dashed 자리표시자(data-hide-on-export) 등장.
 * 2. ghost={false} → 스탬프 포함 어떤 placeholder도 없음.
 * 3. ghost={undefined}(데스크톱) → 필드 placeholder는 없고, 스탬프 placeholder는 오늘처럼 유지.
 *    + 값이 채워진 필드는 ghost={true}여도 placeholder를 만들지 않음(빈 필드만 대상).
 */
import React from 'react';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { stampWillRender } from '../src/components/moods/_shared';
import type { MovieInfo, TicketComponents, TicketField, LayoutId } from '../src/types';

const FIELDS: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime', 'theater', 'screen',
  'seat', 'runtime', 'rating', 'releaseDate', 'reissue', 'bookingNo', 'signature',
];
const ALL_ON = Object.fromEntries(FIELDS.map((f) => [f, true])) as Record<TicketField, boolean>;

const EMPTY_MOVIE: MovieInfo = {
  title: '', titleOg: '', actors: '', rating: 0,
  releaseDate: '', reissueDate: '', isReissue: true,
  watchDate: '', watchTime: '', theater: '', screen: '', seat: '',
  runtime: '', bookingNumber: '', signature: '',
};

const FULL_MOVIE: MovieInfo = {
  title: 'TITLEDATA', titleOg: 'ORIGINALDATA', actors: 'ActorData', rating: 4.5,
  releaseDate: '2026-05-01', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '2026-05-02', isReissue: true,
  watchDate: '2026-05-03', watchDateFormat: 'kr-compact', watchTime: '20:30',
  theater: 'CGVDATA', screen: 'IMAXDATA', seat: 'G14', runtime: '150 MIN',
  bookingNumber: 'BOOK-1234', signature: 'SIGDATA',
};

const BASE: TicketComponents = {
  layout: 'minimal', chain: '', format: '', chainLabel: '', formatLabel: '',
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false,
};

const MOODS = [
  ['minimal', MoodMinimal],
  ['35mm', Mood35mm],
  ['criterion', MoodCriterion],
  ['editorial', MoodEditorial],
] as const;

type MoodFn = (props: {
  movieInfo: MovieInfo;
  components: TicketComponents;
  croppedImageUrl: string;
  fieldVisibility?: Record<TicketField, boolean>;
  ghost?: boolean;
}) => React.ReactElement;

function render(
  Mood: MoodFn,
  layout: LayoutId,
  movie: MovieInfo,
  components: Partial<TicketComponents>,
  ghost: boolean | undefined,
) {
  return renderToStaticMarkup(
    <Mood
      movieInfo={movie}
      components={{ ...BASE, ...components, layout }}
      croppedImageUrl="blob:test"
      fieldVisibility={ALL_ON}
      ghost={ghost}
    />,
  );
}

const HIDE_ON_EXPORT = 'data-hide-on-export="true"';
function countGhosts(html: string): number {
  return html.split(HIDE_ON_EXPORT).length - 1;
}

describe('ghost mode field placeholders (#216)', () => {
  test.each(MOODS)('%s: ghost=true + 빈 필드 → dashed 자리표시자 + TITLE 힌트 등장', (layout, Mood) => {
    const html = render(Mood, layout, EMPTY_MOVIE, {}, true);
    expect(countGhosts(html)).toBeGreaterThan(0);
    // 모든 무드 공통: 제목 슬롯 아톰 ghost의 "TITLE" 힌트.
    expect(html).toContain('TITLE');
  });

  test.each(MOODS)('%s: ghost=false → 어떤 placeholder도 없음(스탬프 off)', (layout, Mood) => {
    const html = render(Mood, layout, EMPTY_MOVIE, {}, false);
    expect(countGhosts(html)).toBe(0);
  });

  test.each(MOODS)('%s: ghost=undefined(데스크톱) → 필드 placeholder 없음', (layout, Mood) => {
    const html = render(Mood, layout, EMPTY_MOVIE, {}, undefined);
    // 스탬프 off라 아무 placeholder도 없어야 하고, 특히 필드 힌트(CAST/SIGNATURE/TITLE)가 없어야 함.
    expect(countGhosts(html)).toBe(0);
    expect(html).not.toContain('SIGNATURE');
  });

  test.each(MOODS)('%s: 값이 채워진 필드는 ghost=true여도 placeholder 없음', (layout, Mood) => {
    const html = render(Mood, layout, FULL_MOVIE, {}, true);
    expect(countGhosts(html)).toBe(0);
  });
});

describe('ghost mode stamp gating (#216)', () => {
  // 스탬프 placeholder는 ghost !== false일 때 렌더. chainVisible=true + 이미지/라벨 없음.
  test.each(MOODS)('%s: ghost=undefined(데스크톱) → 스탬프 placeholder 유지', (layout, Mood) => {
    const html = render(Mood, layout, EMPTY_MOVIE, { chainVisible: true, formatVisible: true }, undefined);
    expect(html).toContain(HIDE_ON_EXPORT);
    expect(html).toContain('LOGO');
    expect(html).toContain('FORMAT');
  });

  test.each(MOODS)('%s: ghost=true → 스탬프 placeholder 유지', (layout, Mood) => {
    const html = render(Mood, layout, EMPTY_MOVIE, { chainVisible: true, formatVisible: true }, true);
    expect(html).toContain('LOGO');
    expect(html).toContain('FORMAT');
  });

  test.each(MOODS)('%s: ghost=false → 스탬프 placeholder 숨김', (layout, Mood) => {
    const html = render(Mood, layout, EMPTY_MOVIE, { chainVisible: true, formatVisible: true }, false);
    expect(html).not.toContain('LOGO');
    expect(html).not.toContain('FORMAT');
    expect(countGhosts(html)).toBe(0);
  });
});

describe('ghost mode stamp divider gating (#216 P1.1)', () => {
  // 구분선 <span>은 인라인 스타일 `width:1px`가 유일 시그니처(무드별 vertical divider 전용).
  const DIVIDER = 'width:1px';

  test.each(MOODS)('%s: ghost=undefined(데스크톱) + 로고 없음 → 스탬프 placeholder + 구분선 유지', (layout, Mood) => {
    const html = render(Mood, layout, EMPTY_MOVIE, { chainVisible: true, formatVisible: true }, undefined);
    expect(countGhosts(html)).toBe(2); // LOGO + FORMAT placeholder
    expect(html).toContain(DIVIDER);
  });

  test.each(MOODS)('%s: ghost=false + 로고 없음 → 두 스탬프 null → 구분선도 사라짐', (layout, Mood) => {
    const html = render(Mood, layout, EMPTY_MOVIE, { chainVisible: true, formatVisible: true }, false);
    expect(html).not.toContain(DIVIDER);
  });

  test('stampWillRender: image>label>placeholder(ghost!==false) 조건', () => {
    expect(stampWillRender(true, '', '', false)).toBe(false); // visible·로고없음·ghost off → null
    expect(stampWillRender(true, '', '', undefined)).toBe(true); // 데스크톱 placeholder 렌더
    expect(stampWillRender(true, '', '', true)).toBe(true); // ghost on placeholder 렌더
    expect(stampWillRender(true, '', 'CGV', false)).toBe(true); // 라벨은 ghost off여도 렌더
    expect(stampWillRender(true, 'blob:x', '', false)).toBe(true); // 이미지
    expect(stampWillRender(false, 'blob:x', 'CGV', undefined)).toBe(false); // 비가시
  });

  // MoodMinimal은 상단 스크림(height:180px 그라디언트)을 hasTopStamp로 게이팅한다 — 두 스탬프가
  // 하나도 렌더 안 되면 스크림도 사라져야 함(#216 리뷰 P1: 로고없음+ghost=false 빈 스크림 잔류 방지).
  // 다른 3무드는 배경 없는 flex라 무관. height:180px는 MoodMinimal 상단 스크림 전용 시그니처.
  const MINIMAL_TOP_SCRIM = 'height:180px';

  test('minimal: ghost=undefined(데스크톱) + 로고 없음 → 상단 스크림 유지', () => {
    const html = render(MoodMinimal, 'minimal', EMPTY_MOVIE, { chainVisible: true, formatVisible: true }, undefined);
    expect(html).toContain(MINIMAL_TOP_SCRIM);
  });

  test('minimal: ghost=false + 로고 없음 → 두 스탬프 null → 상단 스크림도 사라짐', () => {
    const html = render(MoodMinimal, 'minimal', EMPTY_MOVIE, { chainVisible: true, formatVisible: true }, false);
    expect(html).not.toContain(MINIMAL_TOP_SCRIM);
  });
});
