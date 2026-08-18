/**
 * `EmbossBrushLayer`가 max 스테이지 위(z-order)에 서는지를 **선언 대조**로 잠근다(#729 ac5).
 *
 * 왜 필요한가 — happy-dom은 레이아웃·스태킹을 계산하지 않아 hit-test(elementFromPoint)로는
 * 원리적으로 이 축을 못 잡는다(#729 명세 blindspots). 실제 히트 테스트는 브라우저 실측
 * (puppeteer 프로브, 2026-08-18 6무드 확인)이 맡았고, 이 테스트는 그 전제 — "브러시 zIndex가
 * max 스테이지 z-index보다 크다" — 가 소스에서 계속 성립하는지만 required 안에서 지킨다.
 * `measureChromeBaselineCoupling.test.ts`(#707)와 같은 처방: 하네스를 대신하지 않고 "다시
 * 실측하라"는 신호만 낸다.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const SHELL_PATH = 'src/components/v2/MobileEditorShell.tsx';
const LAYER_PATH = 'src/components/v2/EmbossBrushLayer.tsx';

describe('EmbossBrushLayer ↔ max 스테이지 z-order 결합 (#729)', () => {
  const shell = readFileSync(SHELL_PATH, 'utf8');
  const layer = readFileSync(LAYER_PATH, 'utf8');

  test('max 스테이지의 z-index 클래스가 선언돼 있다', () => {
    expect(/fixed inset-0 z-(\d+)/.test(shell)).toBe(true);
  });

  test('브러시 레이어의 isMax 분기 zIndex가 선언돼 있다', () => {
    expect(/zIndex:\s*isMax\s*\?\s*\d+\s*:\s*\d+/.test(layer)).toBe(true);
  });

  test('max일 때 브러시 zIndex가 스테이지 z-index보다 크다 — 안 그러면 포스터 탭이 "기본 크기로 돌아가기"에 흡수된다', () => {
    const stageZ = Number(shell.match(/fixed inset-0 z-(\d+)/)?.[1]);
    const [, maxZ, defaultZ] = layer.match(/zIndex:\s*isMax\s*\?\s*(\d+)\s*:\s*(\d+)/) ?? [];
    expect(Number(maxZ)).toBeGreaterThan(stageZ);
    // 기본 모드는 필드 드로어(z-50)를 가리면 안 되므로 스테이지 z보다 작아야 한다(#729 c2).
    expect(Number(defaultZ)).toBeLessThan(stageZ);
  });
});
