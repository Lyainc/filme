/**
 * #315 → #826 S2 D09 회귀 테스트 — MobileEditorShell 편집 메뉴 시트.
 *
 * 카드 두 장(설정: 빈 항목 표시 · 테마 · 자동저장 / 문서: 스크린샷으로 자동입력 · 임시저장 · 초기화), 행 44, 머리줄 없음.
 * 닫기는 바깥(스크림) 탭 · ⋯ 재탭 · Escape이고 role=dialog + aria-modal, 열면 첫 행으로 포커스, 닫으면 ⋯로 돌아온다.
 * 포스터 교체 · 재크롭 · 고급 설정 · 다크모드 토글 행은 없다(포스터는 도크 사진 모드, 테마는 3갈래 라디오).
 * 'OCR 행'은 mobileEditorShellOcrEntryConsolidation이 runOcr 모킹과 함께 잠근다.
 */
import { describe, expect, test, afterEach, beforeEach, jest } from 'bun:test';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket, STORAGE_KEY } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import type { ThemePreference } from '@/constants/theme';
import { mobileShellProps } from './shellHarness';

// 랜딩 오버레이 노출 여부(#614) — 랜딩은 overlay/hidden 두 모드라 "덮고 있나"는 fixed로
// 잰다. 테스트엔 Tailwind CSS가 안 실려 getComputedStyle이 클래스를 안 반영하므로 className으로.
const landingShown = () => screen.getByTestId('landing').classList.contains('fixed');

// 상단 줄은 랜딩이 떠 있는 동안 서지 않는다(#826 S2) — 편집으로 들어가는 가장 짧은 길인 '직접 입력'을 먼저 누른다.
const leaveLanding = () => fireEvent.click(screen.getByTestId('landing-skip-poster'));
// 저장분이 있는 재방문은 '이어서 만들기'로 들어간다(문서를 안 되돌리는 유일한 이탈, #727 c5).
const resumeFromLanding = () => fireEvent.click(screen.getByTestId('landing-restore'));

// 초기화 더블탭 가드(CLEAR_DOUBLE_TAP_GUARD_MS = 350)를 실시간으로 넘기는 대기.
const CLEAR_GUARD_WAIT_MS = 380;

const menuButton = () => screen.getByRole('button', { name: '편집 메뉴' });
const menu = () => screen.getByRole('dialog', { name: '편집 메뉴' });
const menuClosed = () => screen.queryByRole('dialog', { name: '편집 메뉴' }) === null;

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed
      </button>
      <button type="button" onClick={() => photo.updateMovieInfo({ title: '괴물' })}>
        edit
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  jest.useRealTimers();
});

describe('편집 메뉴 시트 (#826 S2 D09)', () => {
  test('⋯ 탭 → 시트 열림/닫힘(aria-expanded), role=dialog + aria-modal, 머리줄 · 손잡이 없음', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();

    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    expect(menuClosed()).toBe(true);

    await user.click(menuButton());
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
    expect(menu().getAttribute('aria-modal')).toBe('true');
    // 머리줄(제목·닫기 버튼) 없음 — 시트의 직계 자식은 카드 두 장뿐이다.
    expect(Array.from(menu().children).map((c) => c.getAttribute('role'))).toEqual(['group', 'group']);
    expect(screen.getByRole('group', { name: '설정' })).toBeTruthy();
    expect(screen.getByRole('group', { name: '문서' })).toBeTruthy();
  });

  test('닫기 세 경로: 바깥(스크림) 탭 · ⋯ 재탭 · Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();

    await user.click(menuButton());
    await user.click(screen.getByTestId('editor-menu-scrim'));
    expect(menuClosed()).toBe(true);
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');

    await user.click(menuButton());
    await user.click(menuButton());
    expect(menuClosed()).toBe(true);

    await user.click(menuButton());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(menuClosed()).toBe(true);
  });

  test('열면 첫 행(빈 항목 표시)으로 포커스가 가고, 닫으면 ⋯로 돌아온다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();

    await user.click(menuButton());
    // DOM 노드를 toBe로 비교하면 실패 시 직렬화가 폭발한다 — 불리언으로(#693).
    expect(document.activeElement === screen.getByRole('switch', { name: '빈 항목 표시' })).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement === menuButton()).toBe(true);
  });

  // 포커스는 그냥 닫힐 때만 ⋯로 돌아간다 — 행이 일을 하고 닫을 땐 그 일(파일 선택 · 초기화 · 임시저장 안내)이 포커스를 쥔다.
  test('포커스 복귀: 스크림 탭 · ⋯ 재탭 · Escape는 ⋯로, 행 동작(자동입력 · 임시저장)으로 닫을 땐 ⋯로 안 돌아간다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    const onTrigger = () => document.activeElement === menuButton();

    await user.click(menuButton());
    await user.click(screen.getByTestId('editor-menu-scrim'));
    expect(onTrigger()).toBe(true);

    await user.click(menuButton());
    await user.click(menuButton());
    expect(onTrigger()).toBe(true);

    await user.click(menuButton());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onTrigger()).toBe(true);

    await user.click(menuButton());
    await user.click(within(menu()).getByRole('button', { name: '스크린샷으로 자동입력' }));
    expect(menuClosed()).toBe(true);
    expect(onTrigger()).toBe(false);

    act(() => menuButton().blur());
    await user.click(menuButton());
    await user.click(within(menu()).getByRole('button', { name: '임시저장' }));
    expect(menuClosed()).toBe(true);
    expect(onTrigger()).toBe(false);
  });

  test('Tab은 시트 밖으로 새지 않고 끝에서 처음으로 돈다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    await user.click(menuButton());

    const focusables = Array.from(menu().querySelectorAll<HTMLElement>('button:not([tabindex="-1"])'));
    const last = focusables[focusables.length - 1];
    act(() => last.focus());
    await user.tab();
    expect(document.activeElement === focusables[0]).toBe(true);
    await user.tab({ shift: true });
    expect(document.activeElement === last).toBe(true);
  });

  test('행은 설정 3(빈 항목 표시 · 테마 · 자동저장) + 문서 3(스크린샷으로 자동입력 · 임시저장 · 초기화)이고, 포스터 · 고급 설정 · 다크모드 행은 없다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    fireEvent.click(screen.getByText('seed'));
    await user.click(menuButton());

    const set = within(screen.getByRole('group', { name: '설정' }));
    expect(set.getByRole('switch', { name: '빈 항목 표시' })).toBeTruthy();
    expect(set.getByRole('radiogroup', { name: '테마' })).toBeTruthy();
    expect(set.getByRole('switch', { name: /^자동저장/ })).toBeTruthy();

    const doc = within(screen.getByRole('group', { name: '문서' }));
    expect(doc.getByRole('button', { name: '스크린샷으로 자동입력' })).toBeTruthy();
    expect(doc.getByRole('button', { name: '임시저장' })).toBeTruthy();
    expect(doc.getByRole('button', { name: '초기화' })).toBeTruthy();

    for (const gone of ['포스터 교체', '포스터 추가', '재크롭', '고급 설정', '다크모드']) {
      expect(within(menu()).queryByText(gone) === null).toBe(true);
    }
  });

  test('행 높이는 44(min-h-touch)이고 버튼 이름에 아이콘이 끼지 않는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    await user.click(menuButton());

    const rows = Array.from(menu().querySelectorAll('button')).filter((b) => b.getAttribute('role') !== 'radio');
    expect(rows.length).toBe(5);
    for (const row of rows) expect(row.classList.contains('min-h-touch')).toBe(true);
    expect(menu().querySelectorAll('svg').length).toBe(0); // 리딩 아이콘 없음
  });

  test('시트는 불투명 면(bg-s1)이고 blur · 그라데이션이 없다 (constraint-11)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    await user.click(menuButton());

    expect(menu().classList.contains('bg-s1')).toBe(true);
    expect(menu().style.backdropFilter).toBe('');
    expect(menu().getAttribute('style') ?? '').not.toMatch(/gradient|blur/);
  });

  test('시트와 스크림은 프레임 안 fixed 좌표이고 스크림은 상단 줄(52px) 아래부터다 — ⋯ 재탭이 스크림에 안 먹힌다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    await user.click(menuButton());

    expect(menu().classList.contains('fixed')).toBe(true);
    const scrim = screen.getByTestId('editor-menu-scrim');
    expect(scrim.classList.contains('fixed')).toBe(true);
    expect(scrim.classList.contains('top-[52px]')).toBe(true);
  });

  test('메뉴가 열려 있어도 완료 버튼은 바로 눌린다 (claude-review PR #331 P2)', async () => {
    const user = userEvent.setup();
    let calls = 0;
    function DoneHarness() {
      const photo = usePhototicket();
      return (
        <>
          {/* 완료는 캔버스가 서야 렌더(#363) — seed 후에 검증한다. */}
          <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
            seed
          </button>
          <MobileEditorShell
            {...mobileShellProps(photo, {
              onDone: () => {
                calls++;
              },
            })}
          />
        </>
      );
    }
    render(<DoneHarness />);
    leaveLanding();
    fireEvent.click(screen.getByText('seed'));

    await user.click(menuButton());
    expect(menu()).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '완료' }));
    expect(calls).toBe(1);
  });
});

describe('테마 3갈래 (#826 S2 D09, acceptance-17 — 저장 규칙은 useThemePreference 테스트가 잠근다)', () => {
  function ThemeHarness({ onPick }: { onPick: (p: ThemePreference) => void }) {
    const photo = usePhototicket();
    const [pref, setPref] = useState<ThemePreference>('system');
    return (
      <MobileEditorShell
        {...mobileShellProps(photo, {
          themePreference: pref,
          onThemeChange: (p) => {
            onPick(p);
            setPref(p);
          },
        })}
      />
    );
  }

  test('시스템 · 라이트 · 다크 라디오 3개, 선택은 선호값을 따르고 클릭이 선호값을 올린다', async () => {
    const user = userEvent.setup();
    const picks: ThemePreference[] = [];
    render(<ThemeHarness onPick={(p) => picks.push(p)} />);
    leaveLanding();
    await user.click(menuButton());

    const group = within(screen.getByRole('radiogroup', { name: '테마' }));
    expect(group.getAllByRole('radio').map((r) => r.textContent)).toEqual(['시스템', '라이트', '다크']);
    expect(group.getByRole('radio', { name: '시스템' }).getAttribute('aria-checked')).toBe('true');

    await user.click(group.getByRole('radio', { name: '다크' }));
    expect(picks).toEqual(['dark']);
    expect(group.getByRole('radio', { name: '다크' }).getAttribute('aria-checked')).toBe('true');
    expect(group.getByRole('radio', { name: '시스템' }).getAttribute('aria-checked')).toBe('false');

    await user.click(group.getByRole('radio', { name: '시스템' }));
    expect(picks).toEqual(['dark', 'system']);
  });

  test('화살표 키로 이웃 라디오를 고르고 선택된 것만 Tab 정지점이다', async () => {
    const user = userEvent.setup();
    const picks: ThemePreference[] = [];
    render(<ThemeHarness onPick={(p) => picks.push(p)} />);
    leaveLanding();
    await user.click(menuButton());

    const system = screen.getByRole('radio', { name: '시스템' });
    expect(system.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('radio', { name: '라이트' }).getAttribute('tabindex')).toBe('-1');

    act(() => system.focus());
    await user.keyboard('{ArrowRight}');
    expect(picks).toEqual(['light']);
    expect(document.activeElement === screen.getByRole('radio', { name: '라이트' })).toBe(true);
  });
});

describe('자동저장 행 (#826 S2 D09)', () => {
  test('스위치가 자동저장을 켜고 끄며, 켜져 있고 저장된 적이 있을 때만 "HH:MM 저장" 시각 메타가 뜬다', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    leaveLanding();

    // 기본 켜짐 · 아직 저장 전 — 메타 없음.
    await user.click(menuButton());
    let row = screen.getByRole('switch', { name: '자동저장 켜짐' });
    expect(row.getAttribute('aria-checked')).toBe('true');
    expect(within(menu()).queryByText(/\d{2}:\d{2} 저장/) === null).toBe(true);
    await user.click(menuButton());

    // 실사용자 편집 → 자동저장 디바운스(1s) 뒤 저장 시각이 생긴다.
    fireEvent.click(screen.getByText('edit'));
    act(() => jest.advanceTimersByTime(1000));
    await user.click(menuButton());
    expect(within(menu()).getByText(/^\d{2}:\d{2} 저장$/)).toBeTruthy();

    // 끄면 라벨이 꺼짐으로 바뀌고 시각 메타가 사라진다.
    row = screen.getByRole('switch', { name: '자동저장 켜짐' });
    await user.click(row);
    row = screen.getByRole('switch', { name: '자동저장 꺼짐' });
    expect(row.getAttribute('aria-checked')).toBe('false');
    expect(within(menu()).queryByText(/\d{2}:\d{2} 저장/) === null).toBe(true);
    // 끄고 켜는 방법은 title이 지고(축 2 예외), 라벨은 조건절 없는 상태 명사구다.
    expect(row.getAttribute('aria-label')).toBe('자동저장 꺼짐');
    expect(row.getAttribute('title')).toBe('자동저장 꺼짐 — 클릭하면 켜요');
  });
});

describe('문서 카드: 임시저장 · 초기화', () => {
  test('업로드 전에도 임시저장/초기화는 노출된다(#310) — 포스터 전용 액션과 달리 게이팅하지 않는다', async () => {
    // 포스터(croppedImageUrl)는 새로고침에 안 남지만 movieInfo 등 나머지는 복원되므로(#310이 고치려는
    // 시나리오 자체), 포스터 재업로드 전에도 초기화에 닿을 수 있어야 한다.
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    await user.click(menuButton());

    expect(screen.getByRole('button', { name: '임시저장' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '초기화' })).toBeTruthy();
  });

  test('초기화(#310): 포스터 없이 복원된 stale 값만 있어도 초기화로 지워진다(핵심 시나리오 — 새로고침 직후)', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '기생충' } }));
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    resumeFromLanding();
    await user.click(menuButton());

    // 2탭 arm(#374) — 1탭은 arm만, 확인 문구로 바뀐 행을 한 번 더 탭해야 실행.
    // 더블탭 가드(350ms) 밖에서 재탭해야 실행된다(PR #375 P1) — 가짜 타이머로 즉시 전진.
    await user.click(screen.getByRole('button', { name: '초기화' }));
    act(() => jest.advanceTimersByTime(400));
    await user.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getAllByText('초기화했어요').length).toBeGreaterThan(0);
  });

  test('임시저장(#310): 즉시 localStorage에 저장 + 토스트 + 시트 닫힘', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    fireEvent.click(screen.getByText('seed'));
    await user.click(menuButton());

    await user.click(screen.getByRole('button', { name: '임시저장' }));

    expect(menuClosed()).toBe(true);
    expect(screen.getAllByText('임시저장했어요').length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  test('초기화 arm(#374): 1탭은 실행하지 않는다 — 라벨이 앰버 확인 문구로 바뀌고, 시트를 닫으면 해제된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    fireEvent.click(screen.getByText('seed'));
    await user.click(menuButton());

    await user.click(screen.getByRole('button', { name: '초기화' }));
    // arm됨 — 시트는 열린 채, 실행은 아직.
    const armedRow = screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' });
    // 앰버(--pr-warn) 글자 + 굵게다(D09 .armed) — 채움 틴트나 링이 아니다.
    expect(armedRow.classList.contains('text-warn')).toBe(true);
    expect(armedRow.classList.contains('font-semibold')).toBe(true);
    expect(screen.queryByText('초기화했어요') === null).toBe(true);

    // 시트를 닫았다 다시 열면 arm이 풀려 원래 라벨로 돌아오고, 초기화 토스트도 없다(미실행 증거).
    await user.click(menuButton());
    await user.click(menuButton());
    expect(screen.getByRole('button', { name: '초기화' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '한 번 더 눌러 전체 삭제' }) === null).toBe(true);
    expect(screen.queryByText('초기화했어요') === null).toBe(true);
  });

  test('초기화 arm(#374): 2탭 시 storage 삭제 + 상태 초기화 + 토스트 + 랜딩 복귀', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '기생충' } }));
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    leaveLanding();
    fireEvent.click(screen.getByText('seed'));
    await user.click(menuButton());

    // 더블탭 가드 경계(350ms) — 정확히 350ms 지나면 실행된다(가드 조건은 `< 350`). userEvent의
    // 클릭 디스패치 자체가 가짜 타이머를 1ms씩 미세 전진시키는 걸 실측했으므로(bun 1.3.14), 경계를
    // 정밀하게 재는 arm·재탭 두 탭은 fireEvent로 — 동기라 타이머를 안 건드린다.
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    act(() => jest.advanceTimersByTime(350));
    fireEvent.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getAllByText('초기화했어요').length).toBeGreaterThan(0);
    // 포스터도 draft도 사라져 랜딩이 다시 뜬다(INITIAL_STATE 복귀 증거). #614에서 이 복귀는
    // 두 곳이 같이 되돌아야 성립한다 — usePhototicket.draftRestored와 셸의 landingDismissed.
    expect(landingShown()).toBe(true);
    // 실행 후 시트는 닫힌다.
    expect(menuClosed()).toBe(true);
  });

  // 초기화는 새 문서다 — 열려 있던 인플레이스 편집의 activeField가 남으면, 랜딩을 거쳐 새 문서로 들어올 때 그 필드 입력기가
  // 되살아난다. '이어서 만들기'는 startFreshDoc을 안 거치므로 performClear의 closeEditor만이 이걸 막는다.
  test('초기화(#826 S2): 열려 있던 필드 입력기가 새 문서로 넘어가지 않는다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    leaveLanding();
    fireEvent.click(screen.getByText('seed'));
    fireEvent.click(await screen.findByRole('button', { name: '극장 편집' }));
    await screen.findByRole('group', { name: '극장 입력' });

    await user.click(menuButton());
    await user.click(screen.getByRole('button', { name: '초기화' }));
    await new Promise((r) => setTimeout(r, CLEAR_GUARD_WAIT_MS)); // 더블탭 가드(350ms) 밖
    await user.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));
    expect(landingShown()).toBe(true);

    // 새 문서로 다시 들어온다 — 포스터 없이 편집 캔버스가 선다.
    await user.click(screen.getByTestId('landing-restore'));
    expect(landingShown()).toBe(false);
    expect(screen.queryByRole('group', { name: '극장 입력' }) === null).toBe(true);
    expect(screen.queryByRole('textbox', { name: '극장' }) === null).toBe(true);
  });

  test('초기화 arm(#374): arm 직후 350ms 내 재탭(더블탭)은 실행되지 않는다 (claude-review PR #375 P1)', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    leaveLanding();
    fireEvent.click(screen.getByText('seed'));
    await user.click(menuButton());

    // 더블탭 가드 경계(350ms) 바로 앞 — 349ms 시점 재탭은 여전히 무시된다(가드 조건은 `< 350`).
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    act(() => jest.advanceTimersByTime(349));
    fireEvent.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

    // 실행되지 않고 armed 상태로 남는다.
    expect(screen.queryByText('초기화했어요') === null).toBe(true);
    expect(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' })).toBeTruthy();
  });

  test('초기화 arm(#374): 3.2초 내 재탭이 없으면 자동 해제된다 (claude-review PR #375 P1)', () => {
    jest.useFakeTimers();
    render(<Harness />);
    leaveLanding();
    // 자동 해제 타이머는 arm 탭이 스케줄하므로, 그 시점부터 정확히 재려면 fireEvent로 연다.
    fireEvent.click(menuButton());
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));
    expect(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' })).toBeTruthy();

    // 경계 바로 앞(3199ms) — 아직 자동 해제 타이머(3200ms)가 안 끝나 armed 유지.
    act(() => jest.advanceTimersByTime(3199));
    expect(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' })).toBeTruthy();

    // 경계(누적 3200ms) — 자동 해제 타이머 만료.
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByRole('button', { name: '초기화' })).toBeTruthy();
    expect(screen.queryByText('초기화했어요') === null).toBe(true);
  });
});
