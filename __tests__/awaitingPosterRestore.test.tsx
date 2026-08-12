/**
 * #683 회귀 — 포스터가 있던 draft 재방문에서 랜딩 inline 블록이 IndexedDB 복원 창만큼 깜빡인다.
 *
 * #675가 첫 페인트 오버레이 플래시는 막았지만, 그건 `photo.draftRestored`(localStorage, 동기)만
 * 본 것이다. `croppedImageUrl`은 IndexedDB에서 비동기로 온다(#489) — 그 사이 canvasReady가 아직
 * false라 Landing이 "텍스트만 있던 draft" 전용 inline 모드로 떨어진다. 이 스위트는 usePhototicket이
 * 노출하는 `awaitingPosterRestore`가 그 창을 막고, IDB 복원이 실패하면 기존 재업로드 유도 inline
 * 경로가 그대로 살아나는지를 잠근다.
 *
 * `@/utils/imageDb`를 게이트가 걸린 인메모리 스텁으로 대체해 IDB 복원 시점을 테스트가 직접 쥔다
 * (draftImageRestore.test.tsx의 armSaveGate 패턴과 동일 — 스프레드 스냅샷으로 afterAll 복원).
 */
import { afterAll, afterEach, beforeEach, describe, expect, test, mock } from 'bun:test';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

let loadGate: Promise<void> = Promise.resolve();
let releaseLoad: (() => void) | null = null;
function armLoadGate() {
  loadGate = new Promise((resolve) => {
    releaseLoad = resolve;
  });
}
let loadShouldFail = false;

const realImageDb = { ...require('@/utils/imageDb') };
mock.module('@/utils/imageDb', () => ({
  saveImages: async () => {},
  loadImages: async () => {
    await loadGate;
    if (loadShouldFail) throw new Error('IDB unavailable (mock)');
    return { poster: new Blob(['poster-bytes'], { type: 'image/jpeg' }) };
  },
  clearImages: async () => {},
}));

// require (mock.module은 hoisting 안 됨) — usePhototicket이 이 시점 이후 로드돼야 위 mock을 받는다.
const { usePhototicket, STORAGE_KEY } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  loadGate = Promise.resolve();
  releaseLoad = null;
  loadShouldFail = false;
});
afterAll(() => {
  mock.module('@/utils/imageDb', () => realImageDb);
});

describe('포스터 있던 draft 재방문의 비동기 복원 창 (#683)', () => {
  test('IndexedDB 복원 대기 중엔 랜딩이 inline으로 안 떨어진다', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ movieInfo: { title: '인터스텔라' }, hadPoster: true })
    );
    armLoadGate();

    render(<Harness />);

    // localStorage 복원 effect는 동기라 이 시점에 이미 draftRestored+awaitingPosterRestore가
    // 서 있다 — IDB는 게이트에 묶여 아직 안 끝났다. canvasReady가 awaitingPosterRestore를 못 보면
    // 여기서 랜딩이 inline(완료 버튼 없음)으로 떨어진다.
    const landing = screen.getByTestId('landing');
    expect(landing.classList.contains('hidden')).toBe(true);
    expect(landing.classList.contains('flex-1')).toBe(false);
    expect(screen.getByRole('button', { name: '완료' })).toBeTruthy();

    // 포스터가 도착해도(canvasReady가 croppedImageUrl로 계속 true) 계속 hidden — 헤더 메뉴가
    // '포스터 교체'로 바뀌는 걸로 실제 포스터 도착을 확인한다.
    await act(async () => {
      releaseLoad?.();
      await loadGate;
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '포스터 교체' })).toBeTruthy();
    });
    expect(landing.classList.contains('hidden')).toBe(true);
  });

  test('IndexedDB 복원이 실패하면 대기가 풀려 기존 재업로드 유도 inline이 돌아온다', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ movieInfo: { title: '기생충' }, hadPoster: true })
    );
    loadShouldFail = true;

    render(<Harness />);

    // 실패는 즉시 반영되지 않고 loadImages().catch()가 한 틱 뒤 정리되므로 기다린다.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '완료' })).toBeNull();
    });
    const landing = screen.getByTestId('landing');
    expect(landing.classList.contains('hidden')).toBe(false);
    expect(landing.classList.contains('flex-1')).toBe(true);
    // 재업로드 유도 진입점('포스터 없이 직접 입력'과 나란한 이탈 경로)이 그대로 살아있다.
    expect(screen.getByTestId('landing-skip-poster')).toBeTruthy();
  });
});
