/**
 * #826 S2 E-01 — 편집 상단 줄: 버튼 순서와 실행 취소 · 다시 실행 배선.
 *
 * 순서는 ‹ '랜딩으로 돌아가기' · '실행 취소' · '다시 실행' · '전체 보기' · '편집 메뉴' · '완료'다(마스터 C-TB). 실행 취소는
 * '되돌렸어요', 다시 실행은 '다시 실행했어요' 통보 토스트(E-06)를 띄우고 값을 실제로 되돌리고 되살린다.
 */
import { afterEach, beforeEach, expect, test, jest } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.updateMovieInfo({ title: '괴물' })}>
        edit
      </button>
      <output data-testid="title-value">{photo.state.movieInfo.title}</output>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  jest.useRealTimers();
});

// 히스토리 1스텝은 350ms 디바운스다(useEditHistory) — 실시간으로 넘긴다.
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 400)); });
const title = () => screen.getByTestId('title-value').textContent;

test('상단 줄 버튼은 ‹ · 실행 취소 · 다시 실행 · 전체 보기 · 편집 메뉴 · 완료 순서다', () => {
  render(<Harness />);
  fireEvent.click(screen.getByTestId('landing-skip-poster'));

  const header = document.querySelector('header') as HTMLElement;
  const names = within(header).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent?.trim());
  expect(names).toEqual(['랜딩으로 돌아가기', '실행 취소', '다시 실행', '전체 보기', '편집 메뉴', '완료']);
});

test('실행 취소는 값을 되돌리고 "되돌렸어요", 다시 실행은 되살리고 "다시 실행했어요"를 띄운다', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByTestId('landing-skip-poster'));
  await settle(); // 빈 문서 베이스라인
  fireEvent.click(screen.getByText('edit'));
  await settle();
  expect(title()).toBe('괴물');

  const undo = screen.getByRole('button', { name: '실행 취소' });
  const redo = screen.getByRole('button', { name: '다시 실행' });
  expect((redo as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(undo);
  expect(title()).toBe('');
  expect(screen.getByTestId('global-toast').textContent).toBe('되돌렸어요');
  expect(screen.getByTestId('global-toast').getAttribute('data-tone')).toBe('notice');

  expect((redo as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(redo);
  expect(title()).toBe('괴물');
  expect(screen.getByTestId('global-toast').textContent).toBe('다시 실행했어요');
});
