import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 재동기화 회귀(#281, 에픽 #281).
// Criterion 델타: 하단 필름 셀에 RUNTIME 추가(RATED·RUNTIME·RELEASED·RE-RELEASED), RE-REL.→RE-RELEASED,
// 타이틀 pickTitleSize 스케일 폐기→고정 58/lh1.14, 원제 29·cast 31, 푸터 22–32. watchTime은 마스터에
// 독립 TIME 셀이 없어 미렌더 유지. stale로 되돌아오면 여기서 잡는다.
//
// v6(#497) — 한줄평 중심 재레이아웃: 좌측 DVD 스파인 밴드(폭 150·세로 바코드 66×440) 전면 제거,
// 타이틀 블록 left 200→64, 하단 caps 메타 라벨/값 20/30→16/24로 축소. 관련 회귀는 아래
// 'v6(#497)' describe 블록에서 검증.

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

  test('메타 라벨 16 / 값 24 (#497 축소)', () => {
    const html = markup();
    expect(html).toContain('font-size:16px'); // metaLabel
    expect(html).toContain('font-size:24px'); // metaValue
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

describe('MoodCriterion 한줄평 중심 재레이아웃 (#497)', () => {
  test('좌측 스파인 밴드 제거 — bookingNo 탭 타깃·세로 바코드 미렌더', () => {
    const html = markup();
    expect(html).not.toContain('예매 번호 편집'); // bookingNo FieldTap aria-label
    expect(html).not.toContain('writing-mode:vertical-rl');
  });

  test('타이틀·하단 caps 블록이 스파인 자리(left:64)까지 확장', () => {
    const html = markup();
    expect(html).toContain('left:64px');
    expect(html).not.toContain('left:200px');
  });

  test('한줄평이 장식 인용부호 + 2줄 클램프로 승격', () => {
    const html = markup();
    expect(html).toContain('aria-hidden="true" style="font-family:var(--font-display)');
    expect(html).toContain('-webkit-line-clamp:2');
    expect(html).toContain('font-size:50px'); // 영문 프리셋 quote
  });
});
