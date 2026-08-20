import { describe, expect, test, afterEach } from 'bun:test';
import { act, render, screen, cleanup } from '@testing-library/react';
import { showError, dismissError, resetErrorToastForTest, ErrorToastHost } from '@/utils/errorToast';

// #731 code-review 발견 — errorToast 싱글턴은 우선순위 없이 마지막 호출이 무조건 이겼다.
// persistent 경고(예: 저장 실패, 사용자가 직접 닫아야 함)가 뜬 사이 다른 곳의 ephemeral 호출
// (예: 색상 추출 실패, 4초 후 자동 소멸)이 오면 조용히 덮어써 더 중요한 경고가 사라졌다.
describe('#731 — errorToast persistent 경고는 ephemeral 호출에 덮이지 않는다', () => {
  afterEach(() => {
    resetErrorToastForTest();
    cleanup();
  });

  test('persistent가 떠 있으면 뒤이은 ephemeral 호출은 무시된다', () => {
    render(<ErrorToastHost />);
    act(() => showError('저장에 실패했어요.', { persistent: true }));
    act(() => showError('추천 색상을 만들지 못했어요.'));
    expect(screen.getByRole('alert').textContent).toContain('저장에 실패했어요.');
  });

  test('ephemeral끼리는 그대로 나중 호출이 이긴다(기존 동작 유지)', () => {
    render(<ErrorToastHost />);
    act(() => showError('첫 번째 알림'));
    act(() => showError('두 번째 알림'));
    expect(screen.getByRole('alert').textContent).toContain('두 번째 알림');
  });

  test('persistent는 새 persistent로는 계속 갱신된다', () => {
    render(<ErrorToastHost />);
    act(() => showError('첫 경고', { persistent: true }));
    act(() => showError('더 급한 경고', { persistent: true }));
    expect(screen.getByRole('alert').textContent).toContain('더 급한 경고');
  });

  test('닫기 뒤에는 ephemeral 호출이 다시 정상 반영된다', () => {
    render(<ErrorToastHost />);
    act(() => showError('저장에 실패했어요.', { persistent: true }));
    act(() => dismissError());
    act(() => showError('추천 색상을 만들지 못했어요.'));
    expect(screen.getByRole('alert').textContent).toContain('추천 색상을 만들지 못했어요.');
  });
});
