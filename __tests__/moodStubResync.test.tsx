import { afterEach, describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodStub } from '../src/components/moods/MoodStub';
import { buildBarcodeWidths, buildBarcodeWidths128C } from '../src/components/moods/_shared';
import { FULL_MOVIE, makeMoodBase } from './fixtures';
import { installFakeCanvasContext } from './setup/canvasStub';

// 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 05 STUB 재동기화 회귀(#281, 에픽 #281).
// Stub 델타(대규모 재구조): 포스터 760(텍스트 없음, #493에서 900 → #527에서 가로 3:2 밴드 640) · 절취 3px dashed 반원 노치 제거 · 페이퍼 스텁 flex.
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
  test('flex 컬럼 재구조 — 포스터 밴드 640(가로 3:2 풀블리드, #527)', () => {
    const html = markup();
    expect(html).toContain('flex:0 0 640px'); // 포스터 영역 — 960/1.5, 가로 포스터 풀블리드
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
    // 평점 "/5.0" 분모 제거(#445) — 다른 3무드(35mm/35mm Wide/Criterion quote)와 동일하게
    // 티커 항목도 분모 없는 "★ N.N" 표기여야 한다(nit mood-stub-rating-test-gap).
    expect(html).toContain('★ 4.5');
    expect(html).not.toContain('/5.0');
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

  // stub 톤업(#446) — 본문 좌우 패딩 PAD_X(40→56)이 패딩·티커 음수마진 두 곳에서 어긋나지 않는지 고정.
  test('본문 패딩 56px — 티커 음수마진과 공유(#446)', () => {
    const html = markup();
    expect(html).toContain('padding:22px 56px 26px');
    expect(html).toContain('margin:-22px -56px 22px');
  });

  // 홀로그램 티커 4회 반복(#446) — 필드가 적어도 우측이 비지 않게, 상수 문구("Admit One")가
  // 정확히 4번(Array.from({length:4}) 반복 횟수) 등장하는지로 반복 자체를 고정.
  test('홀로그램 티커 4회 반복 — 우측 공백 방지(#446)', () => {
    const html = markup();
    const count = (html.match(/Admit One/g) || []).length;
    expect(count).toBe(4);
  });

  // 워드마크 "me" 포인트 컬러(#446) — "me" 텍스트와 dot tittle만 WORDMARK_ACCENT(#B0423F)로,
  // "f"·"l"·dotless-i는 잉크 그대로.
  test('워드마크 "me" + dot tittle만 accent 색(#446)', () => {
    const html = markup();
    expect(html).toContain('l<span style="color:#B0423F">me</span>');
    expect(html).toContain('background:#B0423F');
  });

  // 하단 스텁 세로 재분배(#536 → #753) — 밴드 900→640(#527)으로 생긴 여유를 푸터 앞 단일 flex:1
  // 스페이서가 통으로 먹어 STARRING↔푸터 사이에만 구멍이 났다(브라우저 실측 234.5px). #536의
  // space-evenly는 divider 바로 아래에도 123px 빈 구간을 만들어 "덜 채워진 것"으로 읽혔다(#753
  // 실측) — 지금은 divider가 Admission을 곧바로 물고, 남는 세로를 Admission-Film 사이·Film-푸터
  // 사이 두 flex:1 스페이서가 나눠 갖는다. 단일 스페이서(#536 이전)나 space-evenly(#536)가
  // 되살아나면 여백이 다시 한 자리로 몰리거나 divider 바로 아래에 목적 없는 공백이 생긴다.
  test('하단 여유는 Admission-Film·Film-푸터 두 곳으로 분산 — 단일/3분할 스페이서 없음(#753)', () => {
    const html = markup();
    expect(html).not.toContain('justify-content:space-evenly');
    const spacerCount = (html.match(/flex:1;min-height:24px/g) || []).length;
    expect(spacerCount).toBe(2);
  });

  // 배우 폭 인식 truncate(#493) — 고정 count 캡(옛 max=5) 폐기, STARRING 값 가용폭(700px) 기준.
  describe('배우 truncate — 폭 인식(#493, 고정 count 캡 대체)', () => {
    // 가짜 canvas measureText를 심어야 truncateActorsToWidth의 실제 폭 계산 경로를 태운다
    // (happy-dom은 getContext('2d')가 null) — setup/canvasStub.ts.
    let restore: () => void;
    afterEach(() => restore?.());

    const markupWithActors = (actors: string) =>
      renderToStaticMarkup(
        <MoodStub movieInfo={{ ...FULL_MOVIE, actors }} components={BASE} croppedImageUrl="blob:x" onField={() => {}} />
      );

    test('6명이어도 짧으면 안 잘린다 — 예전 고정 5캡 버그 회귀', () => {
      restore = installFakeCanvasContext().restore;
      // fontSize 20 · factor 0.6 → char당 12px. "가, 나, 다, 라, 마, 바"=16자 → 192px, 700px 예산에 여유.
      const html = markupWithActors('가, 나, 다, 라, 마, 바');
      expect(html).toContain('가, 나, 다, 라, 마, 바');
      expect(html).not.toContain('외 1명');
    });

    test('가용폭(700px)을 넘치면 들어맞는 N까지만 남기고 "외 M명"으로 자른다', () => {
      restore = installFakeCanvasContext().restore;
      // 7자×8명 — 풀텍스트 840px(>700, 자름 발동). n=6 버전 684px(fit) · n=7 버전 792px(초과) → n=6에 수렴.
      const parts = ['가나다라마바사', '아자차카타파하', '거너더러머버서', '고노도로모보소', '구누두루무부수', '기니디리미비시', '갸냐댜랴먀뱌샤', '겨녀뎌려며벼셔'];
      const html = markupWithActors(parts.join(', '));
      expect(html).toContain(`${parts.slice(0, 6).join(', ')} 외 2명`);
      expect(html).not.toContain(parts[6]);
    });
  });
});
