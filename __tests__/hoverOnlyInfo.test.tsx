/**
 * #706 회귀 — `title`에만 살던 정보를 화면에 둔다.
 *
 * 이 앱은 #607부터 데스크톱 진입자도 `PhoneFrame` 400px 규격으로 띄우고 주 입력이 터치라,
 * hover로만 뜨는 `title` 툴팁은 사실상 없는 채널이다. #677 톤 정비(PR #700)는 `title`을 정식
 * "문장 자리"로 인정하고 **문구**를 고쳤지만 노출 채널은 축이 아니었다 — 그래서 문구가 좋아진
 * 채로 여전히 hover 뒤에 있는 자리가 남았다.
 *
 * 여기서 잠그는 건 두 명제다.
 *  1. 비활성 사유·설명이 **화면 텍스트로** 존재한다 (터치 사용자에게 도달한다)
 *  2. 같은 문구가 `title`에 **복제되어 있지 않다** — 복제되면 한쪽만 고쳐져 갈린다
 *     (`docs/COPY_TONE_GUIDE.md` 축 3: "같은 문구가 두 호출부에 복제돼 있으면 그 복제부터 없앨 것")
 *
 * #826 S2에서 재크롭 행이 헤더 메뉴에서 도크 사진 모드의 포스터 행('자르기')으로 옮겨 갔고, 사유는 행 상태 줄
 * '원본 없음'이 지는 화면 텍스트다. 그 행의 단위 계약은 editorDockPhoto가, 이 파일은 셸이 원본 유무를 도크에
 * 정확히 넘기는 배선(원본 없음 → 자르기 비활성 + 화면 사유)을 잠근다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      {/* 크롭 파이프라인을 안 거치고 포스터만 심는다 — croppedImageUrl은 있는데 originalSrc가
          없는 상태가 정확히 '자르기 비활성'의 조건이다(IndexedDB 복원 재방문이 그 자리다). */}
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('자르기 비활성 사유 (#706 → #826 S2)', () => {
  test('원본이 없으면 사유가 사진 모드 포스터 행의 화면 텍스트로 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'seed' }));
    await user.click(screen.getByRole('tab', { name: '사진' }));

    const row = within(document.querySelector('[data-asset-row="포스터"]') as HTMLElement);
    expect(row.getByRole('button', { name: '자르기' }).hasAttribute('disabled')).toBe(true);
    // 핵심 — 사유가 DOM 텍스트로 존재한다(hover 없이 읽힌다).
    expect(row.getByText('원본 없음')).toBeTruthy();
  });

  test('같은 문구가 자르기 버튼의 title에 복제되어 있지 않다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'seed' }));
    await user.click(screen.getByRole('tab', { name: '사진' }));

    const row = within(document.querySelector('[data-asset-row="포스터"]') as HTMLElement);
    expect(row.getByRole('button', { name: '자르기' }).hasAttribute('title')).toBe(false);
  });

  test('포스터가 없으면 자르기 버튼도 사유 줄도 없다 — 죽은 컨트롤 금지', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: '사진' }));

    const row = within(document.querySelector('[data-asset-row="포스터"]') as HTMLElement);
    expect(row.queryByRole('button', { name: '자르기' }) === null).toBe(true);
    expect(row.queryByText('원본 없음') === null).toBe(true);
  });
});
