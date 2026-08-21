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
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

// claude-review PR #743 P1 라운드 2 — `radioGroupKeyboard.ts`는 세 픽커가 공유하는 신규
// 인프라라 계약이 깨지면 셋이 동시에 깨진다. 그런데 잠겨 있던 건 편도 이동(한 칸 좌/우)뿐이고
// Home/End·경계 순환·disabled 배제는 어디서도 안 재고 있었다. 소비처 하나(후보정 픽커)로
// 계약 전체를 잠근다 — 셋이 같은 핸들러를 쓰므로 계약 하나로 셋을 검증한다.
describe('공유 키보드 계약 전체 — Home/End · 경계 순환 · disabled 배제 (#730 c3)', () => {
  function Controlled({ initial }: { initial?: string }) {
    const [value, setValue] = useState<string>(initial ?? MATERIAL_OPTIONS[0].value);
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

  const checked = () =>
    screen.getAllByRole('radio').findIndex((r) => r.getAttribute('aria-checked') === 'true');
  const last = () => screen.getAllByRole('radio').length - 1;

  test('End는 마지막으로, Home은 첫 항목으로 간다', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();

    await user.keyboard('{End}');
    expect(checked()).toBe(last());

    await user.keyboard('{Home}');
    expect(checked()).toBe(0);
  });

  test('마지막에서 오른쪽은 첫 항목으로 순환한다', async () => {
    const user = userEvent.setup();
    render(<Controlled initial={MATERIAL_OPTIONS[MATERIAL_OPTIONS.length - 1].value} />);
    await user.tab();
    expect(checked()).toBe(last());

    await user.keyboard('{ArrowRight}');
    expect(checked()).toBe(0);
  });

  test('첫 항목에서 왼쪽은 마지막으로 순환한다', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();
    expect(checked()).toBe(0);

    await user.keyboard('{ArrowLeft}');
    expect(checked()).toBe(last());
  });

  test('세로 방향키도 같은 축으로 동작한다 — 소비처가 전부 가로 한 줄이라 등가다', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.tab();

    await user.keyboard('{ArrowDown}');
    expect(checked()).toBe(1);

    await user.keyboard('{ArrowUp}');
    expect(checked()).toBe(0);
  });

  // disabled 그룹(색이 고정된 35mm 무드)에서 방향키가 색을 바꾸지 않는다는 사용자 명제를 잰다.
  //
  // **핸들러의 `:not([disabled])` 배제 자체는 이 자리에서 잠기지 않는다** — 배제를 걷어내도
  // 이 테스트는 통과한다(실측). 순회 대상에 들어가더라도 disabled 버튼의 `.click()`이 no-op이라
  // 결과가 같아서다. 배제가 관측 가능한 차이를 내려면 **일부만** disabled인 그룹이 필요한데
  // 세 소비처 중 그런 구조가 없다(컬러 픽커는 전부 disabled이거나 전부 아니다). 그 축을 재려면
  // 먼저 그런 소비처가 생겨야 한다.
  test('전부 disabled면 방향키가 선택을 안 바꾼다', () => {
    render(
      <ColorPicker value="#FFFFFF" onChange={() => {}} recommended={[]} disabled disabledNote="고정" />
    );

    const group = screen.getByRole('radiogroup', { name: '잉크 색' });
    const before = screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked')).join();

    // disabled 칩은 포커스를 못 받으므로 컨테이너에 직접 키를 보낸다(핸들러가 붙은 자리다).
    fireEvent.keyDown(group, { key: 'ArrowRight' });

    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked')).join()).toBe(before);
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
