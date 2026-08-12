/**
 * #578 회귀 테스트 — 워드마크 탭 = 초기화의 두 번째 진입점.
 *
 * 기존 2탭 arm(handleClearTap, mobileEditorShellMenu.test.tsx)은 메뉴 안 라벨을 확인 문구로
 * 바꾸는 방식이라 브랜드 라벨(Wordmark)엔 재사용할 수 없다. 워드마크는 native window.confirm으로
 * 대체하고, 작업 이력 판정은 croppedImageUrl/canUndo/isDirty/movieInfo 네 축의 합집합이다 —
 * 포스터만 올린 직후는 canUndo가 history.clear()로 리셋돼 있어 canUndo만 보면 경고 없이
 * 날아간다. isDirty는 canUndo가 못 보는 좁은 창(방금 만든 편집이 아직 350ms 히스토리 디바운스에
 * 안 밀려 들어간 상태)을 커버한다(#578 code-review 발견).
 */
import { describe, expect, test, afterEach, mock, spyOn } from 'bun:test';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

const landingShown = () => screen.getByTestId('landing').classList.contains('fixed');
const wordmarkButton = () => screen.getByRole('button', { name: 'FILME — 처음 화면으로 돌아가기' });
// 히스토리 디바운스(useEditHistory DEBOUNCE_MS=350ms)를 확실히 건너뛰기 위한 대기.
const settleHistory = () => act(async () => { await new Promise((r) => setTimeout(r, 400)); });

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed
      </button>
      <button type="button" onClick={() => photo.updateMovieInfo({ title: '기생충' })}>
        fill-movie-info
      </button>
      {/* ALL_FIELDS_ON이 기본이라 true로 다시 켜면 no-op(동일 스냅샷)이라 history가 안 밀린다 — false로. */}
      <button type="button" onClick={() => photo.updateFieldVisibility({ actors: false })}>
        toggle-field
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  mock.restore();
});

describe('워드마크 탭 초기화 (#578)', () => {
  test('작업 이력이 없으면 확인 없이 즉시 초기화된다', async () => {
    const confirmSpy = spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(wordmarkButton());

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getAllByText('초기화했어요').length).toBeGreaterThan(0);
  });

  test('작업 이력이 있으면 confirm을 거치고, 취소하면 상태가 보존된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed')); // croppedImageUrl 축

    const confirmSpy = spyOn(window, 'confirm').mockImplementation(() => false);
    await user.click(wordmarkButton());

    expect(confirmSpy).toHaveBeenCalledWith('지금까지 작업한 내용이 사라져요. 처음 화면으로 돌아갈까요?');
    expect(screen.queryByText('초기화했어요')).toBeNull();
    expect(landingShown()).toBe(false); // 포스터가 그대로 있으니 랜딩은 계속 숨겨진 채.

    confirmSpy.mockImplementation(() => true);
    await user.click(wordmarkButton());

    expect(screen.getAllByText('초기화했어요').length).toBeGreaterThan(0);
    expect(landingShown()).toBe(true); // 초기화로 포스터가 사라져 랜딩이 복귀.
  });

  test('croppedImageUrl 단독으로도 확인을 띄운다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));

    const confirmSpy = spyOn(window, 'confirm').mockImplementation(() => true);
    await user.click(wordmarkButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  test('canUndo 단독으로도 확인을 띄운다 (포스터·movieInfo 둘 다 비어 있어도)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await settleHistory(); // 마운트 베이스라인 스냅샷(at:0) 확정.
    fireEvent.click(screen.getByText('toggle-field'));
    await settleHistory(); // 두 번째 스냅샷(at:1) → canUndo:true.

    const confirmSpy = spyOn(window, 'confirm').mockImplementation(() => true);
    await user.click(wordmarkButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  test('movieInfo 필드 단독으로도 확인을 띄운다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('fill-movie-info'));

    const confirmSpy = spyOn(window, 'confirm').mockImplementation(() => true);
    await user.click(wordmarkButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  test('방금 만든 편집이 아직 350ms 히스토리 디바운스 창 안이어도 확인을 띄운다(isDirty, #578 code-review)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await settleHistory(); // 베이스라인(at:0)까지만 확정 — 그 다음 편집은 커밋 전 상태로 남긴다.
    fireEvent.click(screen.getByText('toggle-field'));
    // 디바운스가 밀어넣기 전(canUndo는 여전히 false)에 바로 탭 — isDirty만이 이걸 잡는다.

    const confirmSpy = spyOn(window, 'confirm').mockImplementation(() => true);
    await user.click(wordmarkButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  test('확인 후 초기화되면 편집 메뉴가 열려 있었어도 함께 닫힌다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(screen.getByRole('menu', { name: '편집 메뉴' })).toBeTruthy();

    spyOn(window, 'confirm').mockImplementation(() => true);
    await user.click(wordmarkButton());

    expect(screen.queryByRole('menu', { name: '편집 메뉴' })).toBeNull();
  });
});
