/**
 * #228 회귀 테스트 — 데스크톱 DESIGN 세로 스택 패널.
 *
 * (a) 5섹션(무드/후보정/컬러/투명도/크기)이 상시(아코디언 아님) 렌더 — 피커 5종이 동시에 존재.
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
  test('(a) 4섹션(무드/후보정/컬러/투명도) 상시 렌더 — LayoutPicker/TexturePicker(재질×코팅 2축)/ColorPicker/BrightnessSlider 동시 존재', () => {
    render(<PanelHarness />);
    // 아코디언이 아니라 세로 스택 — 넷 다 한 번에 보인다(designRail은 한 번에 하나만).
    expect(screen.queryByRole('group', { name: 'Mood designs' })).not.toBeNull();
    // #475 — Texture 섹션이 재질×코팅 2축 radiogroup으로 갈린다.
    expect(screen.queryByRole('radiogroup', { name: '재질' })).not.toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '코팅' })).not.toBeNull();
    expect(screen.queryByLabelText('Hex color')).not.toBeNull();
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

  // #229 — 컬러가 eyebrow "Color"를 접근성 이름으로 갖는 region 섹션이고, 잉크는 별도 축 없이
  // 단일 themeColor(White/Black 프리셋 = 라이트/다크 원터치)라는 걸 확정.
  test('(c) 컬러 섹션 = 라벨 "Color" region + 잉크 단일축(White/Black 프리셋)', () => {
    render(<PanelHarness />);
    const region = screen.getByRole('region', { name: 'Color' });
    // ColorPicker(단일 themeColor 축)가 이 region 안에 — Hex 입력 + White/Black 원터치.
    expect(region.querySelector('[aria-label="Hex color"]')).not.toBeNull();
    expect(region.querySelector('[aria-label="White"]')).not.toBeNull();
    expect(region.querySelector('[aria-label="Black"]')).not.toBeNull();
  });

  // #230 — 투명도가 라벨 "Opacity" region이고, 포스터·컴포넌트 듀얼 슬라이더(기존 상태 재사용)를 담는다.
  test('(d) 투명도 섹션 = 라벨 "Opacity" region + 포스터·컴포넌트 듀얼 슬라이더', () => {
    render(<PanelHarness />);
    const region = screen.getByRole('region', { name: 'Opacity' });
    expect(region.querySelector('#desktop-poster-opacity')).not.toBeNull();
    expect(region.querySelector('#desktop-component-opacity')).not.toBeNull();
  });

  // #441 PR #485 P2 후속 — 체인/포맷 로고 크기가 라벨-기능 불일치 지적으로 Opacity에서 분리된
  // 별도 "Size" region.
  test('(e) 크기 섹션 = 라벨 "Size" region + 체인·포맷 로고 크기 슬라이더, Opacity엔 더 이상 없음', () => {
    render(<PanelHarness />);
    const sizeRegion = screen.getByRole('region', { name: 'Size' });
    expect(sizeRegion.querySelector('#desktop-chain-scale')).not.toBeNull();
    expect(sizeRegion.querySelector('#desktop-format-scale')).not.toBeNull();

    const opacityRegion = screen.getByRole('region', { name: 'Opacity' });
    expect(opacityRegion.querySelector('#desktop-chain-scale')).toBeNull();
    expect(opacityRegion.querySelector('#desktop-format-scale')).toBeNull();
  });
});
