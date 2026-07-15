/**
 * #216 회귀 테스트 — MobileEditorShell 빈 항목 미리보기(ghost) 토글.
 *
 * 검증: 포스터 seed 후 토글 등장(기본 on) → 클릭이 aria-checked를 뒤집음.
 * ("실제 크기" 모드에서 ghost를 강제 off하던 분기는 #311에서 모드 자체가 제거되며 함께 사라짐.)
 *
 * 토글은 헤더 서브메뉴 안(#315)이라 매번 메뉴를 열어 얻는다.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

afterEach(cleanup);

describe('MobileEditorShell ghost 토글 (#216)', () => {
  test('seed 후: 토글 on 기본 → 클릭으로 off/on', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // seed 전엔 토글이 없다(헤더 서브메뉴 안, #315).
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(screen.queryByRole('switch', { name: '빈 항목 미리보기' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    await user.click(screen.getByText('seed-poster'));

    // #315: 토글은 헤더 서브메뉴 안으로 이전 — 메뉴를 열어야 보인다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    // 기본값 on.
    expect(screen.getByRole('switch', { name: '빈 항목 미리보기' }).getAttribute('aria-checked')).toBe('true');

    // 클릭 → off.
    await user.click(screen.getByRole('switch', { name: '빈 항목 미리보기' }));
    expect(screen.getByRole('switch', { name: '빈 항목 미리보기' }).getAttribute('aria-checked')).toBe('false');

    // 다시 클릭 → on.
    await user.click(screen.getByRole('switch', { name: '빈 항목 미리보기' }));
    expect(screen.getByRole('switch', { name: '빈 항목 미리보기' }).getAttribute('aria-checked')).toBe('true');
  });
});
