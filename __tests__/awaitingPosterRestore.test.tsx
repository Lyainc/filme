/**
 * 포스터가 있던 draft 재방문의 비동기 복원 창(#683 → #727로 명제가 뒤집혔다).
 *
 * #683은 그 창 동안 랜딩이 inline으로 떨어져 깜빡이는 걸 막는 스위트였다. #727이 inline을 삭제하고
 * (c3) 랜딩을 draft 유무와 무관한 상시 오버레이로 바꿨으므로(c1), 이제 잠글 명제는 정반대다 —
 * **복원이 끝난 뒤에도 랜딩이 오버레이인 채로 남는가.** 여기가 c1이 지목한 자리다: `canvasReady`
 * 항(`croppedImageUrl`)이 랜딩 판정에 살아 있으면 IndexedDB에서 포스터가 도착하는 순간 랜딩이
 * 다시 숨어, 제일 흔한 재방문자(포스터 있는 draft)에겐 정책이 안 뒤집힌 채로 남는다.
 *
 * 두 번째 축은 c8 — 복원이 도착하기 전에 사용자가 "새로 시작" 경로로 진입하면 옛 포스터가 새
 * 문서에 끼어들면 안 된다(문서 세대 ref, #388/PR #413 P0의 ocrEpochRef와 같은 처방).
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

describe('포스터 있던 draft 재방문의 비동기 복원 창 (#683 → #727)', () => {
  // ac1 포스터 축 — c1이 지목한 자리다. 랜딩 판정에 croppedImageUrl이 살아 있으면 정확히
  // releaseLoad() 직후에 깨진다(복원 대기 중엔 통과하고 도착 순간에만 뒤집히므로, 게이트를 쥐고
  // 전/후를 모두 재야 잡힌다).
  test('IndexedDB 복원이 끝난 뒤에도 랜딩이 오버레이로 남는다 (#727 c1)', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ movieInfo: { title: '인터스텔라' }, hadPoster: true })
    );
    armLoadGate();

    render(<Harness />);

    // localStorage 복원 effect는 동기라 이 시점에 이미 draftRestored+awaitingPosterRestore가
    // 서 있다 — IDB는 게이트에 묶여 아직 안 끝났다.
    const landing = screen.getByTestId('landing');
    expect(landing.classList.contains('fixed')).toBe(true);
    // 랜딩 뒤의 편집 크롬은 awaitingPosterRestore로 이미 서 있다(canvasReady) — 랜딩을 떠나면
    // 빈 셸이 아니라 곧 포스터가 채워질 캔버스가 기다린다.
    expect(!!screen.queryByRole('button', { name: '완료' })).toBe(true);

    // 포스터가 도착해도 랜딩은 그대로다 — 헤더 메뉴가 '포스터 교체'로 바뀌는 걸로 실제 도착을 잰다.
    await act(async () => {
      releaseLoad?.();
      await loadGate;
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await waitFor(() => {
      expect(!!screen.queryByRole('button', { name: '포스터 교체' })).toBe(true);
    });
    expect(landing.classList.contains('fixed')).toBe(true);
    expect(landing.classList.contains('hidden')).toBe(false);
  });

  // ac6 동작 축 — inline이 사라졌으니 복원 실패도 "오버레이가 그대로"다. 재업로드 유도(#489 결정 5)는
  // 이제 그 오버레이의 이탈 경로 2종이 지고, inline 판정이던 flex-1은 코드에 없다.
  test('IndexedDB 복원이 실패해도 랜딩은 오버레이 그대로이고 재업로드 경로가 살아 있다', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ movieInfo: { title: '기생충' }, hadPoster: true })
    );
    loadShouldFail = true;

    render(<Harness />);

    // 실패는 즉시 반영되지 않고 loadImages().catch()가 한 틱 뒤 정리되므로 기다린다 —
    // awaitingPosterRestore가 풀리면 canvasReady가 꺼져 편집 크롬(완료)이 사라진다.
    // `!!`로 강제 변환하는 게 핵심이다(#693) — waitFor의 첫 즉시 검사는 아직 버튼이 살아 있어
    // 정상적으로 실패하는데, 그때 received가 happy-dom 엘리먼트면 bun이 노드 그래프 전체를
    // 직렬화한다(실측 697MB · 한 번에 4.6초). 재시도까지 두 번이면 5초 per-test 타임아웃을 넘겨
    // 테스트가 죽는다. 불리언으로 받으면 같은 실패 메시지가 64자다.
    await waitFor(() => {
      expect(!!screen.queryByRole('button', { name: '완료' })).toBe(false);
    });

    const landing = screen.getByTestId('landing');
    expect(landing.classList.contains('fixed')).toBe(true);
    expect(landing.classList.contains('hidden')).toBe(false);
    // inline 모드의 흔적(flex-1)이 남아 있으면 c3가 무효다.
    expect(landing.classList.contains('flex-1')).toBe(false);
    // 재업로드 유도 진입점('포스터 업로드'·'포스터 없이 직접 입력')이 그대로 살아있다.
    expect(!!screen.queryByTestId('landing-skip-poster')).toBe(true);
    expect(!!screen.queryByRole('button', { name: '포스터 업로드' })).toBe(true);
  });

  // ac5 / c8 — 복원이 도착하기 전에 "새로 시작"으로 진입하면 옛 포스터가 새 문서에 끼어들면 안 된다.
  // 문서 세대 ref가 없으면 loadImages().then이 setState로 croppedImageUrl을 주입해 정확히 여기서
  // 깨진다. 대리 지표는 이 파일이 이미 쓰는 헤더 메뉴 문구다('포스터 추가' vs '포스터 교체').
  test('복원이 늦게 도착해도 새로 시작한 문서에 옛 포스터가 안 들어온다 (#727 c8)', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ movieInfo: { title: '인터스텔라' }, hadPoster: true })
    );
    armLoadGate();

    render(<Harness />);
    const user = userEvent.setup();

    // 게이트가 걸린 채로 "새로 시작" 진입 — 문서 세대가 올라가 진행 중인 복원이 무효가 된다.
    await user.click(screen.getByTestId('landing-skip-poster'));

    await act(async () => {
      releaseLoad?.();
      await loadGate;
    });

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await waitFor(() => {
      expect(!!screen.queryByRole('button', { name: '포스터 추가' })).toBe(true);
    });
    expect(!!screen.queryByRole('button', { name: '포스터 교체' })).toBe(false);
    // 저장분은 그대로다(c7) — 파기한 건 메모리 문서뿐이라 새로고침 한 번으로 되돌아온다.
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('인터스텔라');
  });
});
