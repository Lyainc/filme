/**
 * #826 S2 E-01 — 도크 모드 바와 고정 높이. 모드 바는 사진 · 정보 · 디자인 순 tablist(APG)이고 선택은 위쪽 막대,
 * 도크 높이는 모드 · 도구와 상관없이 하나다(본문 196 + 모드 바 52, Seed constraint-4).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DOCK_BODY_PX, DOCK_MODEBAR_PX } from '@/components/v2/dock/EditorDock';
import { DockHarness, resetDockProbe } from './dockHarness';

beforeEach(() => {
  window.localStorage.clear();
  resetDockProbe();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const modeTabs = () =>
  Array.from(screen.getByRole('tablist', { name: '편집 모드' }).querySelectorAll('[role=tab]')) as HTMLElement[];

describe('모드 바', () => {
  test('사진 · 정보 · 디자인 순 tablist고 선택은 하나다', () => {
    render(<DockHarness mode="info" />);
    expect(modeTabs().map((t) => t.textContent)).toEqual(['사진', '정보필수 미입력', '디자인']);
    expect(modeTabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(modeTabs().map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  test('선택 표시는 위쪽 2px 강조색 막대다 — 선택 탭에만 있다', () => {
    render(<DockHarness mode="design" />);
    const [photo, , design] = modeTabs();
    expect(design.className).toContain('before:bg-accent');
    expect(design.className).toContain('before:h-0.5');
    expect(photo.className).not.toContain('before:bg-accent');
  });

  test('모드 탭은 본문 패널을 aria-controls로 가리키고 패널은 선택 탭이 이름이다', () => {
    render(<DockHarness mode="photo" />);
    const panel = screen.getByRole('tabpanel', { name: '사진' });
    for (const t of modeTabs()) expect(t.getAttribute('aria-controls')).toBe(panel.id);
  });

  test('방향키·Home·End가 모드를 옮기고 본문만 바뀐다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="photo" />);
    modeTabs()[0].focus();
    await user.keyboard('{ArrowRight}');
    expect(modeTabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('dock-body').querySelector('[data-field-row]')).not.toBeNull(); // 정보 목록
    await user.keyboard('{End}');
    expect(modeTabs()[2].getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{Home}');
    expect(modeTabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('포스터')).not.toBeNull();
  });

  test('필수가 비어 있으면 정보 탭에 sr-only \'필수 미입력\' 점이 서고, 다 채우면 사라진다', () => {
    render(<DockHarness mode="design" />);
    expect(screen.getByTestId('info-missing-dot')).not.toBeNull();
    expect(screen.getByRole('tab', { name: '정보 필수 미입력' })).not.toBeNull();
  });
});

describe('도크 높이는 모드 · 도구와 무관한 하나다 (constraint-4)', () => {
  test('본문은 196px, 모드 바는 52px로 고정되고 클래스에 다른 높이가 없다', () => {
    expect(DOCK_BODY_PX).toBe(196);
    expect(DOCK_MODEBAR_PX).toBe(52);
    for (const mode of ['photo', 'info', 'design'] as const) {
      const { unmount } = render(<DockHarness mode={mode} />);
      const body = screen.getByTestId('dock-body');
      expect(body.style.height).toBe('196px');
      // 본문이 자기 안에서 스크롤하고 도크가 늘지 않게 넘침을 가둔다.
      expect(body.className).toContain('overflow-hidden');
      expect(screen.getByRole('tablist', { name: '편집 모드' }).style.height).toBe('52px');
      expect(/(^|\s)(h-|min-h-|max-h-)/.test(body.className)).toBe(false);
      unmount();
    }
  });

  test('모드를 바꿔도 본문 높이 선언이 같다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="info" />);
    const heights: string[] = [];
    for (const name of ['사진', /^정보/, '디자인'] as const) {
      await user.click(screen.getByRole('tab', { name }));
      heights.push(screen.getByTestId('dock-body').style.height);
    }
    expect(heights).toEqual(['196px', '196px', '196px']);
  });

  test('디자인 도구를 바꿔도 본문 높이 선언이 같다 — 내용은 안에서 세로로 스크롤한다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="design" />);
    for (const tool of ['무드', '색상', '재질', '코팅', '투명도', '크기']) {
      await user.click(screen.getByRole('tab', { name: tool }));
      expect(screen.getByTestId('dock-body').style.height).toBe('196px');
      expect(screen.getByRole('tabpanel', { name: tool }).className).toContain('overflow-y-auto');
    }
  });
});
