import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Home from '@/pages/index';

/**
 * #777 일부 — Criterion 한줄평을 항목 목록(FieldDrawer) 경로로도 연다. 작은 화면에서 온티켓 탭 타깃이
 * 작아질 때의 대체 경로다. 행 탭은 같은 인플레이스 편집기를 열고, 그 편집기의 prev/next 순회(EDIT_ORDER)에도
 * 한줄평이 들어 있어야 목록으로 들어온 뒤 이웃 필드로 오가다 돌아올 수 있다.
 */

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); window.localStorage.clear(); });

const draft = (layout: string) => window.localStorage.setItem('filme:phototicket:v1', JSON.stringify({
  movieInfo: { title: '영화', releaseDate: '2026', quote: '다시 볼 영화' },
  components: { layout },
}));

async function openDrawer() {
  fireEvent.click(await screen.findByTestId('landing-restore'));
  // 프리뷰는 280ms debounce 뒤에 복원된 무드로 바뀐다 — 편집기는 프리뷰의 [data-field-tap] 앵커를
  // 재므로, 그 전에 행을 누르면 기본 무드(한줄평 미렌더) 위에서 열리려다 조용히 안 뜬다.
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
  return screen.findByRole('dialog', { name: '티켓 항목' });
}

test('#777 — Criterion 항목 목록의 한줄평 행이 한줄평 인플레이스 편집을 연다', async () => {
  draft('criterion');
  render(<Home />);
  const drawer = await openDrawer();
  fireEvent.click(within(drawer).getByRole('button', { name: /^한줄평/ }));
  const input = await screen.findByRole('textbox', { name: '한줄평' }) as HTMLInputElement;
  expect(input.value).toBe('다시 볼 영화');

  // 순회에도 한줄평이 있다 — 이전으로 한 칸 갔다가 다음으로 돌아오면 다시 한줄평이다.
  fireEvent.click(screen.getByRole('button', { name: '이전 항목' }));
  expect(!!screen.queryByRole('textbox', { name: '한줄평' })).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: '다음 항목' }));
  expect(!!screen.queryByRole('textbox', { name: '한줄평' })).toBe(true);
});

test('#777 — 한줄평을 렌더하지 않는 무드의 항목 목록엔 한줄평 행이 없다', async () => {
  draft('minimal');
  render(<Home />);
  const drawer = await openDrawer();
  expect(within(drawer).queryAllByRole('button', { name: /^한줄평/ }).length).toBe(0);
});
