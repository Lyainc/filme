/**
 * #356 — 전역 undo/redo 히스토리 레이어(useEditHistory) 회귀.
 *
 * 1) 순수 코어(pushSnapshot): push / 동일 스냅샷 no-op / redo 가지 절단 / 캡 80.
 *    캡·절단은 시간이 안 걸리는 순수 함수로 검증한다(80스텝 × 350ms 디바운스 대기는 비현실적).
 * 2) 훅 통합(실제 usePhototicket 위): 350ms 디바운스가 연속 입력을 1스텝으로 묶는지,
 *    undo/redo 왕복, 그리고 undo 복원 직후 디바운스가 그 상태를 재push해 redo 가지를
 *    절단하지 않는지(복원 스냅샷 == stack[at]이라 no-op이어야 한다 — 여기가 깨지면
 *    undo하자마자 redo가 죽는다).
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { useEditHistory, pushSnapshot, HISTORY_CAP, type HistoryStack } from '@/hooks/useEditHistory';
import type { PhototicketState } from '@/types';

describe('pushSnapshot (순수 코어)', () => {
  test('변경이면 push하고 at이 끝을 따라간다', () => {
    const h0: HistoryStack = { stack: ['a'], at: 0 };
    const h1 = pushSnapshot(h0, 'b');
    expect(h1.stack).toEqual(['a', 'b']);
    expect(h1.at).toBe(1);
  });

  test('현재 스냅샷과 같으면 no-op(같은 참조 반환)', () => {
    const h0: HistoryStack = { stack: ['a', 'b'], at: 1 };
    expect(pushSnapshot(h0, 'b')).toBe(h0);
  });

  test('undo 위치에서 새 push는 redo 가지를 절단한다', () => {
    const h0: HistoryStack = { stack: ['a', 'b', 'c'], at: 0 }; // undo 2회 후
    const h1 = pushSnapshot(h0, 'd');
    expect(h1.stack).toEqual(['a', 'd']);
    expect(h1.at).toBe(1);
  });

  test('캡 초과 시 가장 오래된 것부터 버린다', () => {
    let h: HistoryStack = { stack: ['s0'], at: 0 };
    for (let i = 1; i <= HISTORY_CAP + 10; i++) h = pushSnapshot(h, `s${i}`);
    expect(h.stack.length).toBe(HISTORY_CAP);
    expect(h.stack[0]).toBe('s11'); // 90개 push 중 앞 11개 탈락
    expect(h.stack[HISTORY_CAP - 1]).toBe(`s${HISTORY_CAP + 10}`);
    expect(h.at).toBe(HISTORY_CAP - 1);
  });
});

// ── 훅 통합 ──────────────────────────────────────────────────────────────────
let captured: PhototicketState;
let hist: ReturnType<typeof useEditHistory>;

function Harness() {
  const photo = usePhototicket();
  captured = photo.state;
  hist = useEditHistory(photo);
  return (
    <>
      <button type="button" onClick={() => photo.updateMovieInfo({ theater: photo.state.movieInfo.theater + 'x' })}>
        edit
      </button>
      <button type="button" disabled={!hist.canUndo} onClick={hist.undo}>
        undo
      </button>
      <button type="button" disabled={!hist.canRedo} onClick={hist.redo}>
        redo
      </button>
    </>
  );
}

afterEach(cleanup);

const undoBtn = () => screen.getByText('undo') as HTMLButtonElement;
const redoBtn = () => screen.getByText('redo') as HTMLButtonElement;
const settle = () => waitFor(() => expect(undoBtn().disabled).toBe(false));
// 히스토리는 빈 스택으로 시작하고 마운트 후 첫 디바운스(350ms)가 베이스라인을 잡는다 —
// 그 윈도 안의 편집은 베이스라인에 뭉치므로(임시저장 복원 흡수 설계), 편집 전에 기다린다.
const mountSettle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });

describe('useEditHistory (usePhototicket 통합)', () => {
  test('연속 입력(350ms 내)은 1스텝 — undo 1회가 입력 단위를 통째로 되돌린다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(undoBtn().disabled).toBe(true);
    await mountSettle();

    // 세 번 연속 편집(디바운스 윈도 안) → 스냅샷 1개.
    await user.click(screen.getByText('edit'));
    await user.click(screen.getByText('edit'));
    await user.click(screen.getByText('edit'));
    expect(captured.movieInfo.theater).toBe('xxx');
    await settle();

    await user.click(undoBtn());
    expect(captured.movieInfo.theater).toBe('');
    expect(undoBtn().disabled).toBe(true); // 1스텝뿐이었다
  });

  test('undo → redo 왕복이 상태를 정확히 오간다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await mountSettle();
    await user.click(screen.getByText('edit'));
    await settle();

    await user.click(undoBtn());
    expect(captured.movieInfo.theater).toBe('');
    expect(redoBtn().disabled).toBe(false);

    await user.click(redoBtn());
    expect(captured.movieInfo.theater).toBe('x');
    expect(redoBtn().disabled).toBe(true);
  });

  test('undo 복원 직후 디바운스가 재push하지 않는다 — redo가 살아 있다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await mountSettle();
    await user.click(screen.getByText('edit'));
    await settle();
    await user.click(undoBtn());
    expect(redoBtn().disabled).toBe(false);

    // 복원이 유발한 effect의 디바운스 타이머(350ms)가 발화하고도 남을 만큼 기다린다 —
    // 복원 스냅샷 == stack[at]이라 no-op이어야 하고, 재push였다면 redo 가지가 절단된다.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450));
    });
    expect(redoBtn().disabled).toBe(false);
    expect(captured.movieInfo.theater).toBe('');
  });

  test('undo 후 새 편집은 redo 가지를 절단한다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await mountSettle();
    await user.click(screen.getByText('edit'));
    await settle();
    await user.click(undoBtn());
    expect(redoBtn().disabled).toBe(false);

    await user.click(screen.getByText('edit'));
    await waitFor(() => expect(redoBtn().disabled).toBe(true));
    expect(captured.movieInfo.theater).toBe('x');
  });
});
