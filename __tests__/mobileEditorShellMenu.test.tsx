/**
 * #315 회귀 테스트 — MobileEditorShell 헤더 서브메뉴.
 *
 * 뒤로가기·워드마크를 제거하고 햄버거 서브메뉴로 다크모드·전체표시·빈 항목 토글과 포스터
 * 교체·재크롭 액션을 통합했다(#323/#324 흡수). 잉크 토글은 #387에서 컬러 패널과 중복이라 삭제.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

// 랜딩 오버레이 노출 여부(#614) — 숨김은 unmount가 아니라 display:none(`hidden` 유틸)이고,
// 테스트엔 Tailwind CSS가 안 실려 getComputedStyle이 클래스를 안 반영하므로 className으로 본다.
const landingShown = () => !screen.getByTestId('landing').classList.contains('hidden');

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

  test('Escape로도 메뉴가 닫힌다(#387, 삭제된 플로팅 툴바 배치 서브메뉴의 Escape 경로를 이 메뉴가 승계 — claude-review PR #405 P1)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const hamburger = screen.getByRole('button', { name: '편집 메뉴' });

    await user.click(hamburger);
    expect(hamburger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(hamburger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu', { name: '편집 메뉴' })).toBeNull();
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

  // #614로 게이트가 바뀌었다: 점선 드롭존이 랜딩 오버레이에 흡수되면서, 랜딩이 걷혔는데 포스터는
  // 아직 없는 상태(OCR로 먼저 들어온 경로 · 초기화 직후)에 포스터 진입점이 하나도 없게 됐다.
  // 그래서 업로드 전엔 '교체'가 아니라 '올리기'로 열려 있고, 재크롭만 원본이 없어 비활성이다.
  test('업로드 전엔 포스터 행이 올리기로 열리고 재크롭은 비활성이다 (#614)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    expect(screen.queryByRole('button', { name: '포스터 교체' })).toBeNull();
    // 랜딩 CTA와 이름이 같으므로 메뉴 패널 안에서만 찾는다.
    const menu = document.getElementById('editor-menu-panel') as HTMLElement;
    expect(within(menu).getByRole('button', { name: '포스터 올리기' })).toBeTruthy();
    expect((within(menu).getByRole('button', { name: '재크롭' }) as HTMLButtonElement).disabled).toBe(true);
  });

  test('업로드 전에도 임시저장/초기화는 노출된다(#310) — 포스터 전용 액션과 달리 게이팅하지 않는다', async () => {
    // 포스터(croppedImageUrl)는 새로고침에 안 남지만 movieInfo 등 나머지는 복원되므로(#310이 고치려는
    // 시나리오 자체), 포스터 재업로드 전에도 초기화에 닿을 수 있어야 한다.
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    expect(screen.getByRole('button', { name: '임시저장' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '초기화' })).toBeTruthy();
    // 반면 포스터가 있어야 뜻이 서는 액션은 여전히 게이팅된다 — '교체'는 아예 없고, 재크롭은
    // 행은 있되(#614에서 포스터 행이 '올리기'로 열렸다) 되살릴 원본이 없어 비활성이다.
    expect(screen.queryByRole('button', { name: '포스터 교체' })).toBeNull();
    expect((screen.getByRole('button', { name: '재크롭' }) as HTMLButtonElement).disabled).toBe(true);
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
    const armedRow = screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' });
    expect(armedRow).toBeTruthy();
    // arm 표시는 채움 틴트가 아니라 링이다(#569) — 붉은 틴트가 배경을 밝히면 같은 붉은 danger
    // 라벨 대비가 3.79:1로 떨어진다. 링이면 배경이 --surface 그대로라 4.66:1을 유지한다.
    expect(armedRow.style.boxShadow).toContain('var(--danger)');
    expect(armedRow.style.background).toBe('');
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
    // 포스터도 draft도 사라져 랜딩이 다시 뜬다(INITIAL_STATE 복귀 증거). #614에서 이 복귀는
    // 두 곳이 같이 되돌아야 성립한다 — usePhototicket.draftRestored와 셸의 landingDismissed.
    // 한쪽만 남으면 포스터도 랜딩도 없는 빈 셸이 된다.
    expect(landingShown()).toBe(true);
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

  test('#569 — 메뉴 패널은 오버레이 계층 토큰을 쓰고, 텍스트 행은 불투명 표면 위에 얹힌다', async () => {
    // 패널이 --glass-fill(입력 함몰용 8%)이라 밝은 포스터 위에서 항목이 안 보였다(#569).
    // 계층을 되돌리면(=패널을 다시 --glass-fill로) 같은 증상이 그대로 재발하므로 토큰 이름을
    // 못박는다. 알파를 올려도 muted·accent·danger 잉크는 유리 위에서 AA를 못 넘어서(globals.css
    // --overlay-* 주석의 실측표) 행 그룹이 불투명해야 한다 — 이게 FieldDrawer가 세운 규칙이다.
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    const panel = screen.getByRole('menu', { name: '편집 메뉴' });
    expect(panel.style.background).toBe('var(--overlay-fill)');
    expect(panel.style.borderColor).toBe('var(--overlay-border)');

    // 모든 행이 불투명 그룹 안에 있다 — 패널 직계 자식으로 새는 행이 없어야 한다.
    const rows = Array.from(panel.querySelectorAll('button'));
    expect(rows.length).toBeGreaterThan(3); // 루프가 빈 채로 통과하지 않게
    for (const row of rows) {
      const group = row.closest('div.bg-surface');
      expect(group === null ? `그룹 밖 행: ${row.textContent}` : true).toBe(true);
    }

    // 드로어 엣지 핸들도 같은 계층이다(#569 "같이 고칠 것") — 8% 유리로 되돌리면 밝은 포스터
    // 위에서 핸들이 다시 사라진다.
    const handle = screen.getByRole('button', { name: '티켓 항목 목록 열기' }).querySelector('span')!;
    expect((handle as HTMLElement).style.background).toBe('var(--overlay-fill)');
    // toContain('text-fg')이면 text-fg-muted로 되돌려도 통과한다 — 단어 경계로 못박는다.
    expect(handle.className).toMatch(/(^|\s)text-fg(\s|$)/);

    // 선택된 배치 라디오도 --fg로 — 다크에서 --accent는 불투명 표면 위에서도 3.97:1이다.
    await user.click(screen.getByRole('button', { name: '툴바 설정' }));
    const on = within(screen.getByRole('radiogroup', { name: '툴바 배치' }))
      .getByRole('radio', { name: '세로형 · 고정식' });
    expect(on.getAttribute('aria-checked')).toBe('true');
    expect(on.className).toMatch(/(^|\s)text-fg(\s|$)/);
    expect(on.className).not.toContain('text-accent');
  });

  test('툴바 설정(#447): 기본 접힘 → 헤더 클릭으로 펼침(라디오 4종) → 메뉴 재오픈 시 항상 접힘 리셋', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    const toggle = screen.getByRole('button', { name: '툴바 설정' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    // 접힘 상태의 실제 상호작용 차단은 grid-rows(#447, FieldAccordion과 동일 패턴)가 아니라
    // inert 속성이 담당 — happy-dom은 inert를 접근성 트리에 반영하지 않으므로(getByRole만으론
    // 관측 불가) 속성 자체를 직접 확인한다.
    const panelId = toggle.getAttribute('aria-controls')!;
    const inertWrapper = () => document.getElementById(panelId)!.parentElement!;
    expect(inertWrapper().hasAttribute('inert')).toBe(true);

    const group = within(screen.getByRole('radiogroup', { name: '툴바 배치' }));
    expect(group.getAllByRole('radio')).toHaveLength(4);
    expect(group.getByRole('radio', { name: '세로형 · 고정식' })).toBeTruthy();

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(inertWrapper().hasAttribute('inert')).toBe(false);

    // 메뉴를 닫았다 다시 열면 항상 접힘으로 리셋된다(#447).
    await user.click(screen.getByRole('button', { name: '편집 메뉴' })); // 닫기
    await user.click(screen.getByRole('button', { name: '편집 메뉴' })); // 재오픈
    expect(screen.getByRole('button', { name: '툴바 설정' }).getAttribute('aria-expanded')).toBe('false');
  });
});
