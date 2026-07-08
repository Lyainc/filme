import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import type { MovieInfo, TicketComponents } from '../src/types';

// 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 재동기화 회귀(#281, 에픽 #281).
// Criterion 델타: 하단 필름 셀에 RUNTIME 추가(RATED·RUNTIME·RELEASED·RE-RELEASED), RE-REL.→RE-RELEASED,
// 타이틀 pickTitleSize 스케일 폐기→고정 58/lh1.14, 스파인 폭 150·바코드 66×440, 메타 라벨 20/값 30,
// 원제 29·cast 31, 푸터 22–32. watchTime은 마스터에 독립 TIME 셀이 없어 미렌더 유지. stale로 되돌아오면 여기서 잡는다.

const FULL_MOVIE: MovieInfo = {
  title: '그랜드 부다페스트 호텔', titleOg: 'The Grand Budapest Hotel', actors: '랄프 파인즈, 토니 레볼로리 외 3명', rating: 4.5,
  releaseDate: '2014-03-20', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '2023-09-15', isReissue: true,
  watchDate: '2024-03-15', watchDateFormat: 'kr-compact', watchTime: '19:30',
  theater: '메가박스 코엑스', screen: 'Dolby Cinema', seat: 'G14', runtime: '99분',
  bookingNumber: 'BOOK-1234', signature: '영화수집가',
};

const BASE: TicketComponents = {
  layout: 'criterion', chain: '', format: '', chainLabel: 'MEGABOX', formatLabel: 'DOLBY',
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true,
};

const markup = () =>
  renderToStaticMarkup(
    <MoodCriterion movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl="blob:x" onField={() => {}} />
  );

describe('MoodCriterion 마스터 resync (#281)', () => {
  test('RUNTIME 필드 셀 추가 — 라벨·값·편집 타깃', () => {
    const html = markup();
    expect(html).toContain('RUNTIME');
    expect(html).toContain('99분');
    expect(html).toContain('러닝타임 편집'); // runtime FieldTap aria-label(게이팅 green)
  });

  test('RE-RELEASED 라벨 (구 RE-REL. 폐기)', () => {
    const html = markup();
    expect(html).toContain('RE-RELEASED');
    expect(html).not.toContain('RE-REL.');
  });

  test('watchTime 미렌더 — 독립 TIME 셀·편집 타깃 없음', () => {
    const html = markup();
    expect(html).not.toContain('관람 시간 편집'); // watchTime FieldTap aria-label
  });

  test('타이틀 고정 58/lh1.14', () => {
    const html = markup();
    expect(html).toContain('font-size:58px');
    expect(html).toContain('line-height:1.14');
  });

  test('메타 라벨 20 / 값 30', () => {
    const html = markup();
    expect(html).toContain('font-size:20px'); // metaLabel
    expect(html).toContain('font-size:30px'); // metaValue
  });

  test('스파인 폭 150', () => {
    expect(markup()).toContain('width:150px');
  });

  test('made with FILME + collected by 서명 푸터 유지', () => {
    const html = markup();
    expect(html).toContain('made with');
    expect(html).toContain('collected by');
    expect(html).toContain('영화수집가');
  });
});
