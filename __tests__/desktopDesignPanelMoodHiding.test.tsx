/**
 * #523 PR #533 claude-review P1 반영 — DesktopDesignPanel의 filterItemsForMood 배선을
 * 직접 검증하는 상호작용 테스트가 없었다(DesignRail의 items prop만 이 목적으로 열려있었음).
 * DesignRail과 동일한 items prop 주입 방식으로 합성 항목을 사용해, appliesTo에서 벗어난 무드로
 * 전환하면 섹션 자체가 사라지고 값은 보존돼 무드 복귀 시 복원되는지 확인한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesktopDesignPanel } from '@/components/v2/DesktopDesignPanel';
import type { RailItem } from '@/components/v2/designRailItems';

const FAKE_ITEMS: RailItem[] = [
  {
    id: 'size',
    label: '전용 항목',
    eyebrow: 'Restricted',
    icon: null,
    appliesTo: ['minimal'],
    render: (photo) => (
      <input
        aria-label="전용 슬라이더"
        type="range"
        min={0.6}
        max={1.3}
        step={0.1}
        value={photo.state.components.chainScale ?? 1}
        onChange={(e) => photo.updateComponents({ chainScale: Number(e.target.value) })}
      />
    ),
  },
];

function PanelHarness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="layout">{photo.state.components.layout}</div>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'criterion' })}>
        criterion으로 전환
      </button>
      <button type="button" onClick={() => photo.updateComponents({ layout: 'minimal' })}>
        minimal로 전환
      </button>
      <DesktopDesignPanel photo={photo} items={FAKE_ITEMS} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DesktopDesignPanel 무드 전환 시 항목 숨김 (#523 AC2 배선 검증)', () => {
  test('숨겨진 항목은 섹션 자체가 사라지고, 값은 보존돼 무드 복귀 시 복원된다', async () => {
    const user = userEvent.setup();
    render(<PanelHarness />);

    // minimal에서는 appliesTo(['minimal'])를 통과해 섹션이 상시 노출된다.
    expect(screen.getByRole('region', { name: 'Restricted' })).not.toBeNull();
    fireEvent.change(screen.getByLabelText('전용 슬라이더'), { target: { value: '0.8' } });
    expect((screen.getByLabelText('전용 슬라이더') as HTMLInputElement).value).toBe('0.8');

    // 다른 무드로 전환 → 필터에서 탈락해 섹션 자체가 렌더 트리에서 빠진다(모바일과 달리 접힘
    // 애니메이션이 없는 상시 스택이라 콘텐츠도 즉시 사라진다).
    await user.click(screen.getByRole('button', { name: 'criterion으로 전환' }));
    expect(screen.getByTestId('layout').textContent).toBe('criterion');
    expect(screen.queryByRole('region', { name: 'Restricted' })).toBeNull();
    expect(screen.queryByLabelText('전용 슬라이더')).toBeNull();

    // minimal로 복귀 → 섹션 재노출, 값은 photo.state에 남아있던 그대로 복원.
    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    expect(screen.getByRole('region', { name: 'Restricted' })).not.toBeNull();
    expect((screen.getByLabelText('전용 슬라이더') as HTMLInputElement).value).toBe('0.8');
  });
});
