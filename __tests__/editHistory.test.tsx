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
import { describe, expect, test, afterEach, beforeEach, jest } from 'bun:test';
import { render, screen, cleanup, act } from '@testing-library/react';
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
      <button type="button" onClick={() => photo.updateComponents({ posterOpacity: 0.8 })}>
        bright
      </button>
      <button type="button" onClick={() => photo.updateComponents({ coating: 'none' })}>
        texture
      </button>
      <button type="button" onClick={() => photo.updateComponents({ signatureImage: 'blob:sig', signatureScale: 1.2 })}>
        signature
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

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

const userSetup = () => userEvent.setup({ delay: null });
const undoBtn = () => screen.getByText('undo') as HTMLButtonElement;
const redoBtn = () => screen.getByText('redo') as HTMLButtonElement;
// 350ms 디바운스를 실시간 대기 없이 발화시킨다 — fake timer 전진은 동기라 waitFor 폴링이 불필요.
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
// 원래 waitFor(() => expect(undoBtn().disabled).toBe(false))가 하던 암묵 검증을 그대로 유지.
const settle = async () => {
  await advance(360);
  expect(undoBtn().disabled).toBe(false);
};
// 히스토리는 빈 스택으로 시작하고 마운트 후 첫 디바운스(350ms)가 베이스라인을 잡는다 —
// 그 윈도 안의 편집은 베이스라인에 뭉치므로(임시저장 복원 흡수 설계), 편집 전에 기다린다.
const mountSettle = () => advance(400);

describe('useEditHistory (usePhototicket 통합)', () => {
  test('연속 입력(350ms 내)은 1스텝 — undo 1회가 입력 단위를 통째로 되돌린다', async () => {
    const user = userSetup();
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
    const user = userSetup();
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
    const user = userSetup();
    render(<Harness />);
    await mountSettle();
    await user.click(screen.getByText('edit'));
    await settle();
    await user.click(undoBtn());
    expect(redoBtn().disabled).toBe(false);

    // 복원이 유발한 effect의 디바운스 타이머(350ms)가 발화하고도 남을 만큼 전진시킨다 —
    // 복원 스냅샷 == stack[at]이라 no-op이어야 하고, 재push였다면 redo 가지가 절단된다.
    await advance(450);
    expect(redoBtn().disabled).toBe(false);
    expect(captured.movieInfo.theater).toBe('');
  });

  test('밝기 조작 이전으로 undo하면 coating 전환이 기본 밝기를 다시 적용한다 (PR #361 P1)', async () => {
    const user = userSetup();
    render(<Harness />);
    await mountSettle(); // 베이스라인: material 'original'/coating 'gloss', posterOpacity 0.5(= 기본값)

    // 밝기 슬라이더 조작 → brightnessTouchedRef가 true로.
    await user.click(screen.getByText('bright'));
    expect(captured.components.posterOpacity).toBe(0.8);
    await settle();

    // 조작 이전 시점으로 undo — restoreSnapshot이 touched를 스냅샷 기준으로 재유도해야
    // (0.5 == 기본값 → 안 만짐), 이후 coating 전환에서 기본 밝기가 다시 적용된다.
    await user.click(undoBtn());
    expect(captured.components.posterOpacity).toBe(0.5);

    await user.click(screen.getByText('texture'));
    expect(captured.components.coating).toBe('none');
    expect(captured.components.posterOpacity).toBe(1.0); // coating='none'의 기본 밝기
  });

  // #484 s5 — signatureImage/signatureScale은 신규 undo 배선 없이 components 스냅샷 구조에
  // 그대로 얹혀 나가는지 확인(chain/format과 동일 근거).
  test('서명 이미지/스케일도 undo가 원자 복원한다 (components 스냅샷에 자동 포함)', async () => {
    const user = userSetup();
    render(<Harness />);
    await mountSettle();

    expect(captured.components.signatureImage).toBe('');
    expect(captured.components.signatureScale).toBe(1);

    await user.click(screen.getByText('signature'));
    expect(captured.components.signatureImage).toBe('blob:sig');
    expect(captured.components.signatureScale).toBe(1.2);
    await settle();

    await user.click(undoBtn());
    expect(captured.components.signatureImage).toBe('');
    expect(captured.components.signatureScale).toBe(1);
  });

  test('undo 후 새 편집은 redo 가지를 절단한다', async () => {
    const user = userSetup();
    render(<Harness />);
    await mountSettle();
    await user.click(screen.getByText('edit'));
    await settle();
    await user.click(undoBtn());
    expect(redoBtn().disabled).toBe(false);

    await user.click(screen.getByText('edit'));
    await settle();
    expect(redoBtn().disabled).toBe(true);
    expect(captured.movieInfo.theater).toBe('x');
  });
});
