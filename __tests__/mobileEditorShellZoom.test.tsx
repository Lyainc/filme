/**
 * #214 회귀 테스트 — MobileEditorShell 프리뷰 2단 줌 모드(기본/최대화).
 * #328로 max를 "모든 UX를 숨기고 티켓만 풀스크린" 모드로 재정의.
 * #356으로 줌 pill(ZoomSegment)을 제거 — 최대화 진입은 플로팅 툴바 버튼이 흡수하고,
 * max 탈출은 티켓 탭 복귀 그대로다.
 *
 * 툴바·프리뷰는 croppedImageUrl이 있을 때만 렌더되므로, 하네스에 포스터 업로드 버튼을 두고
 * 테스트가 먼저 눌러 seed한다(실제 usePhototicket.handleImageUpload 경로). 검증:
 * 툴바 최대화 버튼 → 헤더·툴바·OCR을 숨기고 티켓 탭으로만 기본 복귀 가능.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
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
  // 툴바 위치·숨김 영속(filme:toolbar:v1)이 테스트 간 새지 않게 초기화.
  window.localStorage.clear();
});
afterEach(cleanup);

describe('MobileEditorShell 줌 모드 (#214/#328/#356)', () => {
  test('포스터 seed 후: 줌 pill 없이 플로팅 툴바가 뜨고 최대화 버튼이 있다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // seed 전엔 툴바가 없다(프리뷰가 있어야 의미).
    expect(screen.queryByRole('toolbar', { name: '편집 도구' })).toBeNull();

    await user.click(screen.getByText('seed-poster'));

    // 줌 pill(ZoomSegment)은 제거됐고(#356) 툴바가 최대화 진입점을 흡수했다.
    expect(screen.queryByRole('group', { name: '미리보기 크기' })).toBeNull();
    expect(screen.getByRole('toolbar', { name: '편집 도구' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '최대화' })).toBeTruthy();
  });

  test('최대화(#328): 헤더·툴바·OCR을 숨기고 티켓만 남기며, 티켓 탭으로만 기본 복귀한다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('seed-poster'));

    // 진입 전: 헤더 메뉴 버튼·툴바가 모두 보인다.
    expect(screen.getByRole('button', { name: '편집 메뉴' })).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: '편집 도구' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '최대화' }));

    // 진입 후: 헤더·툴바가 사라지고, 티켓 탭(기본 복귀) 핸들만 남는다.
    expect(screen.queryByRole('button', { name: '편집 메뉴' })).toBeNull();
    expect(screen.queryByRole('toolbar', { name: '편집 도구' })).toBeNull();
    const escapeHatch = screen.getByRole('button', { name: '기본 크기로 돌아가기' });
    // 진입 버튼이 있던 툴바가 언마운트돼 포커스가 body로 떨어지면 키보드 사용자가 복귀
    // 수단을 잃는다 — 포커스는 유일한 탈출구(티켓 래퍼)로 옮겨져야 한다(#190).
    expect(document.activeElement).toBe(escapeHatch);

    // 티켓 탭 → 기본 복귀, 헤더·툴바 재노출.
    await user.click(screen.getByRole('button', { name: '기본 크기로 돌아가기' }));
    expect(screen.getByRole('button', { name: '편집 메뉴' })).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: '편집 도구' })).toBeTruthy();
  });
});
