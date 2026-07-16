import { describe, expect, test } from 'bun:test';
import { stampHeightDelta } from '../src/components/moods/_shared';

// 로고 스탬프 높이 소폭 동적화(#392) — 이미지 자연 종횡비 → 높이 보정값(±16px cap) 순수 함수 회귀.
// 전문가 패널 스펙: 가로형(REF_ASPECT=2) 근방은 delta≈0(기존 고정 높이 유지), 세로로 길수록 +16px 쪽,
// 극단적으로 가로로 길수록 -16px 쪽으로. 미로드(aspect=null)는 항상 0(로드 전 첫 페인트 안전).

describe('stampHeightDelta (#392)', () => {
  test('미로드(null)는 항상 0 — 로드 전 첫 페인트가 기존 고정 높이와 동일', () => {
    expect(stampHeightDelta(null)).toBe(0);
  });

  test('기준 종횡비(가로형 2:1)는 delta 0', () => {
    expect(stampHeightDelta(2)).toBe(0);
  });

  test('세로로 긴 로고(aspect < 2)는 양수 delta(높이 증가)', () => {
    expect(stampHeightDelta(1)).toBeGreaterThan(0);
    expect(stampHeightDelta(0.5)).toBeGreaterThan(stampHeightDelta(1));
  });

  test('가로로 긴 로고(aspect > 2)는 음수 delta(높이 감소)', () => {
    expect(stampHeightDelta(3)).toBeLessThan(0);
  });

  test('극단값은 ±16px로 clamp', () => {
    expect(stampHeightDelta(0)).toBe(16);
    expect(stampHeightDelta(100)).toBe(-16);
  });
});
