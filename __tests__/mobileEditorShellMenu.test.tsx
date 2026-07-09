/**
 * #315 회귀 테스트 — MobileEditorShell 헤더 서브메뉴.
 *
 * 뒤로가기·워드마크를 제거하고 햄버거 서브메뉴로 다크모드·전체표시·빈 항목·잉크 토글과 포스터
 * 교체·재크롭 액션을 통합했다(#323/#324 흡수). 잉크 토글 자체의 동작 검증(라이트↔다크 전환,
 * disclosure 아님, 35mm disabled)은 원래 designRail.test.tsx (g)(h)(i)였으나 토글이 DesignRail
 * 레일 → 이 서브메뉴로 이전하며 이관됐다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';

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
