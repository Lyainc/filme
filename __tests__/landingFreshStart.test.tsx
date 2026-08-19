/**
 * #727 c7 — 랜딩의 "새로 시작" 경로는 이전 draft를 **진입 즉시 파기하지 않는다.**
 *
 * 진입 커밋이 하는 일은 메모리 문서를 새 문서로 되돌리는 것뿐이고(`resetDocument`),
 * `localStorage`/IndexedDB 저장분은 그대로 남는다. 저장분이 실제로 덮이는 시점은 **새 문서의 첫
 * 자동저장**이다 — 그 전까지는 새로고침 한 번으로 "이어서 만들기"가 돌아오므로 오탭이 복구된다.
 * 예전 `clearDraft`를 그대로 걸었다면 진입 탭 한 번에 석 달 전 draft가 되돌릴 수 없이 사라졌다.
 *
 * "랜딩에 머무는 동안 아무것도 안 써진다"는 자동저장의 `dirtyTick === 0` 게이트에 통째로 기댄다
 * (`usePhototicket.ts`) — 복원·리셋은 dirtyTick을 안 올리고, 무드 갤러리 탭도 #727부터는
 * `updateComponents`가 아니라 `resetDocument(layout)`로 실려 안 올린다(landingHeroMood.test.tsx).
 *
 * 실패할 수 있는 단언의 received에 DOM 엘리먼트를 넣지 않는다(#693) — `!!`로 강제 변환한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { mobileShellProps } from './shellHarness';

const { usePhototicket, STORAGE_KEY } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      {/* 실사용자 편집 1회 — dirtyTick을 올리는 유일한 부류(update* 3종)라 자동저장을 예약시킨다. */}
      <button type="button" onClick={() => photo.updateMovieInfo({ title: '괴물' })}>
        edit
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

const seedDraft = () =>
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ movieInfo: { title: '인터스텔라', theater: 'CGV 용산아이파크몰' } })
  );

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('랜딩 "새로 시작"은 저장분을 그 자리에서 지우지 않는다 (#727 c7)', () => {
  test('"직접 입력" 직후 저장분은 그대로고, 화면의 문서는 이전 필드를 안 물려받는다', () => {
    seedDraft();
    render(<Harness />);

    // 복원은 끝나 있다 — 랜딩 라벨이 그 제목을 싣고 있는 게 근거다.
    expect(screen.getByTestId('landing-restore').textContent).toContain('인터스텔라');

    fireEvent.click(screen.getByTestId('landing-skip-poster'));

    // ① 저장분은 안 지워졌다 — 오탭이면 새로고침 한 번으로 되돌아온다.
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('인터스텔라');
    // ② 새 문서는 이전 필드를 안 물려받는다 — 티켓 프리뷰 어디에도 옛 값이 없다.
    expect(document.body.textContent).not.toContain('인터스텔라');
    expect(document.body.textContent).not.toContain('CGV 용산아이파크몰');
  });

  test('새 문서를 한 번 편집하면 그때 저장분이 새 내용으로 덮인다', async () => {
    seedDraft();
    render(<Harness />);

    fireEvent.click(screen.getByTestId('landing-skip-poster'));
    fireEvent.click(screen.getByText('edit'));

    // 자동저장 디바운스 1s — `--timeout 30000`(CI와 같은 값) 안이다.
    await waitFor(
      () => expect(window.localStorage.getItem(STORAGE_KEY)).toContain('괴물'),
      { timeout: 5000 }
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toContain('인터스텔라');
  });

  test('랜딩에 머무는 동안엔 아무것도 안 써진다 — 저장분이 손도 안 탄 채 그대로다', async () => {
    seedDraft();
    const before = window.localStorage.getItem(STORAGE_KEY);
    render(<Harness />);

    // 복원(draftRestored)·마운트만으로는 dirtyTick이 안 오르므로 자동저장이 예약조차 안 된다.
    await new Promise((r) => setTimeout(r, 1500));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(before);
  });

  test('"이어서 만들기"는 새 문서가 아니다 — 복원된 필드를 그대로 들고 들어간다', () => {
    seedDraft();
    render(<Harness />);

    fireEvent.click(screen.getByTestId('landing-restore'));

    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('인터스텔라');
    expect(document.body.textContent).toContain('인터스텔라');
  });
});
