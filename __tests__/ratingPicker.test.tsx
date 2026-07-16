/**
 * #384 회귀 테스트 — 평점 0.1단위 입력.
 *
 * (a) 숫자 입력(0.1 step)으로 타이핑한 값이 그대로 텍스트 표시(★ x.x / 5.0)에 반영.
 * (b) 별 아이콘 채움은 Math.round(rating * 2) / 2로 0.5 단위 반올림(#391 PR #407과 동일 공식).
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
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

  test('(b) 별 채움은 0.5 단위로 반올림(3.3 → 별 3개 + 반개)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole('spinbutton', { name: '평점 직접 입력 (0.1 단위)' });
    await user.clear(input);
    await user.type(input, '3.3');

    expect(starFillWidth(1)).toBe('100%');
    expect(starFillWidth(2)).toBe('100%');
    expect(starFillWidth(3)).toBe('100%');
    expect(starFillWidth(4)).toBe('50%');
    expect(starFillWidth(5)).toBe('0%');
  });
});
