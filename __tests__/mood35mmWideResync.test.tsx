import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

// v5 시안(Mood Redesign v5.dc.html · 5b) 재설계 회귀(에픽 #524). 우측 600px "From the Archive"
// 아카이브 패널이 통째로 사라지고(#499 흡수) 35mm 세로와 같은 "컷 + 크레딧 컷" 구조가 됐다.
// 스프로켓은 #498이 확정한 51×36 ×18로 커지고 bleed 34로 절단면에서 반쯤 잘린다.

const BASE = makeMoodBase('35mm-landscape');

const markup = () =>
  renderToStaticMarkup(
    <Mood35mmLandscape movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl="blob:x" onField={() => {}} />
  );

describe('Mood35mmLandscape v5 재설계 (#524)', () => {
  test('바코드 없음 — bookingNo FieldTap 0건, svg 0건', () => {
    const html = markup();
    expect(html).not.toContain('예매 번호 편집');
    expect(html).not.toContain('<svg');
  });

  test('아카이브 패널 전량 제거(#499 흡수)', () => {
    const html = markup();
    expect(html).not.toContain('From the Archive');
    expect(html).not.toContain('0 0 600px'); // PANEL_W flex-basis
    expect(html).not.toContain('now showing');
  });

  test('컷 2개 — 포스터 926×617(3:2) / 크레딧 411×617(2:3), 갭 45px', () => {
    const html = markup();
    expect(html).toContain('left:61px;width:926px;top:171px;height:617px');
    expect(html).toContain('left:1032px;width:411px;top:171px;height:617px');
    expect(61 + 926 + 45).toBe(1032); // 컷 갭 45px
    expect(1032 + 411 + 61).toBe(1504); // 우측 베이스도 61px (좌우 대칭)
  });

  test('스프로켓 51×36 ×18 + bleed 34 — 홀은 지터로 ±2 흔들린다(#498)', () => {
    const html = markup();
    const holes = Array.from(html.matchAll(/width:(\d+)px;height:(\d+)px;margin:0 (-?\d+)px;border-radius:9px/g));
    expect(holes.length).toBe(36); // 밴드 2개 × 홀 18개
    expect(holes.every(m => Math.abs(+m[1] - 51) <= 2 && Math.abs(+m[2] - 36) <= 2 && Math.abs(+m[3]) <= 3)).toBe(true);
    expect(new Set(holes.map(m => m[0])).size).toBeGreaterThan(1); // 완전 등간격이 아니다
    // 상/하 밴드는 같은 지터 테이블 — 같은 프레임번호의 천공이 위아래 같은 x에 선다(#556 리뷰 P1,
    // 레일의 좌/우 단언과 같은 축). 갈리면 스트립이 세로로 비틀린 것처럼 보인다.
    expect(holes.slice(0, 18).map(m => m[0])).toEqual(holes.slice(18).map(m => m[0]));
    expect(html).toContain('margin:0 -34px'); // 천공 행을 절단면으로 흘리는 bleed
    expect(html).not.toContain('width:44px;height:24px'); // 구 치수
  });

  test('하단 밴드는 edgePrint=false — KEYKODE는 상단 밴드에만 1회', () => {
    const html = markup();
    expect(html.match(/KL 23 /g)?.length).toBe(1);
  });

  test('KEYKODE는 엣지 행과 같은 줄 — 92px 밴드에 4행은 세로 예산이 없다(#557)', () => {
    const html = markup();
    const row = html.slice(html.indexOf('padding:0 14px')); // 엣지 행 하나
    expect(row).toContain('KL 23 ');
    expect(row.indexOf('KL 23 ')).toBeLessThan(row.indexOf('◆')); // 같은 행 안에서 KEYKODE가 먼저
    // 3행 오프셋 — 바깥에서 천공 6, 프레임번호 6+36+3=45, 안쪽에서 엣지 6. 행 높이는 폰트 메트릭이라
    // static markup으로 못 재니(실측은 #557 브라우저 검증) 코드가 소유한 오프셋만 고정한다.
    expect(html).toContain('top:45px');
    expect(html).toContain('bottom:45px'); // 하단 밴드 프레임번호 — 같은 산수가 뒤집혀 선다
  });

  test('키코드는 결정론(c2) — 같은 티켓이면 같은 값, 렌더마다 안 바뀐다', () => {
    expect(markup()).toBe(markup());
    expect(markup()).toMatch(/KL 23 \d{4} \d{4}\+0[1-8]/);
  });

  test('컷 머리 프레임 라벨 FRAME 119 / 120', () => {
    const html = markup();
    expect(html).toContain('FRAME 119');
    expect(html).toContain('FRAME 120');
  });

  test('엔딩 크레딧 라벨 세트 + amber 하드코딩(c8)', () => {
    const html = markup();
    for (const label of ['Exhibited', 'Screened', 'The Film', 'Starring', 'Collected by']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('★ 4.5');
    expect(html).toContain('#a97433');
    expect(html).not.toContain('#C2802F');
  });

  test('made with FILME 워드마크는 크레딧 컷 푸터 — #386 구조 고정', () => {
    expect(markup()).toMatch(/made with<\/span><span aria-label="FILME"/);
  });
});
