/**
 * #436 — 자동저장 스위치의 상태 라벨/토글 회귀.
 *
 * 원래 appHeaderDraftActions.test.tsx가 데스크톱 AppHeader를 통해 이걸 덮고 있었는데, 그 헤더가
 * #607에서 삭제됐다. 임시저장/초기화 버튼 자체는 모바일 헤더 메뉴 쪽 커버리지
 * (mobileEditorShellMenu.test.tsx, arm 2탭 포함)가 더 두꺼워 이관할 게 없었고, 남은 건 이
 * 스위치뿐이라 컴포넌트를 직접 렌더한다(소비자는 MobileEditorShell 헤더).
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoSaveIndicator } from '@/components/v2/AutoSaveIndicator';

afterEach(() => cleanup());

describe('AutoSaveIndicator (#436)', () => {
  test('클릭 시 onToggle 호출', async () => {
    const onToggle = mock(() => {});
    const user = userEvent.setup();
    render(<AutoSaveIndicator enabled lastSavedAt={null} onToggle={onToggle} />);

    await user.click(screen.getByRole('switch', { name: '자동 임시저장 켜짐 — 클릭하면 꺼요' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('enabled=false면 꺼짐 상태 라벨을 노출', () => {
    render(<AutoSaveIndicator enabled={false} lastSavedAt={null} onToggle={() => {}} />);

    expect(screen.getByRole('switch', { name: '자동 임시저장 꺼짐 — 클릭하면 켜요' })).toBeTruthy();
  });
});
