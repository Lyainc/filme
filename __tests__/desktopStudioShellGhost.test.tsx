/**
 * #227 회귀 테스트 — DesktopStudioShell 빈 항목 미리보기(ghost) 토글 셸-와이어링.
 *
 * mobileEditorShellGhost(#216)와 대칭: 포스터 seed 후 토글 등장(기본 on) → 클릭이 aria-checked를
 * 뒤집음. ("실제 크기" 모드에서 ghost를 강제 off하던 분기는 #311에서 모드 자체가 제거되며 함께 사라짐.)
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesktopStudioShell } from '@/components/v2/DesktopStudioShell';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <DesktopStudioShell
        photo={photo}
        theme="light"
        onThemeChange={() => {}}
        canExport
        disabledReason=""
        resultOpen={false}
        onDone={() => {}}
        onBackToEdit={() => {}}
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={photo.state.components}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

afterEach(cleanup);

describe('DesktopStudioShell ghost 토글 (#227)', () => {
  test('seed 후: 토글 on 기본 → 클릭으로 off/on', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // seed 전엔 컨트롤 바(토글)가 없다(croppedImageUrl 없음).
    expect(screen.queryByRole('switch', { name: '빈 항목 미리보기' })).toBeNull();

    await user.click(screen.getByText('seed-poster'));

    const toggle = screen.getByRole('switch', { name: '빈 항목 미리보기' });
    expect(toggle.getAttribute('aria-checked')).toBe('true'); // 기본 on

    await user.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false'); // off

    await user.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true'); // on
  });
});
