/**
 * #214 회귀 테스트 — MobileEditorShell 프리뷰 2단 줌 모드(기본/전체 보기).
 * #328로 max를 "모든 UX를 숨기고 티켓만 풀스크린" 모드로 재정의.
 * #356으로 줌 pill(ZoomSegment)을 제거 — 진입은 플로팅 툴바였고, #826 S2에서 상단 줄의 '전체 보기' 버튼이 이어받았다.
 * max 탈출은 티켓 탭 복귀 그대로다(COPY_TONE_GUIDE의 잠긴 문구 표가 이 개명을 기록한다).
 *
 * 프리뷰는 croppedImageUrl이 있을 때만 렌더되므로, 하네스에 포스터 업로드 버튼을 두고
 * 테스트가 먼저 눌러 seed한다(실제 usePhototicket.handleImageUpload 경로). 검증:
 * 전체 보기 버튼 → 상단 줄·OCR을 숨기고 티켓 탭으로만 기본 복귀 가능.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
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

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(cleanup);

describe('MobileEditorShell 줌 모드 (#214/#328/#356/#826 S2)', () => {
  test('포스터 seed 후: 줌 pill 없이 상단 줄에 전체 보기 버튼이 있고, 떠 있는 툴바는 없다', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 랜딩이 떠 있는 동안엔 상단 줄이 없다(프리뷰도 없다) — 직접 입력으로 편집에 들어와 포스터를 올린다.
    expect(screen.queryByRole('button', { name: '전체 보기' }) === null).toBe(true);
    await user.click(screen.getByTestId('landing-skip-poster'));
    await user.click(screen.getByText('seed-poster'));

    // 줌 pill(ZoomSegment)과 플로팅 툴바는 제거됐다.
    expect(screen.queryByRole('group', { name: '미리보기 크기' }) === null).toBe(true);
    expect(screen.queryByRole('toolbar', { name: '편집 도구' }) === null).toBe(true);
    expect((screen.getByRole('button', { name: '전체 보기' }) as HTMLButtonElement).disabled).toBe(false);
  });

  test('전체 보기(#328): 상단 줄·OCR을 숨기고 티켓만 남기며, 티켓 탭으로만 기본 복귀한다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId('landing-skip-poster')); // 상단 줄은 랜딩을 떠난 뒤에 선다(#826 S2)
    await user.click(screen.getByText('seed-poster'));

    expect(screen.getByRole('button', { name: '편집 메뉴' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '전체 보기' }));

    // 진입 후: 상단 줄이 사라지고, 티켓 탭(기본 복귀) 핸들만 남는다.
    expect(screen.queryByRole('button', { name: '편집 메뉴' }) === null).toBe(true);
    expect(screen.queryByRole('button', { name: '전체 보기' }) === null).toBe(true);
    const escapeHatch = screen.getByRole('button', { name: '기본 크기로 돌아가기' });
    // 진입 버튼이 있던 상단 줄이 언마운트돼 포커스가 body로 떨어지면 키보드 사용자가 복귀
    // 수단을 잃는다 — 포커스는 유일한 탈출구(티켓 래퍼)로 옮겨져야 한다(#190).
    expect(document.activeElement).toBe(escapeHatch);

    // 티켓 탭 → 기본 복귀, 상단 줄 재노출.
    await user.click(screen.getByRole('button', { name: '기본 크기로 돌아가기' }));
    expect(screen.getByRole('button', { name: '편집 메뉴' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '전체 보기' })).toBeTruthy();
  });
});
