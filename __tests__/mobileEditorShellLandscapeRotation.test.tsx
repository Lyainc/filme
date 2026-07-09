/**
 * #275 회귀 테스트 — MobileEditorShell landscape 무드(editorial 등) 회전 배치 + 실제 크기 캘리브레이션.
 *
 * 리뷰 지적(#275 PR): 기존 mobileEditorShellZoom.test.tsx는 portrait(minimal) 레이아웃만 시드해
 * rotateLandscape 회전 배치·usePhysicalSizeCorrection 캘리브레이션 슬라이더 어느 쪽도 렌더된 적이
 * 없었다. landscape 레이아웃으로 줌 전환이 크래시 없이 되는지, 캘리브레이션 슬라이더 조작이
 * 표시%·localStorage에 반영되는지 검증한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(cleanup);

describe('MobileEditorShell landscape 회전 배치 (#275-8)', () => {
  test('editorial(landscape) 시드 후 최대화/실제 크기 전환이 크래시 없이 렌더된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('seed-editorial-poster'));

    const max = screen.getByRole('button', { name: '최대화' });
    const actual = screen.getByRole('button', { name: '실제 크기' });

    await user.click(max);
    expect(screen.getByRole('button', { name: '기본 크기로 돌아가기' })).toBeTruthy();

    await user.click(actual);
    expect(screen.getByText(/실제 크기 · 8\.5 × 5\.5cm/)).toBeTruthy();

    // 기본 복귀 — 회전 래퍼가 사라진다.
    await user.click(screen.getByRole('button', { name: '기본' }));
    expect(screen.queryByRole('button', { name: '기본 크기로 돌아가기' })).toBeNull();
  });
});

describe('실제 크기 물리 보정 캘리브레이션 (#275-7)', () => {
  test('캘리브레이션 슬라이더 조작이 표시%와 localStorage에 반영된다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('seed-editorial-poster'));
    await user.click(screen.getByRole('button', { name: '실제 크기' }));

    expect(screen.getByText(/보정 100%/)).toBeTruthy();

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '1.2' } });

    expect(screen.getByText(/보정 120%/)).toBeTruthy();
    expect(window.localStorage.getItem('phototicket:actualSizeCalibration')).toBe('1.2');
  });
});
