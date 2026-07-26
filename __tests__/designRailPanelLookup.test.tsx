/**
 * #523 — 통합이 없앤/보존한 두 지점을 각각 고정한다. designRail.test.tsx (a)는 aria-expanded만
 * 보므로 아래 두 계약(패널 본문이 무엇을 그리는지)은 어디에도 안 걸려 있었다.
 *
 * (1) 무조건 final-else 제거 — 통합 전 삼항 체인은 `active`가 mood/color/texture/opacity 중
 *     아무것도 아니면 조용히 '크기' 패널을 그렸다(final `else`). 지금은 items.find로 명시 조회해
 *     못 찾으면 아무것도 안 그린다. 폴백(`?? items.at(-1)` 등)이 되살아나면 이 테스트가 깨진다.
 * (2) lastPopRef 붙듦은 *의도된 보존* — 닫는 애니메이션(grid-rows 0fr) 동안 직전 항목 본문이
 *     마운트된 채 inert로 남아야 한다(패널이 비면 높이가 점프한다). 통합 전과 동작이 같고,
 *     목록 기반 조회로 옮기면서 사라지지 않았음을 고정한다.
 *
 * 셋업은 designRailMoodHiding.test.tsx 미러 — 합성 RailItem을 items prop으로 주입한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import type { RailItem } from '@/components/v2/designRailItems';

// 'mood' id를 일부러 뺀 목록 — lastPopRef 기본값이 'mood'라, 마운트 직후 active는 이 목록에서
// 매칭되지 않는다. 통합 전이라면 final else가 마지막 항목('크기')을 그리던 자리.
const ITEMS_WITHOUT_MOOD: RailItem[] = [
  {
    id: 'color',
    label: '컬러',
    eyebrow: 'Color',
    icon: <span />,
    render: () => <div data-testid="body-color" />,
  },
  {
    id: 'size',
    label: '크기',
    eyebrow: 'Size',
    icon: <span />,
    render: () => <div data-testid="body-size" />,
  },
];

function RailHarness() {
  const photo = usePhototicket();
  return <DesignRail photo={photo} items={ITEMS_WITHOUT_MOOD} />;
}

// 패널의 접근성 이름 = 활성 항목의 eyebrow. 조회 실패 시 폴백 없이 ''(activeItem?.eyebrow ?? '').
const panelLabel = () => document.getElementById('design-rail-panel')?.getAttribute('aria-label');

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DesignRail 패널 본문 조회 (#523)', () => {
  test('매칭되는 항목이 없으면 패널이 아무 본문도 안 그린다 (final-else 폴백 부재)', () => {
    render(<RailHarness />);

    // 아이콘 행은 정상 — 목록 두 항목 다 서 있다(필터는 통과, 조회만 실패하는 상황).
    expect(screen.getByRole('button', { name: '컬러' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '크기' })).toBeTruthy();

    // 닫힌 패널: 어느 항목 본문도 DOM에 없다. 폴백이 있으면 마지막 항목('크기')이 그려진다.
    expect(screen.queryByTestId('body-color')).toBeNull();
    expect(screen.queryByTestId('body-size')).toBeNull();
    // eyebrow도 폴백 없이 빈 문자열.
    expect(panelLabel()).toBe('');
  });

  test('닫는 중에도 직전 항목 본문이 inert로 남는다 (lastPopRef 보존)', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    const color = screen.getByRole('button', { name: '컬러' });

    await user.click(color);
    const opened = screen.getByTestId('body-color');
    expect(opened.closest('[inert]')).toBeNull();
    expect(panelLabel()).toBe('Color');

    // 재클릭으로 닫기 → 본문은 마운트된 채 inert, eyebrow도 직전 항목 것을 유지한다.
    await user.click(color);
    expect(color.getAttribute('aria-expanded')).toBe('false');
    const closing = screen.getByTestId('body-color');
    expect(closing.closest('[inert]')).not.toBeNull();
    expect(panelLabel()).toBe('Color');
  });
});
