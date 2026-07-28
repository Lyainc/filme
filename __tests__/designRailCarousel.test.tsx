/**
 * #502 회귀 테스트 — DesignRail 아이콘 행의 중앙정렬 캐러셀 전환.
 *
 * 클릭 토글(#217/#218, designRail.test.tsx)과는 별개 입력 경로: 스크롤/스와이프만으로도
 * 중앙에 가장 가까운 아이콘이 활성화되고(패널이 닫혀 있어도 열림), 활성 아이콘은
 * scrollIntoView(inline: 'center')로 화면 중앙에 고정된다.
 *
 * #564에서 판정 시점이 "매 scroll 이벤트"에서 **스크롤 정지(120ms 디바운스)**로 바뀌었다 —
 * 그래서 fireEvent.scroll 직후가 아니라 waitFor로 정지 후 상태를 본다. 반대로 "일어나면 안
 * 되는 것"(클릭 가드)은 waitFor로 표현이 안 되므로 타이머가 확실히 지난 뒤 한 번 단언한다.
 *
 * happy-dom의 getBoundingClientRect는 항상 {0,0,0,0}이라(floatingToolbar.test.tsx 선례와
 * 동일 제약) Element.prototype을 WeakMap 스텁으로 오버라이드해 rail 컨테이너·각 아이콘의
 * 위치를 모킹한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';

function RailHarness() {
  const photo = usePhototicket();
  return <DesignRail photo={photo} />;
}

const nativeGetBoundingClientRect = Element.prototype.getBoundingClientRect;
let rects: WeakMap<Element, DOMRect>;

function stubRect(el: Element, partial: Partial<DOMRect>) {
  rects.set(el, {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
    ...partial,
  } as DOMRect);
}

// rail 컨테이너는 폭 300(중앙 x=150) 고정. 각 아이콘은 폭 40이라 그 중심 x가 150에 가장
// 가까운 쪽이 "중앙에 온" 아이콘이다.
function centerRailOn(rail: Element, id: string) {
  stubRect(rail, { left: 0, width: 300 });
  const buttons = rail.querySelectorAll('[data-rail-id]');
  buttons.forEach((btn) => {
    const isTarget = btn.getAttribute('data-rail-id') === id;
    // 타깃은 중앙(left=130→center 150), 나머지는 화면 밖으로 멀찍이 치워둔다.
    stubRect(btn, isTarget ? { left: 130, width: 40 } : { left: 800, width: 40 });
  });
}

beforeEach(() => {
  window.localStorage.clear();
  rects = new WeakMap();
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return rects.get(this) ?? nativeGetBoundingClientRect.call(this);
  };
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  Element.prototype.getBoundingClientRect = nativeGetBoundingClientRect;
});

describe('DesignRail 캐러셀 전환 (#502)', () => {
  test('패널이 닫힌 상태에서도 스크롤만으로 중앙 아이콘이 열린다', async () => {
    render(<RailHarness />);
    const rail = screen.getByRole('button', { name: '무드' }).parentElement as HTMLElement;

    // 초기: 아무 것도 안 열림.
    expect(screen.getByRole('button', { name: '무드' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: '컬러' }).getAttribute('aria-expanded')).toBe('false');

    centerRailOn(rail, 'color');
    fireEvent.scroll(rail);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '컬러' }).getAttribute('aria-expanded')).toBe('true')
    );
    expect(screen.getByRole('button', { name: '무드' }).getAttribute('aria-expanded')).toBe('false');
  });

  test('스크롤로 다른 아이콘이 중앙에 오면 활성 모듈이 전환된다(배타 유지)', async () => {
    render(<RailHarness />);
    const rail = screen.getByRole('button', { name: '무드' }).parentElement as HTMLElement;

    centerRailOn(rail, 'texture');
    fireEvent.scroll(rail);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '후보정' }).getAttribute('aria-expanded')).toBe('true')
    );

    // 스와이프를 이어가 '투명도'가 중앙에 오면 '후보정'은 닫히고 '투명도'만 열린다.
    centerRailOn(rail, 'opacity');
    fireEvent.scroll(rail);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '투명도' }).getAttribute('aria-expanded')).toBe('true')
    );
    expect(screen.getByRole('button', { name: '후보정' }).getAttribute('aria-expanded')).toBe('false');
  });

  test('활성 모듈이 바뀌면 그 아이콘을 화면 중앙으로 당긴다(scrollIntoView center)', async () => {
    const calls: Array<ScrollIntoViewOptions | boolean | undefined> = [];
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, opts?: ScrollIntoViewOptions | boolean) {
      if (this.getAttribute('data-rail-id') === 'texture') calls.push(opts);
    };

    try {
      render(<RailHarness />);
      const rail = screen.getByRole('button', { name: '무드' }).parentElement as HTMLElement;

      centerRailOn(rail, 'texture');
      fireEvent.scroll(rail);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: '후보정' }).getAttribute('aria-expanded')).toBe('true')
      );
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0]).toMatchObject({ inline: 'center' });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  test('클릭 직후의 리센터 스크롤은 목적지를 가로채지 못한다 (claude-review P1)', async () => {
    render(<RailHarness />);
    const rail = screen.getByRole('button', { name: '무드' }).parentElement as HTMLElement;

    // 클릭으로 '크기'를 연다 — effect가 smooth scrollIntoView를 쏘는 자리.
    fireEvent.click(screen.getByRole('button', { name: '크기' }));
    expect(screen.getByRole('button', { name: '크기' }).getAttribute('aria-expanded')).toBe('true');

    // 그 애니메이션 도중 지나가는 아이콘이 중앙에 걸린 프레임 — 가드가 없으면 여기서
    // 활성 모듈이 '무드'로 리타깃되고, 스크롤이 멈추면 그대로 고정된다.
    centerRailOn(rail, 'mood');
    fireEvent.scroll(rail);
    // 디바운스(120ms)가 지나도 가드가 살아있어 리타깃이 일어나지 않는 것을 본다.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    expect(screen.getByRole('button', { name: '크기' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: '무드' }).getAttribute('aria-expanded')).toBe('false');
  });

  // 클릭 토글(배타·재클릭 닫힘) 자체의 회귀 커버리지는 designRail.test.tsx (a)가 이미 갖고
  // 있다 — 여기서는 캐러셀 고유 동작(스크롤 기반 전환·중앙 고정)만 다룬다.
});
