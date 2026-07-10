/**
 * #310 — 데스크톱 AppHeader의 임시저장/초기화 버튼 상호작용 테스트.
 * claude-review PR #344 P1: 모바일 서브메뉴 쪽은 커버됐지만 데스크톱 AppHeader는 테스트가 0이었다.
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader } from '@/components/v2/AppHeader';

afterEach(() => cleanup());

describe('AppHeader 임시저장/초기화 (#310)', () => {
  test('임시저장 클릭 → saveDraft 호출 + 아이콘이 체크로 전환', async () => {
    const saveDraft = mock(() => {});
    const user = userEvent.setup();
    render(<AppHeader theme="light" onThemeChange={() => {}} saveDraft={saveDraft} clearDraft={() => {}} />);

    await user.click(screen.getByRole('button', { name: '임시저장' }));

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '임시저장됨' })).toBeTruthy();
  });

  test('초기화 클릭 → confirm 취소 시 clearDraft 미호출', async () => {
    const origConfirm = window.confirm;
    window.confirm = mock(() => false);
    const clearDraft = mock(() => {});
    const user = userEvent.setup();
    render(<AppHeader theme="light" onThemeChange={() => {}} saveDraft={() => {}} clearDraft={clearDraft} />);

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(clearDraft).not.toHaveBeenCalled();
    window.confirm = origConfirm;
  });

  test('초기화 클릭 → confirm 승인 시 clearDraft 호출', async () => {
    const origConfirm = window.confirm;
    window.confirm = mock(() => true);
    const clearDraft = mock(() => {});
    const user = userEvent.setup();
    render(<AppHeader theme="light" onThemeChange={() => {}} saveDraft={() => {}} clearDraft={clearDraft} />);

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(clearDraft).toHaveBeenCalledTimes(1);
    window.confirm = origConfirm;
  });
});
