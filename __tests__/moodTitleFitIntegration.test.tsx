import { describe, expect, test, afterEach } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { FULL_MOVIE, makeMoodBase } from './fixtures';
import type { MovieInfo, TicketComponents } from '../src/types';
import { installFakeCanvasContext } from './setup/canvasStub';

/**
 * #318 claude-review PR #345 P1 — 기존 fitFontSizeToWidth.test.ts는 이진탐색 유틸 자체만
 * 검증했고, 실제 Mood 컴포넌트 안에서 긴 제목이 정말 축소돼 렌더되는지는 아무 테스트도 없었다
 * (기존 6개 Mood resync 테스트는 happy-dom의 canvas.getContext('2d')가 null이라 축소 경로를
 * 안 타고 항상 maxSize 그대로 렌더된다). 이 테스트는 canvas를 목킹해 실제로 shrink 경로가
 * 동작함을 최소 1개 무드(Minimal)에서 확인한다.
 */

const BASE: TicketComponents = {
  layout: 'minimal', chain: '', format: '', chainLabel: '', formatLabel: '',
  material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1, posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false, chainScale: 1, formatScale: 1,
};

describe('MoodMinimal 제목 폭 맞춤 통합 (#318)', () => {
  let restore: () => void;
  afterEach(() => restore?.());

  test('긴 제목은 실제 렌더에서 maxSize(62px)보다 작게 축소된다', () => {
    restore = installFakeCanvasContext().restore;
    // TITLE_AVAIL_WIDTH(820)×TITLE_CLAMP_LINES(2)=1640. widthAt(62)=50×62×0.6=1860>1640(overflow),
    // widthAt(54)=50×54×0.6=1620<=1640(fit), widthAt(55)=1650>1640 — 이진탐색은 54로 수렴한다.
    const longTitle = 'A'.repeat(50);
    const movie: MovieInfo = {
      title: longTitle, titleOg: '', actors: '', rating: 0,
      releaseDate: '', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
      reissueDate: '', isReissue: false,
      watchDate: '', watchDateFormat: 'kr-compact', watchTime: '',
      theater: '', screen: '', seat: '', runtime: '',
      bookingNumber: '', signature: '',
    };
    const html = renderToStaticMarkup(
      <MoodMinimal movieInfo={movie} components={BASE} croppedImageUrl="blob:x" />,
    );
    expect(html).toContain('font-size:54px');
    expect(html).not.toContain('font-size:62px');
  });

  test('짧은 제목은 축소 없이 maxSize(62px) 그대로 렌더된다', () => {
    restore = installFakeCanvasContext().restore;
    const movie: MovieInfo = {
      title: '기생충', titleOg: '', actors: '', rating: 0,
      releaseDate: '', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
      reissueDate: '', isReissue: false,
      watchDate: '', watchDateFormat: 'kr-compact', watchTime: '',
      theater: '', screen: '', seat: '', runtime: '',
      bookingNumber: '', signature: '',
    };
    const html = renderToStaticMarkup(
      <MoodMinimal movieInfo={movie} components={BASE} croppedImageUrl="blob:x" />,
    );
    expect(html).toContain('font-size:62px');
  });
});

/**
 * #440 잔여 스코프(editorial 슬롯 0.667 리사이즈) — POSTER_W 516→640으로 메인 열 가용폭을
 * 648*2→524*2로 재조정했는데, 기존 resync 테스트(moodEditorialResync.test.tsx)는 canvas 목킹이
 * 없어 항상 maxSize(72px)만 보고 이 재조정을 검증하지 못한다. 위 MoodMinimal과 같은 fake
 * canvas + 긴 제목으로 실제 이진탐색이 새 예산을 쓰는지 확인한다.
 */
describe('MoodEditorial 제목 폭 맞춤 통합 (#318, #440)', () => {
  let restore: () => void;
  afterEach(() => restore?.());

  test('긴 제목은 새 가용폭(524*2=1048) 기준으로 58px에 수렴 — 구 예산(648*2=1296)이면 축소 없이 72px', () => {
    restore = installFakeCanvasContext().restore;
    const longTitle = 'A'.repeat(30);
    const html = renderToStaticMarkup(
      <MoodEditorial movieInfo={{ ...FULL_MOVIE, title: longTitle }} components={makeMoodBase('editorial')} croppedImageUrl="blob:x" onField={() => {}} />,
    );
    expect(html).toContain('font-size:58px');
    expect(html).not.toContain('font-size:72px');
  });
});

describe('Mood35mmLandscape 제목 폭 맞춤 통합 (#318, #450)', () => {
  let restore: () => void;
  afterEach(() => restore?.());

  // v5 재설계(#524)로 제목이 포스터 캡션(60px 고정)에서 크레딧 컷 조판(compact, max 28 / min 17)으로
  // 옮겨졌다. 가용폭은 컷 411 - 좌우 패딩 60 = 351, 2줄 클램프라 예산은 351*2.
  const renderTitle = (title: string) =>
    renderToStaticMarkup(
      <Mood35mmLandscape movieInfo={{ ...FULL_MOVIE, title }} components={makeMoodBase('35mm-landscape')} croppedImageUrl="blob:x" onField={() => {}} />,
    );

  test('짧은 제목은 상한 28px 유지', () => {
    restore = installFakeCanvasContext().restore;
    expect(renderTitle('짧은 제목')).toContain('font-size:28px');
  });

  test('긴 제목은 하한 17px까지 축소되고 상한으로 안 남는다', () => {
    restore = installFakeCanvasContext().restore;
    const html = renderTitle('A'.repeat(47));
    expect(html).not.toContain('font-size:28px');
    expect(html).toContain('font-size:17px');
  });
});
