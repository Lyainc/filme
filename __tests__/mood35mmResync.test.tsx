import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// v5 시안(Mood Redesign v5.dc.html · 5a) 재설계 회귀(에픽 #524). #281 마스터 v2의 "포스터 풀블리드 +
// 상/하 92px 가로 스트립 + 하단 캡션 카드"가 통째로 바뀌었다: 스트립을 90° 돌린 세로 레일 + 컷 2개
// (포스터 560×840 = 0.667 / 크레딧 420) + 엔딩 크레딧 조판. stale로 되돌아오면 여기서 잡는다.

const BASE = makeMoodBase('35mm');

const markup = () =>
  renderToStaticMarkup(
    <Mood35mm movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl="blob:x" onField={() => {}} />
  );

describe('Mood35mm v5 재설계 (#524)', () => {
  test('푸터 바코드 없음 — bookingNo FieldTap 0건, svg 0건', () => {
    const html = markup();
    expect(html).not.toContain('예매 번호 편집'); // bookingNo FieldTap aria-label
    expect(html).not.toContain('<svg');
  });

  test('포스터 컷 560×840(#525 룰 5의 0.667) — 상하 베이스 96px 대칭', () => {
    const html = markup();
    expect(html).toContain('left:200px;width:560px;top:96px;height:840px');
    // 크레딧 컷: top 988 + height 420 = 1408, 스트립 1504 기준 하단 베이스도 96px
    expect(html).toContain('left:200px;width:560px;top:988px;height:420px');
  });

  test('세로 레일 — 스트립 90° 회전, 좌측만 엣지 프린트(실물도 편측 인쇄)', () => {
    const html = markup();
    expect(html).toContain('writing-mode:vertical-rl');
    // 레일 천공 36×51(구 가로 밴드 44×24 아님) — 지터로 ±2 흔들린다(#498).
    const holes: RegExpMatchArray[] = Array.from(html.matchAll(/width:(\d+)px;height:(\d+)px;margin:(-?\d+)px 0;border-radius:9px/g));
    expect(holes.length).toBe(38); // 레일 2개 × 홀 19개
    expect(holes.every(m => Math.abs(+m[1] - 36) <= 2 && Math.abs(+m[2] - 51) <= 2 && Math.abs(+m[3]) <= 3)).toBe(true);
    // 허용오차만 보면 기준 치수가 35×50으로 밀려도 통과하므로 평균으로 기준값을 못박는다.
    const avg = (i: number) => holes.reduce((s: number, m) => s + +m[i], 0) / holes.length;
    expect(Math.abs(avg(1) - 36)).toBeLessThan(1);
    expect(Math.abs(avg(2) - 51)).toBeLessThan(1);
    // 좌우 레일은 같은 지터 테이블 — 같은 프레임번호가 양 끝에서 같은 높이에 선다(#498 리뷰).
    expect(holes.slice(0, 19).map(m => m[0])).toEqual(holes.slice(19).map(m => m[0]));
    // 엣지 프린트 컬럼(left:68px)은 좌측 레일에만 1개
    expect(html.match(/left:68px;top:-40px/g)?.length).toBe(1);
  });

  test('컷 머리 프레임 라벨 FRAME 119 / 120', () => {
    const html = markup();
    expect(html).toContain('FRAME 119');
    expect(html).toContain('FRAME 120');
  });

  test('구분선 전량 삭제 — 더블룰·닷 디바이더 0건', () => {
    const html = markup();
    expect(html).not.toContain('border-radius:50%'); // 닷 디바이더
    expect(html).not.toContain('#C2802F'); // themeColor 파생 amber → 시안 하드코딩으로 교체
    expect(html).toContain('#a97433'); // v5 amber(c8)
  });

  test('엔딩 크레딧 라벨 세트 — Exhibited / Screened / The Film / Starring / Collected by', () => {
    const html = markup();
    for (const label of ['Exhibited', 'Screened', 'The Film', 'Starring', 'Collected by']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('★ 4.5'); // 평점은 The Film 병합 셀 안
    expect(html).toContain('평점 편집'); // rating FieldTap 유지(c3)
  });

  test('체인·포맷 스탬프가 상단 좌측 슬롯이 아니라 크레딧 컷 푸터로 이동(c5)', () => {
    expect(markup()).not.toContain('left:50px;top:130px'); // 구 상단 좌측 스탬프 슬롯
  });

  test('made with FILME 워드마크 유지 — #386 구조 고정', () => {
    expect(markup()).toMatch(/made with<\/span><span aria-label="FILME"/);
  });
});
