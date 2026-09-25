import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import Home from '@/pages/index';
import { useDebounce } from '@/hooks/useDebounce';

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); window.localStorage.clear(); });

const draft = () => window.localStorage.setItem('filme:phototicket:v1', JSON.stringify({
  movieInfo: { title: '영화', releaseDate: '2026', signature: 'AB' },
}));
const shownSignature = () => document.querySelector('[data-field-tap="signature"]')?.textContent ?? '';

// 실제 Home 배선을 거친다. 셸에 live props를 직접 주면 #775를 재현할 수 없다.
// 인플레이스 input은 글자가 투명하고(#365) 보이는 글자는 티켓 렌더가 그리므로, "즉시 보인다"는
// input 값이 아니라 티켓의 [data-field-tap] 글자로 잰다.
test('#775 — 연속 입력·조합·삭제가 지연 없이 티켓에 보이고 닫자마자 완료해도 최신 값이다', async () => {
  draft();
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  fireEvent.click(await screen.findByRole('button', { name: '서명 편집' }));
  const input = await screen.findByRole('textbox', { name: '서명' }) as HTMLInputElement;
  // 투명 캐럿 유지(#365·#494) — 불투명 입력칸으로 바꿔서 푸는 게 아니다.
  expect(input.style.color).toBe('transparent');
  for (const value of ['ABC', 'ABCD', 'ABC', 'A한BC']) {
    fireEvent.change(input, { target: { value } });
    expect(shownSignature()).toContain(value);
  }
  fireEvent.compositionStart(input);
  for (const value of ['AㅎBC', 'A하BC', 'A한BC']) {
    fireEvent.change(input, { target: { value } });
    expect(shownSignature()).toContain(value);
    // 조합 중 리렌더가 input을 갈아끼우면 IME 조합이 끊긴다.
    expect(screen.getByRole('textbox', { name: '서명' }) === input).toBe(true);
  }
  fireEvent.compositionEnd(input, { data: '한' });
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));
  expect(shownSignature()).toContain('A한BC');
  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  // 편집 셸은 결과 화면 뒤에 숨은 채 마운트돼 있으니(#297) 결과 스테이지 루트로 범위를 좁힌다.
  const back = await screen.findByLabelText('편집으로 돌아가기');
  expect(back.closest('.app-canvas')?.textContent ?? '').toContain('A한BC');
});

// 툴바의 '티켓 항목 목록'은 activeField를 안 지워 인플레이스 편집기가 열린 채 드로어가 뜬다(#685).
// 그때 입력은 드로어 쪽이라 셸이 fieldEditing을 false로 돌려 debounce가 돌아와야 한다 — 이 분기가
// 빠지면 드로어 뒤에서 모든 변경이 매 렌더 즉시 프리뷰로 흘러간다.
test('#775 — 직접 편집 중 드로어를 열면 프리뷰 debounce가 돌아온다', async () => {
  draft();
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  fireEvent.click(await screen.findByRole('button', { name: '서명 편집' }));
  const input = await screen.findByRole('textbox', { name: '서명' }) as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'ABC' } });
  expect(shownSignature()).toContain('ABC');
  fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록' }));
  await screen.findByRole('dialog');
  // 편집기는 드로어 뒤에 마운트된 채 남는다 — 같은 input으로 값을 바꿔 debounce 여부만 가른다.
  expect(input.isConnected).toBe(true);
  fireEvent.change(input, { target: { value: 'ABCD' } });
  expect(shownSignature()).not.toContain('ABCD');
  await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
  expect(shownSignature()).toContain('ABCD');
});

test('#775 — 직접 편집을 끝낸 값은 유지하고 일반 미리보기 변경은 계속 지연한다', async () => {
  const { result, rerender } = renderHook(({ value, immediate }) => useDebounce(value, 50, immediate), {
    initialProps: { value: 'old', immediate: false },
  });
  rerender({ value: 'typed', immediate: true });
  expect(result.current).toBe('typed');
  rerender({ value: 'typed', immediate: false });
  expect(result.current).toBe('typed');
  rerender({ value: 'slider', immediate: false });
  expect(result.current).toBe('typed');
  await act(async () => { await new Promise((r) => setTimeout(r, 70)); });
  expect(result.current).toBe('slider');
});
