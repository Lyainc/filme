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
 * 2번이 이 테스트의 실제 값어치다. 1번만 잠그면 나중에 누가 "안전하게" title을 되살려도 안 깨진다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

const RECROP_BLOCKED = '포스터 원본이 없어요. 포스터를 다시 업로드해 주세요.';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      {/* 크롭 파이프라인을 안 거치고 포스터만 심는다 — croppedImageUrl은 있는데 originalSrc가
          없는 상태가 정확히 '재크롭 비활성'의 조건이다(IndexedDB 복원 재방문이 그 자리다). */}
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

describe('재크롭 비활성 사유 (#706)', () => {
  test('원본이 없으면 사유가 메뉴 안 화면 텍스트로 뜬다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'seed' }));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    const recrop = screen.getByRole('button', { name: '재크롭' });
    expect(recrop.hasAttribute('disabled')).toBe(true);
    // 핵심 — 사유가 DOM 텍스트로 존재한다(hover 없이 읽힌다).
    expect(screen.getByText(RECROP_BLOCKED)).toBeTruthy();
  });

  test('같은 문구가 재크롭 행의 title에 복제되어 있지 않다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'seed' }));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    // MenuRow는 title이 없으면 라벨로 폴백한다(`title ?? ariaLabel ?? label`) — 사유가 아니라
    // 라벨이 들어 있어야 복제가 없다는 뜻이다.
    expect(screen.getByRole('button', { name: '재크롭' }).getAttribute('title')).toBe('재크롭');
  });

  test('포스터가 없으면 사유 줄 자체가 안 뜬다 — 재크롭 행이 없는 상태다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    expect(screen.queryByRole('button', { name: '재크롭' })).toBeNull();
    expect(screen.queryByText(RECROP_BLOCKED)).toBeNull();
  });
});
