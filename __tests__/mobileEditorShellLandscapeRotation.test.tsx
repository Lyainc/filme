/**
 * #275 회귀 테스트 — MobileEditorShell landscape 무드(editorial 등) 회전 배치.
 *
 * 리뷰 지적(#275 PR): 기존 mobileEditorShellZoom.test.tsx는 portrait(minimal) 레이아웃만 시드해
 * rotateLandscape 회전 배치가 렌더된 적이 없었다. landscape 레이아웃으로 줌 전환이 크래시 없이
 * 되는지 검증한다. ("실제 크기" 모드·물리 크기 캘리브레이션 슬라이더는 #311에서 모드째로 제거됨.)
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
      <button
        type="button"
        onClick={() => {
          photo.updateComponents({ layout: 'editorial' });
          photo.handleImageUpload('blob:test-poster');
        }}
      >
        seed-editorial-poster
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        onThemeChange={() => {}}
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

describe('MobileEditorShell landscape 회전 배치 (#275-8)', () => {
  test('editorial(landscape) 시드 후 최대화 전환이 크래시 없이 렌더된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('seed-editorial-poster'));

    await user.click(screen.getByRole('button', { name: '최대화' }));
    expect(screen.getByRole('button', { name: '기본 크기로 돌아가기' })).toBeTruthy();

    // 기본 복귀 — 회전 래퍼가 사라진다.
    await user.click(screen.getByRole('button', { name: '기본 크기로 돌아가기' }));
    expect(screen.queryByRole('button', { name: '기본 크기로 돌아가기' })).toBeNull();
  });
});
