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

  test('#570 — title 툴팁 없이도 "자동저장" 캡션이 항상 보인다', () => {
    render(<AutoSaveIndicator enabled lastSavedAt={null} onToggle={() => {}} />);

    expect(screen.getByText('자동저장')).toBeTruthy();
    // 캡션은 버튼 밖 비상호작용 텍스트라 44px 히트 타깃엔 안 얹힌다.
    expect(screen.getByRole('switch').textContent).not.toContain('자동저장');
  });

  test('#570 — 캡션은 whitespace-nowrap이라 좁은 헤더에서 "자동저\\n장"처럼 줄바꿈되지 않는다', () => {
    render(<AutoSaveIndicator enabled lastSavedAt={null} onToggle={() => {}} />);

    expect(screen.getByText('자동저장').className).toContain('whitespace-nowrap');
  });

  test('#570 — 점 크기는 h-2(8px)로 줄고 44px 히트 타깃(h-11 w-11)은 유지된다', () => {
    render(<AutoSaveIndicator enabled lastSavedAt={null} onToggle={() => {}} />);

    const button = screen.getByRole('switch');
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('w-11');
    const dot = button.querySelector('span > span:last-child') as HTMLElement;
    expect(dot.className).toContain('h-2 w-2');
    expect(dot.className).not.toContain('h-2.5');
  });

  test('#570 — enabled 여부가 점 색으로 시각 구분된다', () => {
    const { rerender } = render(<AutoSaveIndicator enabled lastSavedAt={null} onToggle={() => {}} />);
    const dotOn = screen.getByRole('switch').querySelector('span > span:last-child') as HTMLElement;
    expect(dotOn.className).toContain('bg-accent');

    rerender(<AutoSaveIndicator enabled={false} lastSavedAt={null} onToggle={() => {}} />);
    const dotOff = screen.getByRole('switch').querySelector('span > span:last-child') as HTMLElement;
    expect(dotOff.className).toContain('bg-fg-faint');
  });
});
