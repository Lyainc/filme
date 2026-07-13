/**
 * #347 — 로고 스탬프 폭 상한.
 *
 * 크롭이 자유 종횡비로 풀리면서(ImageCropModal, #347) 좌우로 아주 긴 워드마크가 그대로 올라올 수
 * 있게 됐다. 스탬프는 height 고정·width auto라 폭 상한이 없으면 티켓 경계를 넘거나 옆 텍스트와
 * 겹치므로, `STAMP_MAX_ASPECT`(높이×5)로 폭만 막고 objectFit:contain으로 종횡비를 유지한다.
 *
 * 1) 렌더: 무드가 그리는 로고 img에 max-width + object-fit:contain이 실제로 붙는가.
 * 2) 예산: 두 스탬프가 상한까지 늘어나도 무드의 스탬프 그룹이 가용 폭 안에 들어오는가.
 *    happy-dom엔 레이아웃 엔진이 없어 실제 겹침을 못 재므로, 무드의 실좌표(오프셋·gap·높이)로
 *    산술 검증한다. 무드 좌표를 바꾸면서 상한을 안 맞추면 여기서 깨진다.
 */
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { STAMP_MAX_ASPECT } from '../src/components/moods/_shared';
import type { MovieInfo, TicketComponents } from '../src/types';

const MOVIE: MovieInfo = {
  title: '그랜드 부다페스트 호텔', titleOg: 'The Grand Budapest Hotel', actors: '랄프 파인즈', rating: 4.5,
  releaseDate: '2014-03-20', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '', isReissue: false,
  watchDate: '2024-03-15', watchDateFormat: 'kr-compact', watchTime: '19:30',
  theater: '메가박스 코엑스', screen: 'Dolby Cinema', seat: 'G14', runtime: '99분',
  bookingNumber: 'BOOK-1234', signature: '영화수집가',
};

// 이미지 + 라벨을 둘 다 채워, '이미지가 라벨보다 우선'(#141) 규칙도 같이 본다.
// #348부터 formatLabel이 OCR로 자동 채워지므로 둘이 공존하는 상태가 실제 경로다.
const WITH_LOGOS: TicketComponents = {
  layout: 'minimal', chain: 'blob:chain-logo', format: 'blob:format-logo',
  chainLabel: 'MEGABOX', formatLabel: 'DOLBY',
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true,
};

const minimalMarkup = () =>
  renderToStaticMarkup(<MoodMinimal movieInfo={MOVIE} components={WITH_LOGOS} croppedImageUrl="blob:x" />);

describe('로고 스탬프 폭 상한 렌더 (#347)', () => {
  test('MoodMinimal: 체인(74) · 포맷(64×1.02) 로고에 max-width + object-fit:contain', () => {
    const html = minimalMarkup();
    expect(html).toContain(`max-width:${74 * STAMP_MAX_ASPECT}px`); // 체인 370
    expect(html).toContain(`max-width:${64 * 1.02 * STAMP_MAX_ASPECT}px`); // 포맷 326.4
    // 상한에 걸린 로고는 잘리지 않고 축소돼야 한다(cover면 잘림).
    expect(html.match(/object-fit:contain/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test('이미지가 라벨보다 우선 — 이미지가 있으면 텍스트 라벨은 안 그린다 (#141/#348)', () => {
    const html = minimalMarkup();
    expect(html).toContain('blob:chain-logo');
    expect(html).toContain('blob:format-logo');
    expect(html).not.toContain('MEGABOX');
    expect(html).not.toContain('DOLBY');
  });
});

/**
 * 무드별 스탬프 그룹 폭 예산. edge = 그룹 시작 오프셋, gaps = 스탬프 사이 gap + 구분선(1px),
 * margin = 반대편에 남겨야 할 최소 여백. Editorial은 스탬프가 회전된 스텁 스트립 안에 세로로
 * 쌓여(폭이 아니라 스트립 길이를 먹는) 구조라 이 산술의 대상이 아님 — 상한(48×5=240)만 걸린다.
 */
const BUDGET = [
  { mood: 'Minimal',       avail: 960,  edge: 60, chainH: 74, formatH: 64 * 1.02, gaps: 34 + 1 + 34, margin: 60 },
  { mood: 'Criterion',     avail: 960,  edge: 52, chainH: 50, formatH: 64 * 0.9,  gaps: 28 + 1 + 28, margin: 52 },
  { mood: '35mm',          avail: 960,  edge: 50, chainH: 50, formatH: 64 * 0.85, gaps: 32 + 1 + 32, margin: 50 },
  { mood: '35mmLandscape', avail: 1477, edge: 46, chainH: 50, formatH: 64 * 0.85, gaps: 28 + 1 + 28, margin: 46 },
  // Stub: 콘텐츠 컬럼(960 - padding 40×2 = 880) 안의 flow 배치라 edge/margin 0.
  { mood: 'Stub',          avail: 880,  edge: 0,  chainH: 39, formatH: 64 * 0.6,  gaps: 13 + 1 + 13, margin: 0 },
];

describe('스탬프 그룹 폭 예산 — 상한까지 늘어나도 티켓 경계 안 (#347)', () => {
  for (const b of BUDGET) {
    test(`${b.mood}: 체인·포맷 최대폭 + gap이 가용폭 안`, () => {
      const used =
        b.edge + b.chainH * STAMP_MAX_ASPECT + b.gaps + b.formatH * STAMP_MAX_ASPECT + b.margin;
      expect(used).toBeLessThanOrEqual(b.avail);
    });
  }
});
