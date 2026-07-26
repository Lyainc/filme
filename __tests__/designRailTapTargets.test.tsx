/**
 * DESIGN dock 탭 타깃 크기 회귀(#500) — 후보정 패널을 축 전환으로 재설계하면서 칩·세그먼트가
 * WCAG 2.2 SC 2.5.8(AA, 24×24) 아래로 못 내려가게 못박는다.
 *
 * #508이 플로팅 툴바에 세운 형태(__tests__/tapTargets.ts의 클래스 파싱 + variant·scale 우회
 * 금지)를 그대로 재사용한다. 같은 판정기를 쓰는 #553의 툴바 위계(32 vs 44)는 인플레이스
 * 편집 바가 필요해 __tests__/inPlaceFieldEditor.test.tsx에 있다.
 *
 * 실제 렌더 px는 브라우저 실측 몫이다(#500: 400×675 뷰포트에서 후보정 dock 413→312px,
 * 같은 자리 프리뷰 티켓 114×182→177×283px).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { assertNoShrink, expectMeetsAA } from './tapTargets';

function RailHarness() {
  const photo = usePhototicket();
  return <DesignRail photo={photo} />;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DESIGN dock 탭 타깃 (#500, WCAG 2.2 SC 2.5.8 AA)', () => {
  test('후보정 축 세그먼트(재질·코팅)가 24px 하한을 넘는다', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    await user.click(screen.getByRole('button', { name: '후보정' }));

    const seg = screen.getByRole('radiogroup', { name: '후보정 축' });
    const tabs = Array.from(seg.querySelectorAll('[role=radio]'));
    // 셀렉터가 조용히 비면 통과 못하게 + 라벨이 "축 · 현재값"을 다 들고 있는지(안 열린 축의
    // 상태가 보여야 한 축만 그리는 배치가 성립한다).
    expect(tabs.map((t) => t.textContent)).toEqual(['재질 · 원본', '코팅 · 유광']);
    for (const t of tabs) {
      const { h } = expectMeetsAA(t, `축 세그먼트 ${t.textContent}`);
      expect(h).toBe(36); // h-9 — 하한(24)이 아니라 실제 선언값을 고정해 조용한 축소를 잡는다
    }
  });

  test('후보정 칩(TexturePicker 46×46)이 24px 하한을 넘고, 한 번에 한 축만 그린다', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    await user.click(screen.getByRole('button', { name: '후보정' }));

    // 세로 예산 회수의 근거 — 두 축이 동시에 서면 dock이 다시 자란다(#500).
    expect(screen.queryByRole('radiogroup', { name: '재질' })).not.toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '코팅' })).toBeNull();

    const chips = Array.from(screen.getByRole('radiogroup', { name: '재질' }).querySelectorAll('[role=radio]'));
    expect(chips.length).toBeGreaterThan(1);
    for (const chip of chips) {
      // 칩 자체는 콘텐츠 크기(스와치+라벨)라, 크기 선언을 든 스와치를 재고 축소 우회 금지는
      // 칩 서브트리 전체에 건다(활성 칩의 border span이 인라인 transform을 들고 있다).
      for (const el of [chip, ...Array.from(chip.querySelectorAll('*'))]) assertNoShrink(el, '후보정 칩 서브트리');
      const swatch = chip.querySelector('[style*="width"]');
      expect(swatch).not.toBeNull();
      const { w, h } = expectMeetsAA(swatch!, `후보정 칩 ${chip.textContent}`);
      expect([w, h]).toEqual([46, 46]);
    }

    // 코팅으로 전환하면 그 축의 칩으로 갈린다(축 전환이 죽은 컨트롤이 아님).
    await user.click(screen.getByRole('radio', { name: /^코팅 ·/ }));
    expect(screen.queryByRole('radiogroup', { name: '재질' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '코팅' })).not.toBeNull();
  });
});
