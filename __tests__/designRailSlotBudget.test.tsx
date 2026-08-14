/**
 * Regression test for #682 (레일 슬롯 높이 예산).
 *
 * The fixed slot height (`h-[min(214px,Xsvh)]` on #design-rail-panel) is a bare numeric
 * literal with no other guard — nothing fails loudly if it silently regresses back to the
 * old 17.5svh (measured: 컬러 minimal 126px / 35mm 154px content no longer fits inside a
 * 115px-tall slot at 393×659). happy-dom can't compute real layout, so this can't assert the
 * actual scrollHeight-vs-clientHeight outcome — that's covered by the puppeteer measurement
 * (scripts/measure-chrome.mjs convention) referenced in the #682 PR. This test only pins the
 * two source-level facts a silent revert would touch: the svh coefficient itself, and the
 * CSS-only scroll-shadow affordance (#682 방향 3) that cues the remaining overflow on panels
 * (크기·형압) this round didn't shrink.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';

afterEach(cleanup);

function RailHarness() {
  const photo = usePhototicket();
  return <DesignRail photo={photo} />;
}

describe('#682 레일 슬롯 예산', () => {
  test('슬롯 높이가 26svh다 (17.5svh로 되돌아가면 실패)', () => {
    render(<RailHarness />);
    const slot = document.getElementById('design-rail-panel');
    expect(slot).not.toBeNull();
    expect(slot!.className).toContain('26svh');
    expect(slot!.className).not.toContain('17.5svh');
  });

  test('스크롤 어포던스(CSS local/scroll 배경 트릭)가 슬롯에 걸려 있다', () => {
    render(<RailHarness />);
    const slot = document.getElementById('design-rail-panel') as HTMLElement;
    // happy-dom의 CSSStyleDeclaration은 다중 그라디언트 `background` shorthand·
    // background-attachment를 못 삼키고 조용히 버린다(실측: cssText에서 해당 선언만 빠짐) —
    // 그래도 살아남는 background-size/-repeat로 같은 상수(32px/12px 밴드)를 잠근다.
    expect(slot.style.backgroundSize).toBe('100% 32px, 100% 32px, 100% 12px, 100% 12px');
    expect(slot.style.backgroundRepeat).toBe('no-repeat');
  });
});
