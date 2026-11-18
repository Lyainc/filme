/**
 * #216 → #826 S2 회귀 테스트 — MobileEditorShell 빈 항목(ghost) 표시.
 *
 * Seed constraint-8: 정보 모드에서는 자동으로 켜지고, 사진 · 디자인 모드에서는 편집 메뉴의 '빈 항목 표시' 스위치를
 * 따른다(기본 꺼짐, D03 A). 필드 입력 중 강제 켬은 inPlaceFieldEditor 테스트가 잠그고, 전체 보기 · 결과에서는 항상 끈다
 * (resultGhostOff).
 *
 * 빈 항목이 켜졌다는 신호는 시드 문서에서 비어 있는 '출연' 필드의 탭 타깃('출연 편집')이 티켓에 있는지다.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          photo.handleImageUpload('blob:test-poster');
          photo.updateMovieInfo({ title: 'TITLE0', theater: 'CGV0' });
        }}
      >
        seed-poster
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

afterEach(cleanup);

const emptyFieldTapTarget = () => screen.queryByRole('button', { name: '출연 편집' });

describe('MobileEditorShell 빈 항목 표시 (#216 → #826 S2)', () => {
  test('메뉴 스위치 "빈 항목 표시"는 기본 꺼짐이고 클릭으로 켜고 끈다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('seed-poster'));

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    const sw = () => screen.getByRole('switch', { name: '빈 항목 표시' });
    expect(sw().getAttribute('aria-checked')).toBe('false');

    await user.click(sw());
    expect(sw().getAttribute('aria-checked')).toBe('true');

    await user.click(sw());
    expect(sw().getAttribute('aria-checked')).toBe('false');
  });

  test('정보 모드는 스위치와 무관하게 자동 on, 디자인 · 사진 모드는 스위치를 따른다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('seed-poster'));

    // 정보 모드(첫 진입 기본) — 스위치는 꺼져 있어도 빈 필드 탭 타깃이 선다.
    expect(screen.getByRole('tab', { name: /^정보/ }).getAttribute('aria-selected')).toBe('true');
    expect(emptyFieldTapTarget() === null).toBe(false);

    // 디자인 · 사진 모드 — 스위치 꺼짐이면 없다.
    await user.click(screen.getByRole('tab', { name: '디자인' }));
    expect(emptyFieldTapTarget() === null).toBe(true);
    await user.click(screen.getByRole('tab', { name: '사진' }));
    expect(emptyFieldTapTarget() === null).toBe(true);

    // 스위치를 켜면 사진 · 디자인 모드에서도 선다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('switch', { name: '빈 항목 표시' }));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(emptyFieldTapTarget() === null).toBe(false);
    await user.click(screen.getByRole('tab', { name: '디자인' }));
    expect(emptyFieldTapTarget() === null).toBe(false);
  });
});
