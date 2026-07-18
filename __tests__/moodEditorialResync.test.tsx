import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 04 EDITORIAL 재동기화 회귀(#281, 에픽 #281).
// Editorial 델타(3열→4열 대규모 재구조): 포스터 516 · 골드포일 세로 스트립 42(신규 장식) · 메인 flex · 스텁 224.
// 킥커 "En Reprise · Longs Métrages", 타이틀 고정 72/900(pickTitleSize 폐기), Séance + "SE PRÉSENTER À/
// PLEASE ARRIVE AT" 도착시간 블록 + 시계, 메타 그리드 Théâtre/Durée/Note/Sortie 37/800(좌석은 스텁 place로
// 이동), 프랑스어 고지문 + 크로스헤어. 회전 -90° 스텁 바코드는 유지. reissue는 메타 그리드 슬롯이 없어 미렌더.

const BASE = makeMoodBase('editorial');

const markup = () =>
  renderToStaticMarkup(
    <MoodEditorial movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl="blob:x" onField={() => {}} />
  );

describe('MoodEditorial 마스터 resync (#281)', () => {
  test('4열 구조 — 포스터 516 · 골드포일 42 · 메인 flex · 스텁 224', () => {
    const html = markup();
    expect(html).toContain('flex:0 0 516px'); // 포스터
    expect(html).toContain('flex:0 0 42px'); // 골드포일 스트립
    expect(html).toContain('flex:1 1 auto'); // 메인
    expect(html).toContain('flex:0 0 224px'); // 스텁
  });

  test('골드포일 세로 스트립(신규) — 프랑스어 큐레이션 텍스트', () => {
    const html = markup();
    expect(html).toContain('SÉLECTION 2024');
    expect(html).toContain('ÉDITION SPÉCIALE');
    expect(html).toContain('writing-mode:vertical-rl');
  });

  test('킥커 "En Reprise · Longs Métrages"', () => {
    expect(markup()).toContain('En Reprise · Longs Métrages');
  });

  test('타이틀 고정 72/900(pickTitleSize 폐기)', () => {
    const html = markup();
    expect(html).toContain('font-size:72px');
    expect(html).toContain('font-weight:900');
  });

  test('Séance + 도착시간 블록 — SE PRÉSENTER À / PLEASE ARRIVE AT + 시계 + 19:30 54/900', () => {
    const html = markup();
    expect(html).toContain('Séance');
    expect(html).toContain('SE PRÉSENTER À');
    expect(html).toContain('PLEASE ARRIVE AT');
    expect(html).toContain('<svg'); // 시계 SVG
    expect(html).toContain('19:30');
    expect(html).toContain('font-size:54px'); // 도착시간
  });

  test('메타 그리드 — Théâtre / Durée / Note / Sortie 37/800', () => {
    const html = markup();
    expect(html).toContain('Théâtre');
    expect(html).toContain('Durée');
    expect(html).toContain('Note');
    expect(html).toContain('Sortie');
    expect(html).toContain('font-size:37px');
    expect(html).toContain('grid-template-columns:1.3fr 1fr');
  });

  test('좌석은 스텁 place 그룹으로 이동 — place / SIÈGE · SEAT / G14 56/900', () => {
    const html = markup();
    expect(html).toContain('SIÈGE · SEAT');
    expect(html).toContain('G14');
    expect(html).toContain('font-size:56px'); // 스텁 좌석 값
  });

  test('프랑스어 고지문 + 스텁 le billet / admis(ADMIT ONE)', () => {
    const html = markup();
    expect(html).toContain('Place garantie');
    expect(html).toContain('le billet'); // 포스터→스텁으로 이동한 le billet 헤더
    expect(html).toContain('admis');
    expect(html).toContain('ADMIT ONE');
  });

  // #423: "No. {bookingNo}" 텍스트 제거, 바코드는 132×70 → 200~240 폭 범위로 확대.
  // 폭 216->286(#444) — Code128C(143유닛) 기준 모듈당 2px 확보를 위한 재조정.
  test('회전 -90° 스텁 바코드는 SVG로 유지, "No." 텍스트는 제거', () => {
    const html = markup();
    expect(html).toContain('rotate(-90deg)');
    expect(html).toContain('viewBox="0 0 286 70"');
    expect(html).not.toContain('No. BOOK-1234');
  });

  // #423: 극장·포맷 로고 세로 gap 12→22px, 둘 다 렌더될 때만 장식 점(·) 삽입.
  // 장식 점 마커는 크로스헤어(항상 렌더, border 기반)와 구분되는 "borderRadius+background" 조합으로 좁힌다.
  const CONNECTOR_DOT_MARKER = 'border-radius:50%;background:#f7ece2';
  test('극장·포맷 로고 사이 gap 확대 + 둘 다 있을 때만 장식 점', () => {
    const html = markup();
    expect(html).toContain('gap:22px');
    expect(html).toContain(CONNECTOR_DOT_MARKER);

    const formatOffHtml = renderToStaticMarkup(
      <MoodEditorial movieInfo={FULL_MOVIE} components={{ ...BASE, formatVisible: false }} croppedImageUrl="blob:x" onField={() => {}} />
    );
    expect(formatOffHtml).toContain('MEGABOX'); // chain 스탬프는 유지
    expect(formatOffHtml).not.toContain(CONNECTOR_DOT_MARKER); // 장식 점은 사라짐
  });

  test('reissue 미렌더 — 메타 그리드 Sortie는 개봉일만(재개봉일 2023 없음)', () => {
    // 킥커 "En Reprise · Longs Métrages"는 장식이라 유지되므로 reissue 날짜값(2023)의 부재로 검증한다.
    expect(markup()).not.toContain('2023');
  });

  // BI v2 워드마크 포팅(#386) — 골드포일 세로 스트립에도 대문자 'FILME'이 장식으로 섞여 있어(스코프 밖,
  // 위 컴포넌트 주석 참고) 단순 toContain으론 푸터 특정이 안 된다. "réalisé avec" 바로 뒤에
  // MoodWordmark(aria-label="FILME")가 오는 구조로 고정.
  test('푸터 워드마크는 BI v2 로고타입(MoodWordmark) — #386', () => {
    const html = markup();
    expect(html).toMatch(/réalisé avec<\/span><span aria-label="FILME"/);
  });
});
