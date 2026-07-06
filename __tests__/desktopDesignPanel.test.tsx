/**
 * #228 회귀 테스트 — 데스크톱 DESIGN 세로 스택 패널.
 *
 * (a) 4섹션(무드/후보정/컬러/투명도)이 상시(아코디언 아님) 렌더 — 피커 4종이 동시에 존재.
 * (b) 무드 선택 → photo.state.components.layout 반영(setComp 콜백 배선).
 *
 * 셋업은 designRail.test.tsx 미러 — Harness가 usePhototicket()으로 실제 photo를 만들고
 * 컴포넌트에 넘긴다. 모듈 mock 없음(전역 누수 회피). photo 상태는 DOM probe로 관찰.
 * usePhototicket이 localStorage에 디바운스 저장하므로 매 테스트 전후로 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesktopDesignPanel } from '@/components/v2/DesktopDesignPanel';

function PanelHarness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="layout">{photo.state.components.layout}</div>
      <DesktopDesignPanel photo={photo} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DesktopDesignPanel (#228)', () => {
  test('(a) 4섹션 상시 렌더 — LayoutPicker/TexturePicker/ColorPicker/BrightnessSlider 동시 존재', () => {
    render(<PanelHarness />);
    // 아코디언이 아니라 세로 스택 — 넷 다 한 번에 보인다(designRail은 한 번에 하나만).
    expect(screen.queryByRole('group', { name: 'Mood designs' })).not.toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Texture' })).not.toBeNull();
    expect(screen.queryByText('Ink · logo & type color')).not.toBeNull();
    expect(screen.queryByLabelText('포스터')).not.toBeNull();
    expect(screen.queryByLabelText('컴포넌트')).not.toBeNull();
  });

  test('(b) 무드 선택 → photo.state.components.layout 반영 (setComp 배선)', async () => {
    const user = userEvent.setup();
    render(<PanelHarness />);
    expect(screen.getByTestId('layout').textContent).toBe('minimal');

    await user.click(screen.getByRole('button', { name: '다음 무드' }));

    expect(screen.getByTestId('layout').textContent).not.toBe('minimal');
  });

  // #229 — 컬러가 eyebrow "컬러"를 접근성 이름으로 갖는 region 섹션이고, 잉크는 별도 축 없이
  // 단일 themeColor(White/Black 프리셋 = 라이트/다크 원터치)라는 걸 확정.
  test('(c) 컬러 섹션 = 라벨 "컬러" region + 잉크 단일축(White/Black 프리셋)', () => {
    render(<PanelHarness />);
    const region = screen.getByRole('region', { name: '컬러' });
    expect(region.querySelector('*')).not.toBeNull();
    // ColorPicker(단일 themeColor 축)가 이 region 안에 — 잉크 헤더 + White/Black 원터치.
    expect(region.textContent).toContain('Ink · logo & type color');
    expect(region.querySelector('[aria-label="White"]')).not.toBeNull();
    expect(region.querySelector('[aria-label="Black"]')).not.toBeNull();
  });
});
