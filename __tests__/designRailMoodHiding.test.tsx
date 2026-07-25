/**
 * #523 AC4 — 무드 전환 상호작용 테스트(합성 항목 기준). 실사용 5항목은 appliesTo로 실제 숨김이
 * 0건이라(색만 disabled 방식), DesignRail의 필터·자동 닫힘·값 보존을 exercise하려면 합성 항목이
 * 필요하다. DesignRail의 items prop(기본값 RAIL_ITEMS)에 가짜 항목 하나를 주입해 검증한다.
 *
 * 무드 변경은 레일의 '무드' 항목이 아니라 하네스의 외부 버튼으로 트리거한다 — 레일은 한 번에
 * 하나만 열리므로(#218), 숨겨질 항목의 패널이 열린 채로 다른 경로(예: 데스크톱 패널, 동기화된
 * 다른 화면)에서 무드가 바뀌는 실제 상황을 반영한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import type { RailItem } from '@/components/v2/designRailItems';

const FAKE_ITEMS: RailItem[] = [
  {
    id: 'size',
    label: '전용 항목',
    eyebrow: 'Restricted',
    icon: <span data-testid="icon-restricted" />,
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

function RailHarness() {
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
      <DesignRail photo={photo} items={FAKE_ITEMS} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DesignRail 무드 전환 시 항목 숨김 (#523 AC4)', () => {
  test('활성 항목이 숨겨지면 패널이 닫히고, 값은 보존돼 무드 복귀 시 복원된다', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);

    // minimal에서는 appliesTo(['minimal'])를 통과해 아이콘이 보인다.
    const icon = screen.getByRole('button', { name: '전용 항목' });
    await user.click(icon);
    expect(icon.getAttribute('aria-expanded')).toBe('true');

    // 슬라이더 값 변경 — chainScale에 반영.
    fireEvent.change(screen.getByLabelText('전용 슬라이더'), { target: { value: '0.8' } });
    expect((screen.getByLabelText('전용 슬라이더') as HTMLInputElement).value).toBe('0.8');

    // 다른 경로로 무드 전환(레일의 '무드' 항목을 거치지 않음) → 활성 항목이 필터에서 탈락.
    await user.click(screen.getByRole('button', { name: 'criterion으로 전환' }));
    expect(screen.getByTestId('layout').textContent).toBe('criterion');

    // 아이콘 자체가 사라짐(필터 통과 실패) + 패널이 닫힘(inert). pop 조정이 렌더 중 일어나므로
    // 무드 전환 클릭의 act() 안에서 동기로 반영된다 — waitFor 불필요.
    expect(screen.queryByRole('button', { name: '전용 항목' })).toBeNull();
    const slider = screen.getByLabelText('전용 슬라이더') as HTMLInputElement;
    expect(slider.closest('[inert]')).not.toBeNull();
    // 숨겨진 동안에도 값 자체는 안 건드림.
    expect(slider.value).toBe('0.8');

    // minimal로 복귀 → 아이콘 재노출, 값은 그대로 복원.
    await user.click(screen.getByRole('button', { name: 'minimal로 전환' }));
    const restoredIcon = screen.getByRole('button', { name: '전용 항목' });
    expect(restoredIcon.getAttribute('aria-expanded')).toBe('false');

    await user.click(restoredIcon);
    expect((screen.getByLabelText('전용 슬라이더') as HTMLInputElement).value).toBe('0.8');
  });
});
