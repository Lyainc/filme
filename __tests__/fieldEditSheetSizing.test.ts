/**
 * #314 회귀 테스트 — FieldEditSheet의 키보드 상태별 시트 크기 계산(computeSheetSizing)만 순수
 * 함수로 검증. DOM/visualViewport 목킹 없이 로직만 — happy-dom이 visualViewport를 구현하지 않아
 * 셸 마운트 테스트로는 키보드 시나리오를 재현할 수 없다.
 */
import { describe, expect, test } from 'bun:test';
import { computeSheetSizing } from '@/components/v2/FieldEditSheet';

describe('computeSheetSizing', () => {
  test('vvHeight를 아직 모르면(첫 렌더) 기존 72dvh, height 미지정', () => {
    expect(computeSheetSizing(null, 852)).toEqual({ maxHeight: '72dvh', height: undefined });
  });

  test('키보드가 안 열려 있으면(vvHeight≈fullHeight) content-intrinsic 사이징 유지', () => {
    expect(computeSheetSizing(852, 852)).toEqual({ maxHeight: 'min(72dvh, 828px)', height: undefined });
  });

  test('키보드가 열리면(vvHeight가 fullHeight보다 많이 작음) height를 고정', () => {
    const result = computeSheetSizing(470, 852); // iPhone 16 Pro 근사: 키보드가 ~380px 차지
    expect(result.height).toBe('398px'); // 470 - 72(HEADER_RESERVE)
    expect(result.maxHeight).toBe(result.height);
  });

  test('키보드가 열려도 너무 작은 화면에선 하한(200px) 아래로 안 내려감', () => {
    const result = computeSheetSizing(220, 852);
    expect(result.height).toBe('200px');
  });

  test('vvHeight 자체가 하한(200px)보다 작으면(가로모드+키보드) 하한이 vvHeight를 넘지 않음', () => {
    // 리뷰 지적(PR #330 2차) — 클램프 없이 하한만 적용하면 200px > vvHeight(150px)라 시트가
    // 다시 키보드에 잘린다. #314가 고치려던 증상 재발 방지.
    const result = computeSheetSizing(150, 852);
    expect(result.height).toBe('150px');
  });
});
