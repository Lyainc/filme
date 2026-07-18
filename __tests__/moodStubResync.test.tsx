import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodStub } from '../src/components/moods/MoodStub';
import { buildBarcodeWidths, buildBarcodeWidths128C } from '../src/components/moods/_shared';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 05 STUB 재동기화 회귀(#281, 에픽 #281).
// Stub 델타(대규모 재구조): 포스터 760(텍스트 없음) · 절취 3px dashed 반원 노치 제거 · 페이퍼 스텁 flex.
// 제목이 포스터→페이퍼로 이동(42/700 2줄), 홀로그램 티커 신규(무지개 + ✦), Admission(SEAT 칩 48/900 on
// #1A1612 + DATE/TIME/HALL 점선), The Film(RUNTIME/RATED/RELEASED/RE-RELEASED 2열 + STARRING),
// 푸터(made with FILME · collected by · 스텁 바코드 300×40 텍스트 없음). ink #1A1612 고정 · monochrome.
// Editorial과 달리 reissue는 The Film RE-RELEASED 셀로 렌더된다(스텁은 바코드도 유지).

const BASE = makeMoodBase('stub');

const markup = () =>
  renderToStaticMarkup(
    <MoodStub movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl="blob:x" onField={() => {}} />
  );

describe('MoodStub 마스터 resync (#281)', () => {
  test('flex 컬럼 재구조 — 포스터 760(텍스트 없음)', () => {
    const html = markup();
    expect(html).toContain('flex:0 0 760px'); // 포스터 영역
    expect(html).toContain('flex-direction:column'); // root flex 컬럼
  });

  test('절취선 3px dashed · 반원 노치 없음', () => {
    const html = markup();
    expect(html).toContain('3px dashed rgba(26,22,18,.85)');
    expect(html).not.toContain('border-radius:50%'); // 이전 반원 노치 원 제거
  });

  test('홀로그램 티커(신규) — 무지개 그라디언트 + ✦ 구분', () => {
    const html = markup();
    expect(html).toContain('#9ff0df'); // 무지개 그라디언트 시작/끝 stop
    expect(html).toContain('✦'); // 정보 구분자
  });

  test('제목이 페이퍼 스텁으로 이동 — 42/700 2줄 클램프', () => {
    const html = markup();
    expect(html).toContain('font-size:42px');
    expect(html).toContain('font-weight:700');
    expect(html).toContain('-webkit-line-clamp:2');
    expect(html).toContain('그랜드 부다페스트 호텔');
  });

  test('원제 18/600 uppercase 브라운', () => {
    const html = markup();
    expect(html).toContain('The Grand Budapest Hotel');
    expect(html).toContain('color:#6f6347');
  });

  test('Admission — SEAT 칩 48/900 on #1A1612', () => {
    const html = markup();
    expect(html).toContain('Admission');
    expect(html).toContain('background:#1a1612'); // SEAT 칩 배경
    expect(html).toContain('font-size:48px');
    expect(html).toContain('font-weight:900');
    expect(html).toContain('G14');
  });

  test('Admission DATE/TIME/HALL 점선 행 — HALL = theater · screen', () => {
    const html = markup();
    expect(html).toContain('DATE');
    expect(html).toContain('TIME');
    expect(html).toContain('HALL');
    expect(html).toContain('1px dotted'); // 점선 필러
    // HALL = theater · screen(각 조각 독립 FieldTap #266 PR-B). 결합 문자열 불변식은 onTicketFieldTap 캡처 테스트가 커버.
    expect(html).toContain('메가박스 코엑스');
    expect(html).toContain('Dolby Cinema');
  });

  test('The Film — RUNTIME/RATED/RELEASED/RE-RELEASED 2열 + STARRING', () => {
    const html = markup();
    expect(html).toContain('The Film');
    expect(html).toContain('grid-template-columns:1fr 1fr');
    expect(html).toContain('RUNTIME');
    expect(html).toContain('RATED');
    expect(html).toContain('RELEASED');
    expect(html).toContain('RE-RELEASED');
    expect(html).toContain('STARRING');
  });

  test('reissue 렌더 — RE-RELEASED 셀(Editorial과 달리 스텁은 재개봉일 유지)', () => {
    expect(markup()).toContain('2023'); // reissueDate 2023-09-15 (releaseDate 2014·watchDate 2024와 구별)
  });

  test('푸터 — made with FILME · collected by + 스텁 바코드 300×40 텍스트 없음', () => {
    const html = markup();
    expect(html).toContain('made with');
    expect(html).toContain('FILME');
    expect(html).toContain('collected by');
    expect(html).toContain('영화수집가');
    expect(html).toContain('width="300"'); // 바코드 300px, showText=false
  });

  // encoding="code128c"(#444)가 실제로 반영됐는지 — Barcode는 <rect>만 심볼 막대를 그리므로(_shared.tsx),
  // 렌더된 rect 개수가 같은 bookingNumber를 128B로 인코딩했을 때보다 적어야 전환이 유효하다(nit
  // barcode-markup-test-no-rect-count, width="300" 확인만으론 encoding prop 자체는 검증되지 않는다).
  test('바코드 rect 개수가 Code128B 대비 줄어든다 — Code128C 적용 확인', () => {
    const html = markup();
    const rectCount = (html.match(/<rect/g) || []).length;
    const rects128C = buildBarcodeWidths128C(FULL_MOVIE.bookingNumber!).filter((b) => b.ink).length;
    const rects128B = buildBarcodeWidths(FULL_MOVIE.bookingNumber!).filter((b) => b.ink).length;
    expect(rectCount).toBe(rects128C);
    expect(rectCount).toBeLessThan(rects128B);
  });

  // BI v2 워드마크 포팅(#386) — "made with" 바로 뒤에 MoodWordmark(aria-label="FILME")가 오는지 고정.
  // Stub은 과거 FONT_MONO 대문자로 다른 무드와 갈라져 있었다(#321 잔재) — 이번에 마저 통일.
  test('푸터 워드마크는 BI v2 로고타입(MoodWordmark) — #386', () => {
    const html = markup();
    expect(html).toMatch(/made with<\/span><span aria-label="FILME"/);
  });
});
