/**
 * #227 회귀 테스트 — DesktopStudioShell 빈 항목 미리보기(ghost) 토글 셸-와이어링.
 *
 * mobileEditorShellGhost(#216)와 대칭: 포스터 seed 후 토글 등장(기본 on) → 클릭이 aria-checked를
 * 뒤집음 → 실제 크기 모드로 가면 토글 비활성(disabled) + aria-checked=false(ghost 강제 off) →
 * 기본 복귀 시 이전 on 상태 회복. ghostEffective/disabled={isActual} 배선이 깨지면 여기서 잡힌다.
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
        onPendingFetchChange={() => {}}
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
  test('seed 후: 토글 on 기본 → 클릭으로 off/on → 실제 크기에서 강제 off + 비활성 → 복귀 시 회복', async () => {
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

    // 실제 크기 모드 → ghost 강제 off + 토글 비활성.
    await user.click(screen.getByRole('button', { name: '실제 크기' }));
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect((toggle as HTMLButtonElement).disabled).toBe(true);

    // 기본 복귀 → ghostMode(on) 회복.
    await user.click(screen.getByRole('button', { name: '기본' }));
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect((toggle as HTMLButtonElement).disabled).toBe(false);
  });
});
