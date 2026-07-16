import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// 마스터 시안(Ticket Design Master.dc.html v2 · 2026-07-08 resync) 재동기화 회귀(#281, 에픽 #281).
// 35mm 델타: 푸터 바코드 제거, 원형 평점 스탬프 → Rated 필드 셀, 타이틀 43/800, amber 악센트 더블룰,
// Released/Re-released 셀 분리, 상단 시리얼 스트립("SINGLE FRAME") 제거, 상/하단 92px 풀 필름 스트립
// (프레임번호·KEYKODE·엣지 스크롤). stale로 되돌아오면 여기서 잡는다.

const BASE = makeMoodBase('35mm');

const markup = () =>
  renderToStaticMarkup(
    <Mood35mm movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl="blob:x" onField={() => {}} />
  );

describe('Mood35mm 마스터 resync (#281)', () => {
  test('푸터 바코드 제거 — bookingNo FieldTap 0건, svg 0건', () => {
    const html = markup();
    expect(html).not.toContain('예매 번호 편집'); // bookingNo FieldTap aria-label
    expect(html).not.toContain('<svg');           // 바코드가 유일 svg였음
  });

  test('상단 시리얼 스트립 제거 — "SINGLE FRAME" 0건', () => {
    expect(markup()).not.toContain('SINGLE FRAME');
  });

  test('원형 평점 스탬프 제거 → Rated 필드 셀', () => {
    const html = markup();
    expect(html).not.toContain('width:138px;height:138px'); // 제거된 원형 스탬프 시그니처
    expect(html).toContain('Rated');
    expect(html).toContain('★ 4.5 / 5.0');                   // 평점이 셀 값으로
    expect(html).toContain('평점 편집');                      // 셀에 rating FieldTap 유지(게이팅 green)
  });

  test('타이포 리스케일 — 타이틀 43/800, 필드값 26', () => {
    const html = markup();
    expect(html).toContain('font-size:43px');
    expect(html).toContain('font-size:26px');
  });

  test('Released / Re-released 셀 분리', () => {
    const html = markup();
    expect(html).toContain('Released');
    expect(html).toContain('Re-released');
    expect(html).not.toContain('· 재개봉'); // 과거 Released 셀에 병합하던 " · 재개봉 {날짜}" 제거
  });

  test('풀 필름 스트립 — KEYKODE + SAFETY FILM 엣지 코드', () => {
    const html = markup();
    expect(html).toContain('KL 23 4587 1234+05'); // KEYKODE
    expect(html).toContain('SAFETY FILM');          // 엣지 스크롤 코드
  });

  test('made with FILME + collected by 서명 푸터는 유지(Q1) — #321 다른 3무드와 동일한 이탤릭 라벨', () => {
    const html = markup();
    // 필름 스트립 엣지 코드에도 대문자 'FILME'이 섞여 있어 단순 toContain으로는 푸터 특정 검증이
    // 안 된다 — 이탤릭 "made with" span 바로 뒤에 BI v2 워드마크(MoodWordmark, aria-label="FILME")가
    // 오는 구조로 고정(#386).
    expect(html).toMatch(/made with<\/span><span aria-label="FILME"/);
    expect(html).toMatch(/collected by<\/span><span[^>]*>영화수집가<\/span>/);
  });
});
