import { describe, expect, test } from 'bun:test';
import { contrast, darkBlock, hexVar, rootBlock } from './cssTokens';

// WCAG AA 대비 검증(#650 → #826 S1) — --pr 글자 토큰이 라이트 · 다크 각각 세 표면(stage · s1 · s2)
// 위에서 하한을 지키는지 globals.css 값으로 순수 계산한다. 세 표면이 전부 불투명이라 픽셀 샘플링과
// 등가다. 글자 토큰(ink · ink-2 · ink-3 · warn)은 12px 메타에도 쓰이므로 전부 4.5:1. accent는 글자로
// 쓰지 않고(결정 5-A) 채움 · 선택 표시라 비글자 하한 3:1을 stage 위에서, 그 채움 위 글자(accent-ink)는 4.5:1.

const SURFACES = ['stage', 's1', 's2'] as const;
const TEXT = ['ink', 'ink-2', 'ink-3', 'warn'] as const;
const THEMES = [['light', rootBlock], ['dark', darkBlock]] as const;

describe('#826 S1 — --pr 글자 토큰이 세 표면 위 4.5:1 이상', () => {
  for (const [theme, block] of THEMES) {
    for (const t of TEXT) {
      for (const s of SURFACES) {
        test(`${theme} ${t} on ${s}`, () => {
          expect(contrast(hexVar(block, `pr-${t}`), hexVar(block, `pr-${s}`))).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

describe('#826 S1 — 강조 채움', () => {
  for (const [theme, block] of THEMES) {
    test(`${theme} accent-ink on accent ≥ 4.5`, () => {
      expect(contrast(hexVar(block, 'pr-accent-ink'), hexVar(block, 'pr-accent'))).toBeGreaterThanOrEqual(4.5);
    });
    test(`${theme} accent vs stage (비글자) ≥ 3`, () => {
      expect(contrast(hexVar(block, 'pr-accent'), hexVar(block, 'pr-stage'))).toBeGreaterThanOrEqual(3);
    });
  }
});
