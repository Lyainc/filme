import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import Home from '@/pages/index';
import { useDebounce } from '@/hooks/useDebounce';

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); window.localStorage.clear(); });

const draft = (extra = {}) => window.localStorage.setItem('filme:phototicket:v1', JSON.stringify({
  movieInfo: { title: '영화', releaseDate: '2026', signature: 'AB' }, ...extra,
}));

// 실제 Home 배선을 거친다. 셸에 live props를 직접 주면 #775를 재현할 수 없다.
test('#775 — 연속 입력·조합·삭제가 지연 없이 표시되고 닫자마자 완료해도 최신 값이다', async () => {
  draft();
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  const signature = await screen.findByRole('button', { name: '서명 편집' });
  fireEvent.click(signature);
  const input = await screen.findByRole('textbox', { name: '서명' }) as HTMLInputElement;
  for (const value of ['ABC', 'ABCD', 'ABC', 'A한BC']) {
    fireEvent.change(input, { target: { value } });
    expect(document.querySelector('[data-field-tap="signature"]')!.textContent).toContain(value);
  }
  fireEvent.compositionStart(input);
  for (const value of ['AㅎBC', 'A하BC', 'A한BC']) {
    fireEvent.change(input, { target: { value } });
    expect(document.querySelector('[data-field-tap="signature"]')!.textContent).toContain(value);
    expect(screen.getByRole('textbox', { name: '서명' }) === input).toBe(true);
  }
  fireEvent.compositionEnd(input, { data: '한' });
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));
  expect(document.querySelector('[data-field-tap="signature"]')!.textContent).toContain('A한BC');
  fireEvent.click(screen.getByRole('button', { name: '완료' }));
  const result = await screen.findByTestId('result-stage');
  expect(result.textContent).toContain('A한BC');
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

test('#776/#777 — 완료 전 필수 안내와 명시적인 목록 경로, 숨긴 개봉일에도 필수 안내', async () => {
  draft({ movieInfo: { title: '', releaseDate: '' }, fieldVisibility: { releaseDate: false } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  expect(screen.getByRole('button', { name: '완료' }).textContent).toContain('제목·연도 필요');
  fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
  const drawer = await screen.findByRole('dialog', { name: '티켓 항목' });
  expect(within(drawer).getByRole('switch', { name: '개봉일 티켓에 표시' }).getAttribute('aria-checked')).toBe('false');
  expect(drawer.textContent).toContain('개봉일을 숨겨도 연도는 입력하세요.');
  expect(!!within(drawer).getByRole('button', { name: '개봉연도 입력' })).toBe(true);
  fireEvent.click(within(drawer).getByRole('button', { name: '제목 입력' }));
  fireEvent.change(await screen.findByRole('textbox', { name: '제목' }), { target: { value: '새 영화' } });
  expect(screen.getByRole('button', { name: '완료' }).textContent).toContain('연도 필요');
  expect(screen.getByRole('button', { name: '완료' }).textContent).not.toContain('제목');
});

test('#781 — 빈 로고 입력 경로, 텍스트 로고 크기와 숨김 안내를 유지한다', async () => {
  draft({ components: { chainScale: 0.7, chainVisible: true, formatVisible: true } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  fireEvent.click(screen.getByRole('button', { name: '크기' }));
  fireEvent.click(screen.getByRole('radio', { name: '로고' }));
  expect(!!screen.getByText('극장 로고가 비어 있어요. 이미지나 텍스트를 입력하세요.')).toBe(true);
  const slider = screen.getByRole('slider', { name: '체인 로고 크기' }) as HTMLInputElement;
  expect(slider.disabled).toBe(false);
  expect(slider.value).toBe('0.7');
  fireEvent.click(screen.getByRole('button', { name: '체인 로고 크기 — 입력' }));
  const input = await screen.findByRole('textbox', { name: '극장 로고' });
  fireEvent.change(input, { target: { value: 'CINEMA' } });
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));
  expect(!!screen.queryByText('극장 로고가 비어 있어요. 이미지나 텍스트를 입력하세요.')).toBe(false);
  expect(slider.value).toBe('0.7');
  fireEvent.change(slider, { target: { value: '0.9' } });
  expect(slider.value).toBe('0.9');
  fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
  const drawer = await screen.findByRole('dialog', { name: '티켓 항목' });
  fireEvent.click(within(drawer).getByRole('switch', { name: '극장 로고 티켓에 표시' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(!!screen.getByText('극장 로고가 숨겨져 있어요.')).toBe(true);
  expect(slider.disabled).toBe(false);
  expect(slider.value).toBe('0.9');
});

test('#777 — Criterion의 작은 한줄평도 목록에서 편집할 수 있다', async () => {
  draft({ components: { layout: 'criterion' } });
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
  const drawer = await screen.findByRole('dialog', { name: '티켓 항목' });
  fireEvent.click(within(drawer).getByRole('button', { name: '한줄평 편집' }));
  const input = await screen.findByRole('textbox', { name: '한줄평' });
  fireEvent.change(input, { target: { value: '나의 한줄평' } });
  expect(document.querySelector('[data-field-tap="quote"]')!.textContent).toContain('나의 한줄평');
});
