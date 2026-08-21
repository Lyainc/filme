/**
 * #730 — roving tabindex의 **폴백** 분기를 세 픽커에서 함께 잠근다(claude-review PR #743 P1).
 *
 * APG radio group의 roving tabindex는 "선택된 radio만 tabIndex 0"이라, 지금 `value`가 옵션
 * 목록 어디와도 안 맞으면 **전부 -1이 되어 그룹 전체가 Tab으로 못 닿는다.** 복원된 draft가
 * 폐기된 material/coating/layout 값을 들고 있으면 실제로 그 상태가 된다(#475 마이그레이션이
 * 겪은 부류). 그래서 세 픽커가 "아무 칩도 안 맞을 때만 첫 칩이 탭 스톱을 대신 맡는" 같은
 * 폴백을 갖는데, 그 분기 자체를 검증하는 테스트가 어디에도 없었다.
 *
 * 계약이 세 픽커 공통이라 파일 하나에서 셋을 함께 잰다 — 한 곳만 고치고 나머지를 빠뜨리는 게
 * 정확히 이 부류가 재발하는 방식이다.
 *
 * 실패할 수 있는 단언의 received에 DOM 엘리먼트를 넣지 않는다(#693).
 */
import { useState } from 'react';
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LayoutId } from '@/types';
import { LayoutStrip } from '@/components/LayoutPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import ColorPicker from '@/components/wizard/ColorPicker';
import { MATERIAL_OPTIONS } from '@/utils/constants';

afterEach(cleanup);

/** 그룹의 탭 스톱(tabIndex 0)이 정확히 하나이고 그게 첫 칩인지. */
function expectFirstChipIsTheOnlyTabStop() {
  const radios = screen.getAllByRole('radio');
  const tabStops = radios.filter((r) => r.getAttribute('tabindex') === '0');
  expect(tabStops.length).toBe(1);
  expect(tabStops[0] === radios[0]).toBe(true);
}

describe('값이 옵션 목록에 없어도 그룹이 Tab으로 닿는다 (#730 roving tabindex 폴백)', () => {
  test('무드 스트립 — 폐기된 layout id를 들고 있어도 첫 칩이 탭 스톱을 맡는다', async () => {
    const user = userEvent.setup();
    // 복원된 draft가 지금 LAYOUTS에 없는 무드를 들고 있는 상태.
    render(<LayoutStrip value={'폐기된무드' as LayoutId} onChange={() => {}} />);

    // 선택된 칩은 하나도 없다 — 폴백이 없으면 여기서 탭 스톱이 0개가 된다.
    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expectFirstChipIsTheOnlyTabStop();

    await user.tab();
    expect(document.activeElement === screen.getAllByRole('radio')[0]).toBe(true);
  });

  test('후보정 픽커 — 폐기된 material 값을 들고 있어도 첫 칩이 탭 스톱을 맡는다', async () => {
    const user = userEvent.setup();
    render(
      <TexturePicker
        axis="material"
        options={MATERIAL_OPTIONS}
        value="폐기된재질"
        onChange={() => {}}
        croppedImageUrl={null}
        ariaLabel="재질"
      />
    );

    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expectFirstChipIsTheOnlyTabStop();

    await user.tab();
    expect(document.activeElement === screen.getAllByRole('radio')[0]).toBe(true);
  });

  test('컬러 픽커 — 커스텀 색을 쓰는 중이어도 첫 스와치가 탭 스톱을 맡는다', async () => {
    const user = userEvent.setup();
    // 프리셋·추천색 어디에도 없는 색 = isCustom. 스와치 중 선택 상태가 하나도 없다.
    render(<ColorPicker value="#123456" onChange={() => {}} recommended={[]} />);

    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expectFirstChipIsTheOnlyTabStop();

    await user.tab();
    expect(document.activeElement === screen.getAllByRole('radio')[0]).toBe(true);
  });

  test('값이 목록에 있으면 폴백은 안 걸린다 — 탭 스톱은 선택된 칩 하나뿐이다', () => {
    render(
      <TexturePicker
        axis="material"
        options={MATERIAL_OPTIONS}
        value={MATERIAL_OPTIONS[1].value}
        onChange={() => {}}
        croppedImageUrl={null}
        ariaLabel="재질"
      />
    );

    const radios = screen.getAllByRole('radio');
    const tabStops = radios.filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabStops.length).toBe(1);
    // 첫 칩이 아니라 **선택된** 칩이다 — 폴백이 무조건 걸리면 여기서 갈린다.
    expect(tabStops[0] === radios[1]).toBe(true);
    expect(tabStops[0] === radios[0]).toBe(false);
  });
});

describe('선택을 옮기면 탭 스톱도 따라 옮겨간다', () => {
  test('방향키로 선택이 이동하면 tabIndex 0도 그 칩으로 간다', async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<string>(MATERIAL_OPTIONS[0].value);
      return (
        <TexturePicker
          axis="material"
          options={MATERIAL_OPTIONS}
          value={value}
          onChange={setValue}
          croppedImageUrl={null}
          ariaLabel="재질"
        />
      );
    }
    render(<Controlled />);

    await user.tab();
    await user.keyboard('{ArrowRight}');

    const radios = screen.getAllByRole('radio');
    const tabStops = radios.filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabStops.length).toBe(1);
    expect(tabStops[0] === radios[1]).toBe(true);
  });
});
