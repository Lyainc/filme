import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import Home from '@/pages/index';

/**
 * #777 — 드로어 핸들의 투명 44px 히트박스(보이는 탭 24px)가 티켓 필드 위에 얹히면 그 필드 탭을
 * 가로채 드로어가 열렸다(editorial 스텁, 393px Stub 가장자리). 필드와 겹칠 때만 버튼을
 * pointer-events-none으로 두고 보이는 span만 받는다. 겹치지 않으면 44px(#447)를 유지한다.
 *
 * happy-dom엔 레이아웃이 없어 rect를 스텁한다 — 실제 hit test는 scripts/measure-field-taps.mjs가 잰다.
 */

type Box = { left: number; right: number; top: number; bottom: number };
const HANDLE: Box = { left: 331, right: 375, top: 280, bottom: 376 };

const rect = (b: Box) =>
  ({ ...b, x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top, toJSON() {} }) as DOMRect;

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function handleWithField(box: Box) {
  window.localStorage.setItem('filme:phototicket:v1', JSON.stringify({
    movieInfo: { title: '영화', releaseDate: '2026' },
    components: { layout: 'editorial' },
  }));
  render(<Home />);
  fireEvent.click(await screen.findByTestId('landing-restore'));
  await act(async () => { await new Promise((r) => setTimeout(r, 350)); });
  const handle = screen.getByRole('button', { name: '티켓 항목 목록 열기' });
  // 프로토타입이 아니라 두 인스턴스에만 건다 — 프로토타입 스텁은 다른 테스트 파일로 샌다(실측).
  handle.getBoundingClientRect = () => rect(HANDLE);
  // 판정 대상은 티켓 상자가 아니라 필드 탭 대상이다. 나머지 필드는 happy-dom에서 0 크기라 제외된다.
  const field = document.querySelector('.crop-marks [data-field-tap]') as HTMLElement;
  field.getBoundingClientRect = () => rect(box);
  await act(async () => { window.dispatchEvent(new Event('resize')); });
  return handle;
}

test('#777 — 핸들이 티켓 필드 위에 얹히면 버튼은 pointer-events-none이고 보이는 span만 받는다', async () => {
  const handle = await handleWithField({ left: 327, right: 343, top: 280, bottom: 300 });
  expect(handle.classList.contains('pointer-events-none')).toBe(true);
  expect(handle.firstElementChild?.classList.contains('pointer-events-auto')).toBe(true);
});

test('#777 — 겹쳐서 좁혀져도 핸들 클릭은 드로어를 연다', async () => {
  const handle = await handleWithField({ left: 327, right: 343, top: 280, bottom: 300 });
  fireEvent.click(handle);
  expect(!!(await screen.findByRole('dialog', { name: '티켓 항목' }))).toBe(true);
});

test('#777 — 필드와 안 겹치면(티켓 상자와는 겹쳐도) 핸들 44px 히트박스를 유지한다', async () => {
  const handle = await handleWithField({ left: 40, right: 320, top: 280, bottom: 300 });
  expect(handle.classList.contains('pointer-events-none')).toBe(false);
});
