import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import Home from '@/pages/index';

/**
 * #781 — 크기 → 로고 패널이 조절 대상이 없는 상태(이미지·텍스트 둘 다 없음)와 숨긴 상태를 가려서 알려주고,
 * 슬라이더 옆 액션이 기존 로고 입력(인플레이스 편집)으로 데려간다. 슬라이더는 어느 상태에서도 켜져 있다 —
 * 텍스트 라벨만 있어도 스탬프가 scale로 조절되고, 입력 전에 크기를 미리 정해 둘 수 있어야 해서다.
 * 실제 Home 배선(셸 handleField → DesignRail → SizePanel)을 거친다.
 */

const EMPTY = '극장 로고가 비어 있어요. 이미지나 텍스트를 입력하세요.';
const HIDDEN = '극장 로고가 숨겨져 있어요.';

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); window.localStorage.clear(); });

const draft = (components: object) => window.localStorage.setItem('filme:phototicket:v1', JSON.stringify({
  movieInfo: { title: '영화', releaseDate: '2026' },
  components,
}));

async function openLogoAxis() {
  fireEvent.click(await screen.findByTestId('landing-restore'));
  // 인플레이스 편집기는 프리뷰(280ms debounce)의 [data-field-tap] 앵커를 잰다 — 복원 직후엔 기다린다.
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  fireEvent.click(screen.getByRole('button', { name: '크기' }));
  fireEvent.click(screen.getByRole('radio', { name: '로고' }));
}

test('#781 — 빈 로고는 안내와 입력 액션을 주고, 입력하면 안내가 사라지며 크기 값은 그대로다', async () => {
  draft({ chainScale: 0.7, chainVisible: true, formatVisible: true });
  render(<Home />);
  await openLogoAxis();

  expect(screen.getByText(EMPTY).textContent).toBe(EMPTY);
  const slider = screen.getByRole('slider', { name: '극장 로고 크기' }) as HTMLInputElement;
  expect(slider.disabled).toBe(false);
  expect(slider.value).toBe('0.7');

  fireEvent.click(screen.getByRole('button', { name: '극장 로고 크기 — 입력' }));
  const input = await screen.findByRole('textbox', { name: '극장 로고' });
  fireEvent.change(input, { target: { value: 'CINEMA' } });
  fireEvent.click(screen.getByRole('button', { name: '편집 완료' }));

  // 패널로 돌아오면 안내와 액션이 함께 사라진다(정상 상태는 main과 같은 높이 — 슬롯 예산). 입력 전에 정해 둔
  // 크기는 유지된다.
  expect(!!screen.queryByText(EMPTY)).toBe(false);
  expect(!!screen.queryByRole('button', { name: /^극장 로고 크기 — / })).toBe(false);
  expect(slider.value).toBe('0.7');
});

test('#781 — 텍스트만 있는 로고는 안내 없이 조절되고, 숨기면 숨김 안내와 표시·편집 액션이 뜬다', async () => {
  draft({ chainLabel: 'CINEMA', chainVisible: true, formatVisible: true });
  render(<Home />);
  await openLogoAxis();

  expect(!!screen.queryByText(EMPTY)).toBe(false);
  expect(!!screen.queryByText(HIDDEN)).toBe(false);
  expect(!!screen.queryByRole('button', { name: /^극장 로고 크기 — / })).toBe(false);
  const slider = screen.getByRole('slider', { name: '극장 로고 크기' }) as HTMLInputElement;
  fireEvent.change(slider, { target: { value: '0.9' } });
  expect(slider.value).toBe('0.9');

  fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
  const drawer = await screen.findByRole('dialog', { name: '티켓 항목' });
  fireEvent.click(within(drawer).getByRole('switch', { name: '극장 로고 티켓에 표시' }));
  fireEvent.keyDown(document, { key: 'Escape' });

  // 숨김은 빈 상태와 다른 문구다. 슬라이더는 계속 켜져 있고 값도 그대로다.
  expect(screen.getByText(HIDDEN).textContent).toBe(HIDDEN);
  expect(!!screen.queryByText(EMPTY)).toBe(false);
  expect(slider.disabled).toBe(false);
  expect(slider.value).toBe('0.9');

  // 표시·편집은 숨긴 로고를 다시 켜고(handleField의 자동 표시) 로고 입력을 연다.
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  fireEvent.click(screen.getByRole('button', { name: '극장 로고 크기 — 표시·편집' }));
  expect(!!(await screen.findByRole('textbox', { name: '극장 로고' }))).toBe(true);
  expect(!!screen.queryByText(HIDDEN)).toBe(false);
});
