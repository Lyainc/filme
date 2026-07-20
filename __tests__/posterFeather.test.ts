/**
 * #459 — contain 포스터의 선명 전경과 블러 레터박스 배경 사이 하드 경계를 부드럽게 잇는 페더의
 * 순수 기하 헬퍼 검증. 프리뷰(CSS mask-image)와 export(canvas destination-in)가 공유하는
 * "어느 축이 레터박스인가 + 씸 위치"를 여기서 직접 검증한다 — SSR/레이아웃 측정 없이 성립하므로
 * 경계가 하드 컷이 아님을(전환 램프가 실제로 있음을) 결정적으로 잡는다.
 */
import { describe, expect, test } from 'bun:test';
import {
  POSTER_EDGE_FEATHER,
  posterContainRect,
  posterFeatherAxes,
  posterFeatherMask,
} from '../src/utils/posterFeather';

// 세로 티켓 슬롯 예시(프레임 인셋 반영된 wrapper 크기 근사).
const BOX_W = 960;
const BOX_H = 1433; // 1477 - 44(frameInsetY*2)
const BOX_ASPECT = BOX_W / BOX_H; // ≈ 0.670

describe('posterContainRect — contain 내용 사각형·레터박스 인셋', () => {
  test('포스터가 슬롯보다 가로로 넓으면(natAspect > boxAspect) 폭에 맞고 위아래 레터박스', () => {
    const r = posterContainRect(BOX_W, BOX_H, 0.75); // 0.75 > 0.670
    expect(r.cw).toBe(BOX_W); // 폭 꽉 채움(좌우 무손실)
    expect(r.insetX).toBe(0);
    expect(r.insetY).toBeGreaterThan(0); // 위아래 레터박스
  });

  test('포스터가 슬롯보다 세로로 길면(natAspect < boxAspect) 높이에 맞고 좌우 레터박스', () => {
    const r = posterContainRect(BOX_W, BOX_H, 0.55); // 0.55 < 0.670
    expect(r.ch).toBe(BOX_H);
    expect(r.insetY).toBe(0);
    expect(r.insetX).toBeGreaterThan(0); // 좌우 레터박스
  });

  test('종횡비가 슬롯과 같으면 레터박스 없음(양 인셋 0)', () => {
    const r = posterContainRect(BOX_W, BOX_H, BOX_ASPECT);
    expect(r.insetX).toBeCloseTo(0, 5);
    expect(r.insetY).toBeCloseTo(0, 5);
  });
});

describe('posterFeatherAxes — 페더할 축은 최대 하나(contain)', () => {
  test('가로로 넓은 포스터 → y축만 페더', () => {
    expect(posterFeatherAxes(BOX_W, BOX_H, 0.75)).toEqual({ x: false, y: true });
  });
  test('세로로 긴 포스터 → x축만 페더', () => {
    expect(posterFeatherAxes(BOX_W, BOX_H, 0.55)).toEqual({ x: true, y: false });
  });
  test('종횡비 일치 → 둘 다 페더 안 함', () => {
    expect(posterFeatherAxes(BOX_W, BOX_H, BOX_ASPECT)).toEqual({ x: false, y: false });
  });
});

// mask-image 문자열의 네 px 스톱을 뽑는다: transparent a / #000 (a+f) / #000 (b-f) / transparent b.
function stops(mask: string): number[] {
  return Array.from(mask.matchAll(/([\d.]+)px/g)).map((m) => parseFloat(m[1]));
}

describe('posterFeatherMask — 씸에 투명↔불투명 램프(하드 컷 아님)', () => {
  test('위아래 레터박스 → to bottom 그라데이션, 스톱은 씸에서 안쪽으로 단조 증가', () => {
    const mask = posterFeatherMask(BOX_W, BOX_H, 0.75)!;
    expect(mask).toContain('to bottom');
    expect(mask).toContain('transparent');
    expect(mask).toContain('#000');
    const [a, ai, bi, b] = stops(mask);
    // 네 스톱이 강한 단조 증가 = 씸 바깥 투명 → 안쪽 불투명 램프가 실재(경계가 하드 컷이 아님).
    expect(a).toBeLessThan(ai);
    expect(ai).toBeLessThan(bi);
    expect(bi).toBeLessThan(b);
    // 램프 폭 = 기본 페더(24px)와 일치.
    expect(ai - a).toBeCloseTo(POSTER_EDGE_FEATHER, 0);
    expect(b - bi).toBeCloseTo(POSTER_EDGE_FEATHER, 0);
    // 투명 시작점 a = 위쪽 레터박스 인셋(씸 위치)과 일치(마스크는 px를 반올림해 문자열로 낸다).
    const { insetY } = posterContainRect(BOX_W, BOX_H, 0.75);
    expect(a).toBe(Math.round(insetY));
  });

  test('좌우 레터박스 → to right 그라데이션', () => {
    const mask = posterFeatherMask(BOX_W, BOX_H, 0.55)!;
    expect(mask).toContain('to right');
    const [a, ai, bi, b] = stops(mask);
    expect(a).toBeLessThan(ai);
    expect(bi).toBeLessThan(b);
  });

  test('레터박스 없음 → 마스크 없음(무손실 가장자리 보존, #439)', () => {
    expect(posterFeatherMask(BOX_W, BOX_H, BOX_ASPECT)).toBeUndefined();
  });

  test('align=top(posY=0) + 세로 레터박스 → 세로 페더 스킵(대칭 가정이 flush 컨텐츠를 잘라내므로, PR #460 P1)', () => {
    // posY=0.5(중앙)면 마스크가 나오지만, posY=0(상단 flush)이면 세로 페더를 스킵한다.
    expect(posterFeatherMask(BOX_W, BOX_H, 0.75, 0.5)).toBeDefined();
    expect(posterFeatherMask(BOX_W, BOX_H, 0.75, 0)).toBeUndefined();
    expect(posterFeatherAxes(BOX_W, BOX_H, 0.75, 0)).toEqual({ x: false, y: false });
    expect(posterFeatherAxes(BOX_W, BOX_H, 0.75, 0.5)).toEqual({ x: false, y: true });
  });

  test('align 무관하게 좌우 레터박스는 항상 페더(object-position x는 늘 50%)', () => {
    // posY를 0으로 줘도 가로 레터박스는 대칭이라 영향 없다.
    expect(posterFeatherMask(BOX_W, BOX_H, 0.55, 0)).toContain('to right');
    expect(posterFeatherAxes(BOX_W, BOX_H, 0.55, 0)).toEqual({ x: true, y: false });
  });

  test('내용이 얇아 램프가 겹치면 페더를 절반 폭으로 클램프(하드 컷으로 안 무너짐)', () => {
    // 극단적으로 가로로 긴 포스터(natAspect 40) → 내용 높이 ~24px < 페더*2(48) → 클램프 발동.
    const mask = posterFeatherMask(BOX_W, BOX_H, 40)!;
    const [a, ai, bi, b] = stops(mask);
    const contentH = b - a;
    expect(contentH).toBeLessThan(POSTER_EDGE_FEATHER * 2); // 클램프 조건 성립 확인
    // 클램프: (ai-a) == contentH/2, 여전히 램프가 존재(단조 비감소).
    expect(ai - a).toBeCloseTo(contentH / 2, 0);
    expect(a).toBeLessThanOrEqual(ai);
    expect(bi).toBeLessThanOrEqual(b);
  });
});
