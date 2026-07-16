/**
 * #315 회귀 테스트 — MobileEditorShell 헤더 서브메뉴.
 *
 * 뒤로가기·워드마크를 제거하고 햄버거 서브메뉴로 다크모드·전체표시·빈 항목 토글과 포스터
 * 교체·재크롭 액션을 통합했다(#323/#324 흡수). 잉크 토글은 #387에서 컬러 패널과 중복이라 삭제.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

const STORAGE_KEY = 'filme:phototicket:v1';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('MobileEditorShell 헤더 서브메뉴 (#315)', () => {
  test('FILME 워드마크는 헤더에 복귀(#363, v8 §1 — #315 제거 결정 번복), 뒤로가기는 여전히 없다', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { level: 1, name: 'FILME' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '맨 위로' })).toBeNull();
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
        <>
          {/* 완료는 포스터가 있어야 렌더(#363) — seed 후에 검증한다. */}
          <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
            seed
          </button>
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
        </>
      );
    }
    render(<DoneHarness />);
    fireEvent.click(screen.getByText('seed'));

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
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    // 2탭 arm(#374) — 1탭은 arm만, 확인 문구로 바뀐 행을 한 번 더 탭해야 실행.
    // 더블탭 가드(350ms) 밖에서 재탭해야 실행된다(PR #375 P1).
    await user.click(screen.getByRole('button', { name: '초기화' }));
    await new Promise((r) => setTimeout(r, 400));
    await user.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getAllByText('초기화했어요').length).toBeGreaterThan(0);
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

  test('초기화 arm(#374): 1탭은 실행하지 않는다 — 라벨만 확인 문구로 바뀌고, 메뉴를 닫으면 해제된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    await user.click(screen.getByRole('button', { name: '초기화' }));
    // arm됨 — 메뉴는 열린 채, 실행은 아직.
    expect(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' })).toBeTruthy();
    expect(screen.queryByText('초기화했어요')).toBeNull();

    // 메뉴를 닫았다 다시 열면 arm이 풀려 원래 라벨로 돌아오고, 포스터도 그대로다(미실행 증거).
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(screen.getByRole('button', { name: '초기화' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '한 번 더 눌러 전체 삭제' })).toBeNull();
    expect(screen.queryByRole('button', { name: '재크롭' })).not.toBeNull();
  });

  test('초기화 arm(#374): 2탭 시 storage 삭제 + 상태 초기화 + 토스트', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '기생충' } }));
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    await user.click(screen.getByRole('button', { name: '초기화' }));
    await new Promise((r) => setTimeout(r, 400));
    await user.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getAllByText('초기화했어요').length).toBeGreaterThan(0);
    // 포스터가 사라져 업로드 드롭존이 다시 보인다(INITIAL_STATE 복귀 증거).
    expect(screen.getByText('포스터 업로드')).toBeTruthy();
    // 실행 후 메뉴는 닫힌다.
    expect(screen.queryByRole('menu', { name: '편집 메뉴' })).toBeNull();
  });

  test('초기화 arm(#374): arm 직후 350ms 내 재탭(더블탭)은 실행되지 않는다 (claude-review PR #375 P1)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    // userEvent 연속 클릭은 수 ms 간격 — 습관적 더블탭 시뮬레이션.
    await user.click(screen.getByRole('button', { name: '초기화' }));
    await user.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

    // 실행되지 않고 armed 상태로 남는다.
    expect(screen.queryByText('초기화했어요')).toBeNull();
    expect(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' })).toBeTruthy();
  });

  test('초기화 arm(#374): 3.2초 내 재탭이 없으면 자동 해제된다 (claude-review PR #375 P1)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' })).toBeTruthy();

    // 3.2초 auto-disarm 타이머 만료를 real timer로 대기 — act로 감싸 타이머 콜백의
    // setState가 반영되게 한다(happy-dom에서 waitFor 폴링이 안 돌아 직접 대기).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 3400));
    });
    expect(screen.getByRole('button', { name: '초기화' })).toBeTruthy();
    expect(screen.queryByText('초기화했어요')).toBeNull();
  }, 10000);

  // 잉크 토글은 #387에서 삭제 — 컬러 패널(DesignRail ColorPicker)의 White/Black 프리셋과
  // 완전히 중복이라 기능 손실 없이 제거(전문가 패널 검토, docs/discussions/20260716...).
  // 이 서브메뉴가 검증하던 라이트↔다크 전환·35mm disabled 동작 회귀 테스트는 ColorPicker
  // 쪽에 상응하는 게 없다 — desktopDesignPanel.test.tsx (c)는 White/Black 프리셋의 존재만
  // 확인하고 클릭 동작은 검증하지 않는다(#387 스코프 밖의 기존 커버리지 공백, 별도 이슈감).
});
