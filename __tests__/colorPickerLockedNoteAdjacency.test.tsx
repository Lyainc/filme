/**
 * Regression test for #678 (컬러 패널 재설계).
 *
 * Two behaviors the redesign must hold:
 *  - the hex input no longer occupies the full row width on its own — it sits
 *    inline with the swatch row instead of a dedicated w-full row.
 *  - the disabled-mood lock note (disabledNote) renders as the sibling
 *    immediately AFTER the control row (swatches + hex), not before it. The
 *    prior layout put the note at the very top of the panel, so scrolling
 *    the rail slot down to reach the hex input pushed the note itself off
 *    screen — the exact "안내문구가 컨트롤과 분리된다" complaint in #678.
 *
 * Also guards the underlying swatch-click / hex-typing wiring still calls
 * onChange, since the markup around them changed.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColorPicker from '../src/components/wizard/ColorPicker';

afterEach(cleanup);

const NOTE = '이 무드는 톤이 고정이라 잉크 색을 바꿀 수 없어요.';

describe('#678 ColorPicker 레이아웃', () => {
  test('enabled: 스와치 클릭 → onChange(hex)', async () => {
    const user = userEvent.setup();
    let picked = '';
    render(
      <ColorPicker value="#FFFFFF" onChange={(v) => { picked = v; }} recommended={[]} />,
    );
    await user.click(screen.getByRole('button', { name: '검정' }));
    expect(picked).toBe('#000000');
  });

  test('enabled: 헥스 입력 → onChange(비-hex 문자 제거·6자 제한)', () => {
    let picked = '';
    render(
      <ColorPicker value="#FFFFFF" onChange={(v) => { picked = v; }} recommended={[]} />,
    );
    const input = screen.getByLabelText('색상 코드');
    fireEvent.change(input, { target: { value: 'zzAB12CDzz' } });
    expect(picked).toBe('#AB12CD');
  });

  test('enabled: 헥스 입력이 슬롯 폭 전체를 차지하는 w-full 행이 아니다', () => {
    const { container } = render(
      <ColorPicker value="#FFFFFF" onChange={() => {}} recommended={[]} />,
    );
    const input = screen.getByLabelText('색상 코드');
    expect(input.className).not.toContain('w-full');
    // 스와치·커스텀·헥스가 전부 같은 flex-wrap 행 안에 있다 — 헥스 전용 행이 따로 없다.
    const root = container.firstElementChild as HTMLElement;
    expect(root.children.length).toBe(1);
    expect(root.children[0].contains(input)).toBe(true);
    expect(root.children[0].contains(screen.getByRole('button', { name: '흰색' }))).toBe(true);
  });

  test('disabled: 스와치·헥스 입력이 비활성화되고 잠금 안내가 컨트롤 바로 다음 형제로 붙는다', () => {
    const { container } = render(
      <ColorPicker
        value="#FFFFFF"
        onChange={() => {}}
        recommended={[]}
        disabled
        disabledNote={NOTE}
      />,
    );
    expect((screen.getByRole('button', { name: '흰색' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('색상 코드') as HTMLInputElement).disabled).toBe(true);

    const note = screen.getByText(NOTE);
    const root = container.firstElementChild as HTMLElement;
    // 컨트롤 행 + 안내문, 이 순서 두 형제뿐이어야 한다 — 안내문이 패널 맨 위(첫 형제)로
    // 되돌아가면 이 테스트가 깨진다.
    expect(root.children.length).toBe(2);
    expect(root.children[1]).toBe(note);
    expect(root.children[0].contains(screen.getByLabelText('색상 코드'))).toBe(true);
  });
});
