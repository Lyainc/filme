/**
 * #216 회귀 테스트 — MobileEditorShell 빈 항목 미리보기(ghost) 토글.
 *
 * 검증: 포스터 seed 후 토글 등장(기본 on) → 클릭이 aria-checked를 뒤집음 → 실제 크기 모드로 가면
 * 토글이 비활성(disabled) + aria-checked=false(ghost 강제 off) → 기본 복귀 시 이전 on 상태 회복.
 *
 * 토글은 헤더 서브메뉴 안(#315)이라 매번 메뉴를 열어 얻고, pill(줌 세그먼트)을 누르기 전엔 메뉴를
 * 닫는다 — 실제 브라우저는 메뉴가 열려 있으면 백드롭 오버레이가 pill 클릭 자체를 막고(claude-review
 * PR #332 P2 대응으로 pill 클릭이 메뉴를 자동으로 닫으므로), 메뉴가 열린 채로 pill을 누르는 경로는
 * 존재하지 않는다.
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

describe('MobileEditorShell ghost 토글 (#216)', () => {
  test('seed 후: 토글 on 기본 → 클릭으로 off/on → 실제 크기에서 강제 off + 비활성 → 복귀 시 회복', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // seed 전엔 토글이 없다(헤더 서브메뉴 안, #315).
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    expect(screen.queryByRole('switch', { name: '빈 항목 미리보기' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    await user.click(screen.getByText('seed-poster'));

    // #315: 토글은 헤더 서브메뉴 안으로 이전 — 메뉴를 열어야 보인다.
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    // 기본값 on.
    expect(screen.getByRole('switch', { name: '빈 항목 미리보기' }).getAttribute('aria-checked')).toBe('true');

    // 클릭 → off.
    await user.click(screen.getByRole('switch', { name: '빈 항목 미리보기' }));
    expect(screen.getByRole('switch', { name: '빈 항목 미리보기' }).getAttribute('aria-checked')).toBe('false');

    // 다시 클릭 → on.
    await user.click(screen.getByRole('switch', { name: '빈 항목 미리보기' }));
    expect(screen.getByRole('switch', { name: '빈 항목 미리보기' }).getAttribute('aria-checked')).toBe('true');

    // 메뉴를 닫아야 pill이 눌린다(#328 P2: pill 클릭이 메뉴를 자동으로 닫으므로, 열린 채로는
    // 실제 브라우저에서 백드롭 오버레이가 pill 클릭 자체를 막는다).
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    // 실제 크기 모드 → ghost 강제 off + 토글 비활성.
    await user.click(screen.getByRole('button', { name: '실제 크기' }));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    const toggleActual = screen.getByRole('switch', { name: '빈 항목 미리보기' });
    expect(toggleActual.getAttribute('aria-checked')).toBe('false');
    expect((toggleActual as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));

    // 기본 복귀 → ghostMode(on) 회복.
    await user.click(screen.getByRole('button', { name: '기본' }));
    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    const toggleDefault = screen.getByRole('switch', { name: '빈 항목 미리보기' });
    expect(toggleDefault.getAttribute('aria-checked')).toBe('true');
    expect((toggleDefault as HTMLButtonElement).disabled).toBe(false);
  });
});
