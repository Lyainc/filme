/**
 * #676 — MOOD_CHIP_BG(칩용, 구조 표식 추가)와 MOOD_BACKDROP_BG(배경 타일용, #367 이전 값 동결)
 * 분리가 실제로 지켜지는지 잠그는 회귀 테스트. 이 테스트가 없으면 Landing.tsx의 import를
 * 실수로 MOOD_CHIP_BG로 되돌려도 typecheck·나머지 테스트가 전부 통과한다(claude-review PR #691
 * P1 지적) — 배경 타일은 "안 읽히는 색면"이 요건(D5)이라 칩의 구조 표식이 새면 그 요건이 깨진다.
 */
import { describe, expect, test } from 'bun:test';
import { MOOD_BACKDROP_BG, MOOD_CHIP_BG } from '@/components/LayoutPicker';
import type { LayoutId } from '@/types';

// 구조 표식(퍼포레이션·노치)을 새로 얹은 무드 — 이 셋은 칩 값이 배경 동결값과 달라야 한다.
const MARKED_MOODS: LayoutId[] = ['35mm', '35mm-landscape', 'stub'];
// 값을 안 건드린 무드 — 칩과 배경이 여전히 같아야 한다(동결 사본이 원본과 어긋나면 그 자체가 버그).
const UNCHANGED_MOODS: LayoutId[] = ['minimal', 'criterion', 'editorial'];

describe('MOOD_CHIP_BG / MOOD_BACKDROP_BG 분리 (#676)', () => {
  test.each(MARKED_MOODS)('%s — 칩엔 구조 표식이 있어 배경 동결값과 달라야 한다', (id) => {
    expect(MOOD_CHIP_BG[id]).not.toBe(MOOD_BACKDROP_BG[id]);
  });

  test.each(UNCHANGED_MOODS)('%s — 값을 안 건드려 칩과 배경이 같아야 한다', (id) => {
    expect(MOOD_CHIP_BG[id]).toBe(MOOD_BACKDROP_BG[id]);
  });
});
