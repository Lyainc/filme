import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { buildBarcodeWidths, buildBarcodeWidths128C } from '../src/components/moods/_shared';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 재동기화 회귀(#281, 에픽 #281).
// Criterion 델타: 하단 필름 셀에 RUNTIME 추가(RATED·RUNTIME·RELEASED·RE-RELEASED), RE-REL.→RE-RELEASED,
// 타이틀 pickTitleSize 스케일 폐기→고정 58/lh1.14, 스파인 폭 150·바코드 66×440, 메타 라벨 20/값 30,
// 원제 29·cast 31, 푸터 22–32. watchTime은 마스터에 독립 TIME 셀이 없어 미렌더 유지. stale로 되돌아오면 여기서 잡는다.

const BASE = makeMoodBase('criterion');

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

  // 세로 바코드 66×440(#444) — CGV 16자리 판매번호 기준 231유닛(128B)로는 440/231≈1.9px/모듈로
  // 화면 표시 최소 기준(2px/모듈)에 못 미쳐 encoding="code128c"로 전환했다(nit
  // criterion-barcode-below-2px). Barcode는 <rect>만 심볼 막대를 그리므로(_shared.tsx), 렌더된
  // rect 개수가 같은 bookingNumber를 128B로 인코딩했을 때보다 적어야 전환이 유효하다.
  test('세로 바코드 rect 개수가 Code128B 대비 줄어든다 — Code128C 적용 확인', () => {
    const html = markup();
    const rectCount = (html.match(/<rect/g) || []).length;
    const rects128C = buildBarcodeWidths128C(FULL_MOVIE.bookingNumber!).filter((b) => b.ink).length;
    const rects128B = buildBarcodeWidths(FULL_MOVIE.bookingNumber!).filter((b) => b.ink).length;
    expect(rectCount).toBe(rects128C);
    expect(rectCount).toBeLessThan(rects128B);
  });

  test('made with FILME + collected by 서명 푸터 유지', () => {
    const html = markup();
    expect(html).toContain('made with');
    expect(html).toContain('collected by');
    expect(html).toContain('영화수집가');
  });

  // BI v2 워드마크 포팅(#386) — "made with" 바로 뒤에 MoodWordmark(aria-label="FILME")가 오는지 고정.
  test('푸터 워드마크는 BI v2 로고타입(MoodWordmark) — #386', () => {
    const html = markup();
    expect(html).toMatch(/made with<\/span><span aria-label="FILME"/);
  });
});
