import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import type { MovieInfo, TicketComponents } from '../src/types';

// 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 06 35MM WIDE 재동기화 회귀(#281, 에픽 #281).
// 35mm Wide 델타: 바코드 없음, "SINGLE FRAME" 헤더 제거, 인라인 평점 → Rated 셀, 우 패널을 "From the Archive"
// 아카이브 카드로 재구조화(collected by·made with FILME·ACCESSION No), Released/Re-released 셀 분리,
// 타이틀 고정 60/800(pickTitleSize 폐기), 필드 라벨16/값27(Starring 25), 상/하단 92px 풀 필름 스트립.
// 마스터 Spec 값: 라벨 16 / 값 27(Starring 25) — 목표문 "값26"은 35mm 세로 값 착오, 마스터 우선. stale로 되돌아오면 여기서 잡는다.

const FULL_MOVIE: MovieInfo = {
  title: '그랜드 부다페스트 호텔', titleOg: 'The Grand Budapest Hotel', actors: '랄프 파인즈, 토니 레볼로리 외 3명', rating: 4.5,
  releaseDate: '2014-03-20', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '2023-09-15', isReissue: true,
  watchDate: '2024-03-15', watchDateFormat: 'kr-compact', watchTime: '19:30',
  theater: '메가박스 코엑스', screen: 'Dolby Cinema', seat: 'G14', runtime: '99분',
  bookingNumber: 'BOOK-1234', signature: '영화수집가',
};

const BASE: TicketComponents = {
  layout: '35mm-landscape', chain: '', format: '', chainLabel: 'MEGABOX', formatLabel: 'DOLBY',
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true,
};

const markup = () =>
  renderToStaticMarkup(
    <Mood35mmLandscape movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl="blob:x" onField={() => {}} />
  );

describe('Mood35mmLandscape 마스터 resync (#281)', () => {
  test('바코드 제거 — bookingNo FieldTap 0건, svg 0건', () => {
    const html = markup();
    expect(html).not.toContain('예매 번호 편집'); // bookingNo FieldTap aria-label
    expect(html).not.toContain('<svg');           // 바코드가 유일 svg였음
  });

  test('"SINGLE FRAME" 헤더 제거', () => {
    expect(markup()).not.toContain('SINGLE FRAME');
  });

  test('인라인 평점 제거 → Rated 필드 셀', () => {
    const html = markup();
    expect(html).toContain('Rated');
    expect(html).toContain('★ 4.5 / 5.0'); // 평점이 셀 값으로
    expect(html).toContain('평점 편집');    // 셀에 rating FieldTap 유지(게이팅 green)
  });

  test('타이포 리스케일 — 타이틀 고정 60/800, 필드 라벨16/값27/Starring25', () => {
    const html = markup();
    expect(html).toContain('font-size:60px'); // 고정 타이틀(pickTitleSize 폐기)
    expect(html).toContain('font-size:16px'); // 필드 라벨
    expect(html).toContain('font-size:27px'); // 필드 값
    expect(html).toContain('font-size:25px'); // Starring 값
  });

  test('Released / Re-released 셀 분리', () => {
    const html = markup();
    expect(html).toContain('Released');
    expect(html).toContain('Re-released');
    expect(html).not.toContain('· 재개봉'); // 과거 Released 셀에 병합하던 " · 재개봉 {날짜}" 제거
  });

  test('From the Archive 아카이브 카드 — collected by · made with FILME · ACCESSION No', () => {
    const html = markup();
    expect(html).toContain('From the Archive');
    expect(html).toContain('collected by');
    expect(html).toContain('영화수집가');            // 서명 = collected by 값
    expect(html).toContain('made with');
    expect(html).toContain('FILME');
    expect(html).toContain('ACCESSION No');
  });

  test('상/하단 92px 풀 필름 스트립 — KEYKODE + SAFETY FILM 엣지 코드', () => {
    const html = markup();
    expect(html).toContain('KL 23 4587 1234+05'); // FilmStripBand KEYKODE
    expect(html).toContain('SAFETY FILM');          // 엣지 스크롤 코드
  });
});
