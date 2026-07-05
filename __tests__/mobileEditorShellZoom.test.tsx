/**
 * #214 회귀 테스트 — MobileEditorShell 프리뷰 3단 줌 모드(기본/최대화/실제 크기).
 *
 * pill·프리뷰는 croppedImageUrl이 있을 때만 렌더되므로, 하네스에 포스터 업로드 버튼을 두고
 * 테스트가 먼저 눌러 seed한다(실제 usePhototicket.handleImageUpload 경로). 검증:
 * 3모드 aria-label 존재 → 최대화 선택 시 aria-pressed 토글 → 실제 크기 캡션 노출 → 기본 복귀.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        onThemeChange={() => {}}
        onPendingFetchChange={() => {}}
        onDone={() => {}}
        disabledReason=""
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={photo.state.components}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

afterEach(cleanup);

describe('MobileEditorShell 줌 모드 (#214)', () => {
  test('포스터 seed 후: 3모드 pill 렌더 → 최대화/실제/기본 전환이 상태→결과로 반영', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // seed 전엔 pill이 없다.
    expect(screen.queryByRole('button', { name: '최대화' })).toBeNull();

    await user.click(screen.getByText('seed-poster'));

    const def = screen.getByRole('button', { name: '기본' });
    const max = screen.getByRole('button', { name: '최대화' });
    const actual = screen.getByRole('button', { name: '실제 크기' });

    // 초기값은 기본 선택.
    expect(def.getAttribute('aria-pressed')).toBe('true');
    expect(max.getAttribute('aria-pressed')).toBe('false');

    // 최대화 → 자신만 pressed, 캡션 없음.
    await user.click(max);
    expect(max.getAttribute('aria-pressed')).toBe('true');
    expect(def.getAttribute('aria-pressed')).toBe('false');
    expect(actual.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText(/실제 크기 ·/)).toBeNull();

    // 실제 크기 → pressed + 캡션 노출.
    await user.click(actual);
    expect(actual.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/실제 크기 · 5\.5 × 8\.5cm/)).toBeTruthy();

    // 기본 복귀 → 캡션 사라짐.
    await user.click(def);
    expect(def.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByText(/실제 크기 ·/)).toBeNull();
  });
});
