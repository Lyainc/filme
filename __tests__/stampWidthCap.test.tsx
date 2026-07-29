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
import { MoodEditorial, STUB_STAMP_MAX_W } from '../src/components/moods/MoodEditorial';
import { MINIMAL_STAMP_MAX_SCALE, MoodMinimal } from '../src/components/moods/MoodMinimal';
import { STAMP_MAX_ASPECT, stampHeightDelta } from '../src/components/moods/_shared';
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
  material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1, posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true, chainScale: 1, formatScale: 1,
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

  test('폭 상한을 안 받는 무드는 라벨 폰트가 안 움직인다 (#590)', () => {
    // #590은 TextStamp에 옵트인 maxWidth를 넣었다 — Editorial 스텁만 넘기므로, 안 넘기는 무드는
    // 예전 그대로 height×0.46이어야 한다(Minimal 체인 74 → 34px).
    const html = renderToStaticMarkup(
      <MoodMinimal movieInfo={MOVIE} components={{ ...WITH_LOGOS, chain: '', format: '' }} croppedImageUrl="blob:x" />
    );
    expect(html).toContain('MEGABOX');
    expect(html).toContain(`font-size:${Math.round(74 * 0.46)}px`);
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
 * 쌓여 티켓 폭이 아니라 스트립 길이를 먹는 구조라 이 산술의 대상이 아니고, 아래 #589 describe가
 * 그 길이축 예산을 따로 본다.
 *
 * 35mm·35mm Wide 행은 #590에서 걷어냈다 — v5(#524) 이후 두 무드는 체인/포맷 스탬프를 아예 안
 * 그려(StampRow·ChainStamp 호출 없음) 산술만 통과하는 죽은 행이었다.
 */
const BUDGET = [
  { mood: 'Minimal',       avail: 960,  edge: 60, chainH: 74, formatH: 64 * 1.02, gaps: 34 + 1 + 34, margin: 60 },
  { mood: 'Criterion',     avail: 960,  edge: 52, chainH: 50, formatH: 64 * 0.9,  gaps: 28 + 1 + 28, margin: 52 },
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

/**
 * #441 — chainScale/formatScale(최대 1.3)이 위 예산에 곱연산으로 반영된다(claude-review PR #485
 * P1). Minimal 외 무드는 여유가 커 scale=1.3에서도 예산 안에 든다. Minimal만 edge/gaps/margin이
 * 빡빡해(원래 예산도 avail에 딱 맞춰 설계됨, 위 describe 참고) 두 스탬프가 동시에
 * STAMP_MAX_ASPECT(5:1)에 근접하는 로고를 올리고 scale을 전역 상한(1.3)까지 올리면 그룹 폭이
 * avail을 실제로 넘었다(≈134px 초과). PR #485 리뷰 후속으로 공유 클램프 공식(spec c4)과 전역
 * scale 범위(spec c5, 0.6~1.3)는 그대로 두고, MoodMinimal이 렌더 시 실효 scale을
 * MINIMAL_STAMP_MAX_SCALE(1.1)로 낮춰 잡아 이 조합에서도 예산 안에 들도록 고쳤다(MoodMinimal.tsx).
 */
describe('#441 scale(1.3) 확장 후 스탬프 그룹 폭 예산', () => {
  const MAX_SCALE = 1.3;
  for (const b of BUDGET.filter((x) => x.mood !== 'Minimal')) {
    test(`${b.mood}: scale=1.3에서도 최대폭 + gap이 가용폭 안`, () => {
      const used =
        b.edge + b.chainH * MAX_SCALE * STAMP_MAX_ASPECT + b.gaps + b.formatH * MAX_SCALE * STAMP_MAX_ASPECT + b.margin;
      expect(used).toBeLessThanOrEqual(b.avail);
    });
  }

  test('Minimal: 실효 scale 상한(MINIMAL_STAMP_MAX_SCALE)에서 양쪽 최대종횡비 로고도 예산 안 (PR #485 후속 수정)', () => {
    const b = BUDGET.find((x) => x.mood === 'Minimal')!;
    const used =
      b.edge + b.chainH * MINIMAL_STAMP_MAX_SCALE * STAMP_MAX_ASPECT + b.gaps + b.formatH * MINIMAL_STAMP_MAX_SCALE * STAMP_MAX_ASPECT + b.margin;
    expect(used).toBeLessThanOrEqual(b.avail);
  });
});

/**
 * #589 — Editorial 스텁의 길이축 예산. 스텁은 rotate(-90°)라 스탬프의 **폭**이 캔버스 높이(960)를
 * 먹고, 다른 무드와 달리 그 예산이 px로 고정돼 있다. 높이 기반 상한(STAMP_MAX_ASPECT)은 사용자
 * scale이 곱해지면 같이 커져서 예산을 못 지킨다 — MoodEditorial이 절대 px 상한(STUB_STAMP_MAX_W)을
 * 겹쳐 걸고, 여기서 그 상한이 실측 예산(스탬프 제외 888px, scripts/measure-editorial-stub.mjs)
 * 안에 남는지 본다. 무드 좌표를 바꾸면서 상한을 안 맞추면 여기서 깨진다.
 */
describe('Editorial 스텁 길이축 예산 (#589)', () => {
  /** 최악 케이스에서 스탬프 그룹을 뺀 길이축 합 — 바코드 286 + 좌석 184 + admis 96 + le billet 125
   *  + 구분선 4 + gap 128 + padding 64. 하네스 `--logo` 실측(2026-07-29)에서 나온 값. */
  const EDITORIAL_STUB_REST = 888;
  const CANVAS_H = 960;

  test('scale 상한(1.3)에서 5:1 로고를 올려도 스텁 길이축이 캔버스 높이 안', () => {
    // 실렌더 폭 = min(h × STAMP_MAX_ASPECT, STUB_STAMP_MAX_W). h는 stampHeightDelta(−16)까지
    // 반영한 (48−16)×1.3 = 41.6이라 아스펙트 상한만으론 208px이 된다.
    const aspectCap = (48 + stampHeightDelta(STAMP_MAX_ASPECT)) * 1.3 * STAMP_MAX_ASPECT;
    expect(aspectCap).toBeGreaterThan(STUB_STAMP_MAX_W); // 절대 상한이 실제로 구속력을 갖는가
    expect(EDITORIAL_STUB_REST + Math.min(aspectCap, STUB_STAMP_MAX_W)).toBeLessThanOrEqual(CANVAS_H);
  });

  test('ghost placeholder도 같은 상한을 탄다 (scale 1.3에서 120×1.56 = 187px)', () => {
    expect(EDITORIAL_STUB_REST + Math.min(120 * 1.3, STUB_STAMP_MAX_W)).toBeLessThanOrEqual(CANVAS_H);
  });

  /**
   * #590 — 텍스트 라벨은 같은 상한을 폰트 축소로 지킨다. 로고(contain 축소)와 달리 폭만 막으면
   * 브랜드명이 잘리므로 TextStamp가 fitFontSizeToWidth로 먼저 줄이고, 하한(11px)에서도 안
   * 들어가는 라벨만 ellipsis가 받는다. happy-dom엔 canvas 측정이 없어 폰트 크기 자체는 여기서
   * 못 재고(하네스 `--long-label`이 실측: 496 → 64px), 상한과 폴백이 실제로 붙는지를 본다.
   */
  test('텍스트 라벨(24자)에 상한 + ellipsis 폴백이 붙는다 (#590)', () => {
    const html = renderToStaticMarkup(
      <MoodEditorial
        movieInfo={MOVIE}
        components={{ ...WITH_LOGOS, layout: 'editorial', chain: '', format: '', chainLabel: 'MEGABOX COEX DOLBY ATMOS', chainScale: 1.3, formatScale: 1.3 }}
        croppedImageUrl="blob:x"
      />
    );
    // 로고를 비웠으니 이 상한은 텍스트 스탬프에서만 나온다(placeholder는 width, max-width 아님).
    expect(html).toContain(`max-width:${STUB_STAMP_MAX_W}px`);
    expect(html).toMatch(/overflow:hidden;text-overflow:ellipsis">MEGABOX COEX DOLBY ATMOS</);
  });

  test('로고에 max-width가 STUB_STAMP_MAX_W로 붙고 contain으로 축소된다', () => {
    const html = renderToStaticMarkup(
      <MoodEditorial
        movieInfo={MOVIE}
        components={{ ...WITH_LOGOS, layout: 'editorial', chainScale: 1.3, formatScale: 1.3 }}
        croppedImageUrl="blob:x"
      />
    );
    expect(html).toContain(`max-width:${STUB_STAMP_MAX_W}px`);
    expect(html).toContain('object-fit:contain');
  });
});
