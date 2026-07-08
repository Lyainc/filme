import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import type { MovieInfo, TicketComponents } from '../src/types';

// 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 재동기화 회귀(#281).
// Minimal은 푸터 바코드와 코너 RegistrationMarks(모서리 L틱)를 제거하고 타이포를 리스케일했다.
// 두 제거는 마스터 규격의 핵심 델타라, stale로 되돌아오면 여기서 잡는다.

const FULL_MOVIE: MovieInfo = {
  title: '그랜드 부다페스트 호텔', titleOg: 'The Grand Budapest Hotel', actors: '랄프 파인즈, 토니 레볼로리 외 3명', rating: 4.5,
  releaseDate: '2014-03-20', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '2023-09-15', isReissue: true,
  watchDate: '2024-03-15', watchDateFormat: 'kr-compact', watchTime: '19:30',
  theater: '메가박스 코엑스', screen: 'Dolby Cinema', seat: 'G14', runtime: '99분',
  bookingNumber: 'BOOK-1234', signature: '영화수집가',
};

const BASE: TicketComponents = {
  layout: 'minimal', chain: '', format: '', chainLabel: 'MEGABOX', formatLabel: 'DOLBY',
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true,
};

const markup = () =>
  renderToStaticMarkup(
    <MoodMinimal movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl="blob:x" />
  );

describe('MoodMinimal 마스터 resync (#281)', () => {
  test('푸터 바코드 제거 — svg 0건', () => {
    // 바코드는 Minimal 유일의 <svg>(<rect> 바). 마스터엔 "푸터에 바코드 없음"이므로 svg가 없어야 한다.
    expect(markup()).not.toContain('<svg');
  });

  test('코너 RegistrationMarks 제거 — 22×22 L틱 시그니처 0건', () => {
    // 제거된 마크는 22×22 절대배치 border 틱(width:22px;height:22px). 마스터엔 코너 마크가 없다.
    const html = markup();
    expect(html).not.toContain('width:22px;height:22px');
  });

  test('타이포 리스케일 — 타이틀 62/500, 상단 스크림 160', () => {
    const html = markup();
    expect(html).toContain('font-size:62px');   // 타이틀(마스터 62/500)
    expect(html).toContain('font-weight:500');   // 타이틀 weight 고정(pickTitleSize 폐기)
    expect(html).toContain('height:160px');       // 상단 스크림(마스터 160)
    expect(html).toContain('height:470px');       // 하단 스크림(마스터 470)
  });

  test('Cast — "Cast" 라벨 스택(과거 "with" 인라인 제거)', () => {
    const html = markup();
    expect(html).toContain('Cast');
    expect(html).not.toContain('>with<');
  });
});
