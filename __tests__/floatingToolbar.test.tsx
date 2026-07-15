/**
 * #356 — 플로팅 툴바 회귀 (MobileEditorShell 배선 통합).
 *
 * - undo/redo 배선: 초기 disabled → 편집 settle 후 '실행 취소'가 폼을 되돌린다.
 * - 항목목록 버튼이 #360의 임시 헤더 버튼을 대체 — 헤더가 아니라 툴바에서 드로어를 연다.
 * - 숨김 → 원형 '툴바 표시' 버튼으로 접힘 → 재표시.
 * - 기어 → 배치 서브메뉴(툴바 부착) → 프리셋 탭이 방향을 바꾸고 filme:toolbar:v1로 영속,
 *   재마운트 시 복원(새로고침 복원 완료 조건).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import type { PhototicketState } from '@/types';

const TB_KEY = 'filme:toolbar:v1';

let captured: PhototicketState;

function Harness() {
  const photo = usePhototicket();
  captured = photo.state;
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <button type="button" onClick={() => photo.updateMovieInfo({ theater: 'CGV 용산' })}>
        seed-edit
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        onThemeChange={() => {}}
        onDone={() => {}}
        disabledReason=""
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={photo.state.components}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(cleanup);

async function seedPoster(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('seed-poster'));
  // 히스토리 베이스라인은 마운트 후 첫 디바운스(350ms)가 잡는다 — 그 윈도 안의 변경(포스터
  // 업로드의 fieldVisibility 리셋 포함)은 베이스라인에 뭉친다. 이후 편집이 1스텝으로 잡히도록
  // settle을 기다린다.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
  return screen.getByRole('toolbar', { name: '편집 도구' });
}

describe('플로팅 툴바 (#356)', () => {
  test('undo/redo 배선: 초기 disabled → 편집 후 실행 취소가 폼을 되돌린다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await seedPoster(user);

    const undo = screen.getByRole('button', { name: '실행 취소' }) as HTMLButtonElement;
    const redo = screen.getByRole('button', { name: '다시 실행' }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);

    await user.click(screen.getByText('seed-edit'));
    expect(captured.movieInfo.theater).toBe('CGV 용산');
    await waitFor(() => expect(undo.disabled).toBe(false)); // 350ms 디바운스 settle

    await user.click(undo);
    expect(captured.movieInfo.theater).toBe('');
    expect(redo.disabled).toBe(false);

    await user.click(redo);
    expect(captured.movieInfo.theater).toBe('CGV 용산');
  });

  test('항목목록 버튼이 헤더 대신 툴바에서 드로어를 연다(#360 임시 진입점 대체)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toolbar = await seedPoster(user);

    // '티켓 항목 목록' 접근명은 이제 툴바 안에만 있다(헤더 버튼 제거).
    const listButtons = screen.getAllByRole('button', { name: '티켓 항목 목록' });
    expect(listButtons.length).toBe(1);
    expect(toolbar.contains(listButtons[0])).toBe(true);

    await user.click(listButtons[0]);
    // FieldDrawer(#355) 배선 재사용 — 우측 드로어(dialog)가 열린다. dynamic 로드라 findBy.
    expect(await screen.findByRole('dialog', { name: '티켓 항목' })).toBeTruthy();
  });

  test('숨김 → 원형 표시 버튼으로 접히고, 다시 펼 수 있다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await seedPoster(user);

    await user.click(screen.getByRole('button', { name: '툴바 숨기기' }));
    expect(screen.queryByRole('toolbar', { name: '편집 도구' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '툴바 표시' }));
    expect(screen.getByRole('toolbar', { name: '편집 도구' })).toBeTruthy();
  });

  test('영속된 이동식 좌표가 뷰포트 밖이면 마운트 시 재클램프된다(#190)', async () => {
    // 저장 당시보다 좁은 뷰포트로 다시 연 상황 — resize 없이 마운트만으로 화면 안으로 들어와야 한다.
    window.localStorage.setItem(
      TB_KEY,
      JSON.stringify({ orient: 'v', place: 'movable', x: 5000, y: 5000, hidden: false })
    );
    const user = userEvent.setup();
    render(<Harness />);
    const toolbar = await seedPoster(user);

    const m = toolbar.style.transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\)/);
    expect(m).toBeTruthy();
    expect(parseFloat(m![1])).toBeLessThanOrEqual(window.innerWidth - 8); // EDGE=8
    expect(parseFloat(m![2])).toBeLessThanOrEqual(window.innerHeight - 8);
  });

  test('기어 메뉴 프리셋이 방향을 바꾸고 별도 키로 영속, 재마운트에 복원된다', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    const toolbar = await seedPoster(user);
    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical'); // 기본 세로·고정

    await user.click(screen.getByRole('button', { name: '툴바 배치 설정' }));
    const menu = screen.getByRole('menu', { name: '툴바 배치' });
    expect(toolbar.contains(menu)).toBe(true); // 서브메뉴는 툴바 자신에 부착(바텀시트 아님)

    await user.click(screen.getByRole('menuitemradio', { name: '가로형 · 고정식' }));
    expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');

    // 자동 영속(300ms 디바운스) — 문서 키(filme:phototicket:v1)가 아닌 별도 키.
    await waitFor(() => {
      const raw = window.localStorage.getItem(TB_KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).orient).toBe('h');
    });
    expect(window.localStorage.getItem('filme:phototicket:v1')).toBeNull();

    // 재마운트(새로고침 상당) — 저장된 방향으로 복원.
    unmount();
    const user2 = userEvent.setup();
    render(<Harness />);
    const toolbar2 = await seedPoster(user2);
    expect(toolbar2.getAttribute('aria-orientation')).toBe('horizontal');
  });
});
