/**
 * #225 — DesktopStudioShell 2단 줌 모드(기본/최대화).
 * "실제 크기" 모드는 #311에서 제거(모바일과 동일 사유).
 *
 * 줌 세그먼트는 croppedImageUrl이 있을 때만 렌더되므로 하네스에 seed 버튼을 둔다. 검증:
 * 2모드 렌더 → 최대화 시 인스펙터(aside) 숨김("티켓 완성" CTA 소멸) → 기본 복귀 시 인스펙터 복귀.
 * 최대화에서 인스펙터를 숨겨도 세그먼트는 캔버스에 남아 복귀 가능.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesktopStudioShell } from '@/components/v2/DesktopStudioShell';
import { desktopShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <DesktopStudioShell {...desktopShellProps(photo, { disabledReason: null })} />
    </>
  );
}

afterEach(cleanup);

describe('DesktopStudioShell 줌 모드 (#225)', () => {
  test('세그먼트 렌더 → 최대화 시 인스펙터 숨김 → 기본 복귀', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // seed 전엔 줌 세그먼트가 없다.
    expect(screen.queryByRole('button', { name: '최대화' })).toBeNull();

    await user.click(screen.getByText('seed-poster'));

    const def = screen.getByRole('button', { name: '기본' });
    const max = screen.getByRole('button', { name: '최대화' });

    // 초기값 기본 + 인스펙터(footer CTA "티켓 완성") 보임.
    expect(def.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '티켓 완성' })).toBeDefined();

    // 최대화 → 인스펙터 숨김(CTA 소멸), 세그먼트는 캔버스에 남음.
    await user.click(max);
    expect(max.getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: '티켓 완성' })).toBeNull();
    expect(screen.getByRole('button', { name: '기본' })).toBeDefined();

    // 기본 복귀 → 인스펙터 재노출.
    await user.click(def);
    expect(def.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '티켓 완성' })).toBeDefined();
  });
});
