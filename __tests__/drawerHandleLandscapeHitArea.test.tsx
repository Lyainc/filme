import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import Home from '@/pages/index';

/**
 * #777 — 드로어 핸들의 투명 44px 히트박스가 가로 무드(editorial·35mm-landscape)에서 오른쪽 스텁
 * 필드를 덮어 필드 탭이 드로어를 열었다. 가로 무드만 버튼을 pointer-events-none으로 두고 보이는
 * 24px span만 받는다. 세로 무드는 44px 히트박스를 그대로 유지한다.
 */

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); window.localStorage.clear(); });

const draft = (layout: string) => window.localStorage.setItem('filme:phototicket:v1', JSON.stringify({
  movieInfo: { title: '영화', releaseDate: '2026' },
  components: { layout },
}));

async function handleFor(layout: string) {
  draft(layout);
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  return screen.getByRole('button', { name: '티켓 항목 목록 열기' });
}

test('#777 — 가로 무드는 핸들 버튼이 pointer-events-none이고 보이는 span만 받는다', async () => {
  const handle = await handleFor('editorial');
  expect(handle.classList.contains('pointer-events-none')).toBe(true);
  expect(handle.firstElementChild?.classList.contains('pointer-events-auto')).toBe(true);
});

test('#777 — 가로 무드에서도 핸들 클릭은 드로어를 연다', async () => {
  const handle = await handleFor('editorial');
  fireEvent.click(handle);
  expect(!!(await screen.findByRole('dialog', { name: '티켓 항목' }))).toBe(true);
});

test('#777 — 세로 무드는 핸들 44px 히트박스를 유지한다', async () => {
  const handle = await handleFor('minimal');
  expect(handle.classList.contains('pointer-events-none')).toBe(false);
});
