/**
 * #826 S2 constraint-15 · acceptance-6 · acceptance-14 — 편집 상단 ‹는 문서를 잃지 않는다.
 *
 * 워드마크 탭 초기화(#578)는 없어졌다(Seed constraint-7). ‹는 임시저장(photo.saveDraft)을 한 번 하고 랜딩을 다시 띄우며,
 * 랜딩의 '이어서 만들기'는 자동저장 설정과 상관없이 **메모리의 그 문서**를 연다. 지우기는 메뉴 초기화 2탭뿐이다.
 *
 * 함정 둘이 이 파일의 존재 이유다.
 *  1. landingDismissed를 false로만 되돌리면 포스터 없는 문서(#631)는 canvasReady가 꺼져 편집 화면이 사라진다 — 그래도
 *     '이어서 만들기'가 같은 문서로 돌아와야 한다.
 *  2. 랜딩 복원 행은 CSS 게이트(html.has-draft)가 드러낸다 — 이 세션에 저장분이 처음 생긴 경우에도 행이 보여야 한다.
 *
 * 실패할 수 있는 단언의 received에 DOM 엘리먼트를 넣지 않는다(#693).
 */
import { describe, expect, test, afterEach, beforeEach, spyOn, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket, STORAGE_KEY } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

let probe: ReturnType<typeof usePhototicket> | null = null;

function Harness() {
  const photo = usePhototicket();
  probe = photo;
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <button type="button" onClick={() => photo.updateMovieInfo({ title: '괴물', theater: 'CGV 용산' })}>
        fill
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

const landingShown = () => screen.getByTestId('landing').classList.contains('fixed');
const back = () => screen.getByRole('button', { name: '랜딩으로 돌아가기' });

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('has-draft');
  probe = null;
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove('has-draft');
  mock.restore();
});

describe('‹ → 랜딩 → 이어서 만들기 (acceptance-6)', () => {
  test('‹는 임시저장 뒤 랜딩을 띄우고, 이어서 만들기가 같은 문서(정보 · 포스터 · 디자인)로 돌아온다 — confirm 없이', async () => {
    const confirmSpy = spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('landing-skip-poster'));
    fireEvent.click(screen.getByText('seed-poster'));
    fireEvent.click(screen.getByText('fill'));
    fireEvent.click(screen.getByRole('tab', { name: '디자인' }));
    expect(landingShown()).toBe(false);
    const designBefore = JSON.stringify(probe!.state.components);

    await user.click(back());

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(landingShown()).toBe(true);
    // 문서는 그대로 — 메모리 상태도, 저장분도.
    expect(probe!.state.movieInfo.title).toBe('괴물');
    expect(probe!.state.croppedImageUrl).toBe('blob:test-poster');
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('괴물');
    expect(document.documentElement.classList.contains('has-draft')).toBe(true);
    expect(screen.getByTestId('landing-restore').textContent).toContain('괴물');

    await user.click(screen.getByTestId('landing-restore'));
    expect(landingShown()).toBe(false);
    expect(probe!.state.movieInfo.title).toBe('괴물');
    expect(probe!.state.movieInfo.theater).toBe('CGV 용산');
    expect(probe!.state.croppedImageUrl).toBe('blob:test-poster');
    expect(JSON.stringify(probe!.state.components)).toBe(designBefore);
  });

  test('초기화 없이 돌아온 문서는 undo 이력도 그대로다(지우기는 메뉴 초기화 2탭뿐)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('landing-skip-poster'));
    fireEvent.click(screen.getByText('fill'));

    await user.click(back());
    await user.click(screen.getByTestId('landing-restore'));

    expect(screen.queryByText('초기화했어요') === null).toBe(true);
    expect(probe!.state.movieInfo.title).toBe('괴물');
  });
});

describe('랜딩 오버레이 뒤의 편집 크롬은 닿지 않는다 (#826 S2)', () => {
  // 상단 줄이 랜딩 뒤에서 탭 순서에 남으면 ‹ · ⋯가 화면에 없는 채로 포커스를 받는다. 상단 줄은 상태가 없어 언마운트하고,
  // 도크는 도구 선택 같은 로컬 state가 있어 CSS hidden(display:none이라 접근성 트리 · 탭 순서에서 빠진다)이다.
  const topBarButtons = () => [
    screen.queryByRole('button', { name: '랜딩으로 돌아가기' }),
    screen.queryByRole('button', { name: '편집 메뉴' }),
  ];

  test('처음 랜딩: ‹ · ⋯ 버튼이 접근성 트리에 없다', () => {
    render(<Harness />);
    expect(landingShown()).toBe(true);
    expect(topBarButtons().map((b) => b === null)).toEqual([true, true]);
  });

  test('포스터가 있는 문서에서 ‹로 랜딩이 다시 떠도 상단 줄은 없고 도크는 hidden이며, 이어서 만들기로 둘 다 돌아온다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('landing-skip-poster'));
    fireEvent.click(screen.getByText('seed-poster'));
    expect(topBarButtons().map((b) => b === null)).toEqual([false, false]);
    expect(screen.getByTestId('editor-dock').classList.contains('hidden')).toBe(false);

    await user.click(back());

    expect(landingShown()).toBe(true);
    expect(probe!.state.croppedImageUrl).toBe('blob:test-poster'); // canvasReady는 켜진 채다 — 그래도 닿지 않아야 한다
    expect(topBarButtons().map((b) => b === null)).toEqual([true, true]);
    expect(screen.getByTestId('editor-dock').classList.contains('hidden')).toBe(true);

    await user.click(screen.getByTestId('landing-restore'));
    expect(topBarButtons().map((b) => b === null)).toEqual([false, false]);
    expect(screen.getByTestId('editor-dock').classList.contains('hidden')).toBe(false);
  });
});

describe('acceptance-14 — 자동저장 꺼짐 · 포스터 없음', () => {
  test('자동저장을 끈 문서도 ‹가 저장하고, 이어서 만들기가 같은 문서를 연다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('landing-skip-poster'));
    fireEvent.click(screen.getByText('seed-poster'));
    fireEvent.click(screen.getByText('fill'));

    // 메뉴에서 자동저장을 끈다 — 이 뒤로는 어떤 편집도 저장분에 안 실린다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('switch', { name: '자동저장 켜짐' }));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(probe!.autoSaveEnabled).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    await user.click(back());

    expect(landingShown()).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('괴물'); // ‹의 임시저장이 실렸다
    await user.click(screen.getByTestId('landing-restore'));
    expect(landingShown()).toBe(false);
    expect(probe!.state.movieInfo.title).toBe('괴물');
    expect(probe!.state.croppedImageUrl).toBe('blob:test-poster');
  });

  test('포스터 없는 문서(#631)도 ‹ 뒤 이어서 만들기로 편집 화면과 문서가 돌아온다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('landing-skip-poster'));
    fireEvent.click(screen.getByText('fill'));
    expect(probe!.state.croppedImageUrl).toBeFalsy();
    expect(!!screen.queryByRole('tab', { name: /^정보/ })).toBe(true);

    await user.click(back());
    // 포스터가 없으니 편집 캔버스 판정(canvasReady)이 꺼진다 — 완료 버튼도 랜딩 뒤로 사라진다.
    expect(landingShown()).toBe(true);
    expect(screen.queryByRole('button', { name: '완료' }) === null).toBe(true);
    expect(probe!.state.movieInfo.title).toBe('괴물');

    await user.click(screen.getByTestId('landing-restore'));
    expect(landingShown()).toBe(false);
    expect(screen.getByRole('button', { name: '완료' })).toBeTruthy();
    expect(probe!.state.movieInfo.title).toBe('괴물');
    expect(probe!.state.movieInfo.theater).toBe('CGV 용산');
  });
});

describe('‹ 이후 랜딩의 새로 시작 경로 (constraint-15)', () => {
  test('직접 입력으로 새로 시작하면 메모리 문서만 새 문서가 되고 저장분은 덮이기 전까지 남는다(#727 c7)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('landing-skip-poster'));
    fireEvent.click(screen.getByText('fill'));
    await user.click(back());

    await user.click(screen.getByTestId('landing-skip-poster'));

    expect(probe!.state.movieInfo.title).toBeFalsy();
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('괴물');
  });
});

describe('저장 실패 — 편집 화면에 남는다 (constraint-15)', () => {
  test('임시저장이 실패하면 랜딩으로 가지 않아 문서를 잃을 길이 없다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('landing-skip-poster'));
    fireEvent.click(screen.getByText('fill'));

    // 쓰기만 실패하는 저장소로 갈아끼운다(쿼터 초과 · 프라이빗 모드) — happy-dom의 Storage는 spyOn이 안 잡혀 통째로 교체한다.
    const realStorage = window.localStorage;
    const failing = {
      getItem: (k: string) => realStorage.getItem(k),
      removeItem: (k: string) => realStorage.removeItem(k),
      setItem: () => {
        throw new Error('quota');
      },
    };
    Object.defineProperty(window, 'localStorage', { value: failing, configurable: true });
    try {
      await user.click(back());

      expect(landingShown()).toBe(false);
      expect(probe!.state.movieInfo.title).toBe('괴물');
      expect(document.documentElement.classList.contains('has-draft')).toBe(false);
    } finally {
      Object.defineProperty(window, 'localStorage', { value: realStorage, configurable: true });
    }
  });
});
