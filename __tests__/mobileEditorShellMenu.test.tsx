/**
 * #315 회귀 테스트 — MobileEditorShell 헤더 서브메뉴.
 *
 * 뒤로가기·워드마크를 제거하고 햄버거 서브메뉴로 다크모드·전체표시·빈 항목·잉크 토글과 포스터
 * 교체·재크롭 액션을 통합했다(#323/#324 흡수). 잉크 토글 자체의 동작 검증(라이트↔다크 전환,
 * disclosure 아님, 35mm disabled)은 원래 designRail.test.tsx (g)(h)(i)였으나 토글이 DesignRail
 * 레일 → 이 서브메뉴로 이전하며 이관됐다.
 */
import { describe, expect, test, afterEach, beforeEach, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';

const STORAGE_KEY = 'filme:phototicket:v1';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="themeColor">{photo.state.components.themeColor}</div>
      <div data-testid="layout">{photo.state.components.layout}</div>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed
      </button>
      <button type="button" onClick={() => photo.updateComponents({ layout: '35mm' })}>
        set-35mm
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

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('MobileEditorShell 헤더 서브메뉴 (#315)', () => {
  test('뒤로가기·FILME 워드마크는 헤더에서 제거됐다', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: '맨 위로' })).toBeNull();
    expect(screen.queryByText('FILME')).toBeNull();
  });

  test('햄버거 탭 → 메뉴 열림/닫힘(aria-expanded), 바깥 탭으로 닫힘', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const hamburger = screen.getByRole('button', { name: '편집 메뉴' });

    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu', { name: '편집 메뉴' })).toBeNull();

    await user.click(hamburger);
    expect(hamburger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: '편집 메뉴' })).toBeTruthy();

    await user.click(hamburger);
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
  });

  test('메뉴가 열려 있어도 완료 버튼은 오버레이에 가려지지 않고 바로 눌린다 (claude-review PR #331 P2)', async () => {
    const user = userEvent.setup();
    let calls = 0;
    function DoneHarness() {
      const photo = usePhototicket();
      return (
        <MobileEditorShell
          photo={photo}
          canExport
          theme="light"
          onThemeChange={() => {}}
          onDone={() => { calls++; }}
          disabledReason=""
          previewMovieInfo={photo.state.movieInfo}
          previewComponents={photo.state.components}
          fieldVisibility={photo.state.fieldVisibility}
        />
      );
    }
    render(<DoneHarness />);

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(screen.getByRole('menu', { name: '편집 메뉴' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '완료' }));
    expect(calls).toBe(1);
  });

  test('업로드 전엔 포스터 교체/재크롭 액션이 없다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    expect(screen.queryByRole('button', { name: '포스터 교체' })).toBeNull();
    expect(screen.queryByRole('button', { name: '재크롭' })).toBeNull();
  });

  test('업로드 전에도 임시저장/초기화는 노출된다(#310) — 포스터 전용 액션과 달리 게이팅하지 않는다', async () => {
    // 포스터(croppedImageUrl)는 새로고침에 안 남지만 movieInfo 등 나머지는 복원되므로(#310이 고치려는
    // 시나리오 자체), 포스터 재업로드 전에도 초기화에 닿을 수 있어야 한다.
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    expect(screen.getByRole('button', { name: '임시저장' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '초기화' })).toBeTruthy();
    // 반면 포스터 전용 액션은 여전히 게이팅된다.
    expect(screen.queryByRole('button', { name: '포스터 교체' })).toBeNull();
    expect(screen.queryByRole('button', { name: '재크롭' })).toBeNull();
  });

  test('초기화(#310): 포스터 없이 복원된 stale 값만 있어도 초기화로 지워진다(핵심 시나리오 — 새로고침 직후)', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '기생충' } }));
    const origConfirm = window.confirm;
    window.confirm = mock(() => true);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getAllByText('초기화했어요').length).toBeGreaterThan(0);

    window.confirm = origConfirm;
  });

  test('임시저장(#310): 즉시 localStorage에 저장 + 토스트 + 메뉴 닫힘', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    await user.click(screen.getByRole('button', { name: '임시저장' }));

    expect(screen.queryByRole('menu', { name: '편집 메뉴' })).toBeNull();
    expect(screen.getAllByText('임시저장했어요').length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  test('초기화(#310): confirm 취소 시 아무것도 지워지지 않는다', async () => {
    const origConfirm = window.confirm;
    window.confirm = mock(() => false);
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    await user.click(screen.getByRole('button', { name: '초기화' }));

    // 취소했으니 포스터가 그대로 남아 재크롭 액션이 여전히 노출된다(초기화 미실행 증거).
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(screen.queryByRole('button', { name: '재크롭' })).not.toBeNull();

    window.confirm = origConfirm;
  });

  test('초기화(#310): confirm 승인 시 storage 삭제 + 상태 초기화 + 토스트', async () => {
    const origConfirm = window.confirm;
    window.confirm = mock(() => true);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '기생충' } }));
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getAllByText('초기화했어요').length).toBeGreaterThan(0);
    // 포스터가 사라져 업로드 드롭존이 다시 보인다(INITIAL_STATE 복귀 증거).
    expect(screen.getByText('포스터 업로드')).toBeTruthy();

    window.confirm = origConfirm;
  });

  test('업로드 후: 잉크 토글 → themeColor 라이트(#FFFFFF)↔다크(#000000) 즉시 전환', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    // 기본 잉크 = 라이트(#FFFFFF)
    expect(screen.getByTestId('themeColor').textContent).toBe('#FFFFFF');

    const ink = screen.getByRole('switch', { name: /잉크 색상 전환/ });
    await user.click(ink);
    expect(screen.getByTestId('themeColor').textContent).toBe('#000000');
    await user.click(ink);
    expect(screen.getByTestId('themeColor').textContent).toBe('#FFFFFF');

    // 이 하네스는 photo.handleImageUpload를 직접 호출해 seed하므로(실제 파일 선택 우회) 셸의
    // posterOriginalSrc가 없다 — 재크롭은 실제 원본이 있어야 하므로 여전히 disabled가 맞다.
    // 파일 선택→크롭 전체 플로우의 originalSrc 영속화 자체는 imageUploaderRecrop.test.tsx가
    // 검증하는 것과 동일한 상태 머신을 포팅한 것(핸들러 구현 참조).
    const recrop = screen.getByRole('button', { name: '재크롭' }) as HTMLButtonElement;
    expect(recrop.disabled).toBe(true);
  });

  test('35mm 무드에선 잉크 토글 disabled — 톤 고정(ColorPicker와 동일 조건)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('set-35mm'));
    expect(screen.getByTestId('layout').textContent).toBe('35mm');

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    const ink = screen.getByRole('switch', { name: /잉크 색상 전환/ }) as HTMLButtonElement;
    expect(ink.disabled).toBe(true);
  });
});
