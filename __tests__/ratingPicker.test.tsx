/**
 * #384 회귀 테스트 — 평점 0.1단위 입력.
 *
 * (a) 숫자 입력(0.1 step)으로 타이핑한 값이 그대로 텍스트 표시(★ x.x / 5.0)에 반영.
 * (b) 별 아이콘 채움은 0.5 단위로 내림(#384 결정 스펙: 3.3 → 별 3개, 3.5~3.9 → 별 3개 반).
 * (d) 숫자 입력 clamp — 범위 밖 값(음수, 5 초과)은 0~5로 제한(claude-review PR #409 P1 2차).
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RatingPicker from '@/components/wizard/RatingPicker';

function Harness() {
  const [rating, setRating] = useState(0);
  return <RatingPicker value={rating} onValueChange={setRating} visible={true} onVisibleChange={() => {}} />;
}

function starFillWidth(starIndex: number): string {
  const radio = screen.getAllByRole('radio')[starIndex - 1];
  const overlay = radio.querySelector('span > span');
  return (overlay as HTMLElement).style.width;
}

afterEach(cleanup);

describe('RatingPicker (#384)', () => {
  test('(a) 숫자 입력값이 그대로 텍스트 표시에 반영', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' });
    await user.clear(input);
    await user.type(input, '3.3');

    expect(screen.getByText('3.3')).toBeTruthy();
  });

  test('(b) 별 채움은 0.5 단위로 내림 — 3.3 → 별 3개(반개 없음)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' });
    await user.clear(input);
    await user.type(input, '3.3');

    expect(starFillWidth(1)).toBe('100%');
    expect(starFillWidth(2)).toBe('100%');
    expect(starFillWidth(3)).toBe('100%');
    expect(starFillWidth(4)).toBe('0%');
    expect(starFillWidth(5)).toBe('0%');
  });

  test('(c) 별 채움은 0.5 단위로 내림 — 3.7 → 별 3개 반', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' });
    await user.clear(input);
    await user.type(input, '3.7');

    expect(starFillWidth(3)).toBe('100%');
    expect(starFillWidth(4)).toBe('50%');
    expect(starFillWidth(5)).toBe('0%');
  });

  test('(d) 숫자 입력 clamp — 음수는 0으로, 5 초과는 5로 제한', () => {
    render(<Harness />);

    // fireEvent.change로 값을 직접 주입 — user.type은 number input이 '-' 키 입력을
    // 문자 단위로 걸러내(happy-dom 네이티브 검증) 음수 조합이 실제로 안 들어간다.
    const input = screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' });

    fireEvent.change(input, { target: { value: '-1' } });
    expect(screen.getByText('0.0')).toBeTruthy();

    fireEvent.change(input, { target: { value: '10' } });
    expect(screen.getByText('5.0')).toBeTruthy();
  });

  test('(e) 지우는 중엔 0을 커밋하지 않는다 — 값을 지운 채 블러해도 이전 값 유지(#190 nit)', () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' });

    fireEvent.change(input, { target: { value: '4' } });
    expect(screen.getByText('4.0')).toBeTruthy();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(screen.getByText('4.0')).toBeTruthy();
  });
});
