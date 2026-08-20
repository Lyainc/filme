/**
 * Regression test for #678 (컬러 패널 재설계) + #730 (헥스 입력 제거 + 선택 상태 접근성).
 *
 * #730이 헥스 텍스트 입력을 통째로 지우면서, 헥스 새니타이즈·헥스 폭 두 케이스는 대상 자체가
 * 없어져 삭제했다(c10 — 안내 인접 명제는 헥스와 무관하게 계속 유효해 유지, 헥스 폭 명제만
 * 소멸). 남은 두 축:
 *  - the disabled-mood lock note (disabledNote) renders as the sibling
 *    immediately AFTER the control row (swatches), not before it. The prior
 *    layout put the note at the very top of the panel, so scrolling the rail
 *    slot down to reach the controls pushed the note itself off screen — the
 *    exact "안내문구가 컨트롤과 분리된다" complaint in #678.
 *  - 선택 상태가 role="radio"/aria-checked로 노출되고(#730 c2), 커스텀 색 입력은
 *    radiogroup 밖이다(c4). 스와치 탭 타깃은 46px를 유지한다(c7·ac7).
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorPicker from '../src/components/wizard/ColorPicker';
import { assertNoShrink, expectMeetsAA } from './tapTargets';

afterEach(cleanup);

const NOTE = '이 무드는 톤이 고정이라 잉크 색을 바꿀 수 없어요.';

describe('#678 ColorPicker 레이아웃', () => {
  test('enabled: 스와치 클릭 → onChange(hex)', async () => {
    const user = userEvent.setup();
    let picked = '';
    render(
      <ColorPicker value="#FFFFFF" onChange={(v) => { picked = v; }} recommended={[]} />,
    );
    await user.click(screen.getByRole('radio', { name: '검정' }));
    expect(picked).toBe('#000000');
  });

  test('enabled: 커스텀 색 입력 → onChange(임의 hex) (ac5 — 헥스 텍스트 입력 제거 후에도 유효)', () => {
    let picked = '';
    render(
      <ColorPicker value="#FFFFFF" onChange={(v) => { picked = v; }} recommended={[]} />,
    );
    const input = screen.getByLabelText('직접 지정');
    fireEvent.change(input, { target: { value: '#ab12cd' } });
    expect(picked).toBe('#ab12cd');
  });

  test('disabled: 스와치가 비활성화되고 잠금 안내가 컨트롤 바로 다음 형제로 붙는다', () => {
    const { container } = render(
      <ColorPicker
        value="#FFFFFF"
        onChange={() => {}}
        recommended={[]}
        disabled
        disabledNote={NOTE}
      />,
    );
    expect((screen.getByRole('radio', { name: '흰색' }) as HTMLButtonElement).disabled).toBe(true);

    const note = screen.getByText(NOTE);
    const root = container.firstElementChild as HTMLElement;
    // 컨트롤 행 + 안내문, 이 순서 두 형제뿐이어야 한다 — 안내문이 패널 맨 위(첫 형제)로
    // 되돌아가면 이 테스트가 깨진다.
    expect(root.children.length).toBe(2);
    expect(root.children[1]).toBe(note);
    expect(root.children[0].contains(screen.getByRole('radio', { name: '흰색' }))).toBe(true);
  });
});

describe('#730 ColorPicker 선택 상태 접근성', () => {
  test('선택된 스와치만 aria-checked="true"이고 커스텀 입력은 radiogroup 밖이다 (ac3)', () => {
    const { container } = render(
      <ColorPicker value="#000000" onChange={() => {}} recommended={[]} />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3); // 프리셋 3(흰색·검정·골드), 추천색 없음

    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0].getAttribute('aria-label')).toBe('검정');
    expect(radios.filter((r) => r.getAttribute('aria-checked') === 'false')).toHaveLength(2);

    const group = screen.getByRole('radiogroup', { name: '잉크 색' });
    expect(group.querySelector('input[type="color"]')).toBeNull();
    // 커스텀 트리거는 사라진 게 아니라 radiogroup 밖으로 옮겨졌을 뿐이다.
    expect(container.querySelector('input[type="color"]')).not.toBeNull();
  });

  test('방향키로 스와치 간 포커스+선택이 이동한다 (ac4)', async () => {
    const user = userEvent.setup();
    let picked = '';
    render(
      <ColorPicker value="#FFFFFF" onChange={(v) => { picked = v; }} recommended={[]} />,
    );
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '흰색' }));

    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: '골드' }));
    expect(picked).toBe('#E5B469');

    // 그룹은 Tab 한 번만 받는다 — 다음 Tab은 그룹을 벗어나 커스텀 트리거로 간다.
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('직접 지정'));
  });

  test('스와치 탭 타깃이 46px를 유지하고 축소 우회가 없다 (ac7)', () => {
    render(<ColorPicker value="#FFFFFF" onChange={() => {}} recommended={[]} />);
    for (const radio of screen.getAllByRole('radio')) {
      for (const el of [radio, ...Array.from(radio.querySelectorAll('*'))]) {
        assertNoShrink(el, `스와치 ${radio.getAttribute('aria-label')}`);
      }
      const { w, h } = expectMeetsAA(radio, `스와치 ${radio.getAttribute('aria-label')}`);
      expect([w, h]).toEqual([46, 46]);
    }
  });
});
