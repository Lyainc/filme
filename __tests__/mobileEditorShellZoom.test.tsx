/**
 * #214 회귀 테스트 — MobileEditorShell 프리뷰 2단 줌 모드(기본/최대화).
 * #328로 max를 "모든 UX를 숨기고 티켓만 풀스크린" 모드로 재정의.
 * "실제 크기" 모드는 #311에서 제거(웹은 물리 DPI를 못 읽어 실측과 어긋나고, 보정 슬라이더도 UI
 * 비용 대비 이득이 적었음) — 최대화가 pinch-zoom 가능한 전체화면으로 그 니즈를 대신 커버한다.
 *
 * pill·프리뷰는 croppedImageUrl이 있을 때만 렌더되므로, 하네스에 포스터 업로드 버튼을 두고
 * 테스트가 먼저 눌러 seed한다(실제 usePhototicket.handleImageUpload 경로). 검증:
 * pill 위치·기본 pressed 상태 → 최대화는 헤더·pill·OCR을 숨기고 티켓 탭으로만 기본 복귀 가능.
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
  test('포스터 seed 후: pill이 프리뷰 아래 렌더되고 기본이 눌린 상태다', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    // seed 전엔 pill이 없다.
    expect(screen.queryByRole('group', { name: '미리보기 크기' })).toBeNull();

    await user.click(screen.getByText('seed-poster'));

    // pill(줌 group)이 프리뷰(온-티켓 포스터 탭 마커) 뒤에 온다 — #328: 포스터 아래→프리뷰 아래 재정의.
    const preview = container.querySelector('[data-poster-tap]');
    const zoomGroup = screen.getByRole('group', { name: '미리보기 크기' });
    expect(preview).toBeTruthy();
    expect(preview!.compareDocumentPosition(zoomGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const def = screen.getByRole('button', { name: '기본' });
    expect(def.getAttribute('aria-pressed')).toBe('true');
  });

  test('최대화(#328): 헤더·pill·OCR을 숨기고 티켓만 남기며, 티켓 탭으로만 기본 복귀한다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('seed-poster'));

    // 진입 전: 헤더 메뉴 버튼·pill·OCR 카드가 모두 보인다.
    expect(screen.getByRole('button', { name: '편집 메뉴' })).toBeTruthy();
    expect(screen.getByRole('group', { name: '미리보기 크기' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '최대화' }));

    // 진입 후: 헤더·pill이 사라지고, 티켓 탭(기본 복귀) 핸들만 남는다.
    expect(screen.queryByRole('button', { name: '편집 메뉴' })).toBeNull();
    expect(screen.queryByRole('group', { name: '미리보기 크기' })).toBeNull();
    expect(screen.getByRole('button', { name: '기본 크기로 돌아가기' })).toBeTruthy();

    // 티켓 탭 → 기본 복귀, 헤더·pill 재노출.
    await user.click(screen.getByRole('button', { name: '기본 크기로 돌아가기' }));
    expect(screen.getByRole('button', { name: '편집 메뉴' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '기본' }).getAttribute('aria-pressed')).toBe('true');
  });
});
