/**
 * 랜딩 무드 전시 탭 타깃(#615 → #826 S5 L-01) — WCAG 2.2 SC 2.5.8(AA, 24×24).
 *
 * 카드 크기는 이제 px 상수가 아니라 **전시 폭 대비 %**다(마스터 `.c-gal .main` 52% · `.peek` 34%, 격자는 3열).
 * happy-dom엔 레이아웃이 없어 px를 못 재므로, 선언된 %를 이 앱이 서는 가장 좁은 프레임 폭(320px)에 곱해
 * 하한을 잰다 — 실제 렌더 비(0.52 · 0.34)는 measure-chrome.mjs `landing` 축이 400×675에서 잰다.
 *
 * **모든 카드가 같은 세로 비율(960/1534)로 선다** — 가로 캔버스가 섞이면 같은 폭에서 높이만 62%로 주저앉아
 * 리듬이 깨졌다(2026-08-08 사용자 피드백). 35mm 와이드는 전시에서 빠졌고, 에디토리얼은 90° 돌려 세운다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { GALLERY_LAYOUTS } from '@/components/v2/Landing';
import { mobileShellProps } from './shellHarness';
import { MIN_AA, assertNoShrink } from './tapTargets';

/** 이 앱이 서는 가장 좁은 프레임 폭(iPhone SE 1세대 · 320 CSS px). */
const NARROWEST_FRAME_PX = 320;

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const landing = () => screen.getByTestId('landing');

/** __tests__/landingReducedMotion.test.tsx와 동일 — 로직은 파일마다 복제하는 게 이 레포 관례다
 *  (shellHarness.ts 주석: DRY는 반복되는 props 뼈대에만, 로직·렌더 구조는 숨기지 않는다). */
function stubReducedMotion(matches: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('랜딩 무드 전시 탭 타깃 (#615 → #826 S5, WCAG 2.2 SC 2.5.8 AA)', () => {
  const cards = () =>
    Array.from(within(landing()).getByTestId('mood-gallery').querySelectorAll('button[data-index]')) as HTMLElement[];

  test('전시 카드가 가장 좁은 프레임에서도 24px 하한을 넘고, 전부 같은 세로 비율로 선다', () => {
    render(<Harness />);
    const buttons = cards();
    expect(buttons.length).toBe(GALLERY_LAYOUTS.length);
    for (const button of buttons) {
      const label = button.getAttribute('aria-label') ?? '';
      assertNoShrink(button, label);
      const width = button.style.width;
      expect(width.endsWith('%')).toBe(true);
      // 좌우 카드(34%)가 가장 작다 — 320px 프레임에서 108.8px.
      expect((parseFloat(width) / 100) * NARROWEST_FRAME_PX).toBeGreaterThanOrEqual(MIN_AA);
      expect(button.style.aspectRatio.replace(/\s/g, '')).toBe('960/1534');
    }
  });

  test('가로 캔버스 무드는 전시에서 빠지거나(35mm 와이드) 돌려 세운다(에디토리얼)', () => {
    render(<Harness />);
    const labels = cards().map((b) => (b.getAttribute('aria-label') ?? '').split(' 무드로')[0]);
    expect(labels).not.toContain('35mm 와이드');
    expect(labels).toContain('에디토리얼');
    const editorial = cards().find((b) => (b.getAttribute('aria-label') ?? '').startsWith('에디토리얼 무드로'))!;
    const inner = editorial.querySelector('img')!.parentElement as HTMLElement;
    expect(inner.style.transform).toContain('rotate(90deg)');
  });

  test('카드가 한 벌뿐이라 접근성 트리에 죽은 복제가 없다', () => {
    render(<Harness />);
    const gallery = within(landing()).getByTestId('mood-gallery');
    expect(gallery.querySelectorAll('button[aria-hidden="true"]')).toHaveLength(0);
    expect(gallery.querySelectorAll('button[tabindex="-1"]')).toHaveLength(0);
    expect(within(gallery).getAllByRole('button')).toHaveLength(GALLERY_LAYOUTS.length);
  });

  test('동작 줄이기 격자 카드도 24px 하한을 넘는다 — 3열이 가장 좁은 프레임에서도 칸마다 24px 이상', () => {
    const restore = stubReducedMotion(true);
    try {
      render(<Harness />);
      const gallery = within(landing()).getByTestId('mood-gallery');
      expect(gallery.className).toContain('grid-cols-3');
      expect(gallery.className).toContain('gap-3');
      expect(gallery.className).toContain('px-4');
      // 320 − 좌우 패딩 32 − 칸 사이 12×2 = 264 → 칸당 88px.
      expect((NARROWEST_FRAME_PX - 32 - 24) / 3).toBeGreaterThanOrEqual(MIN_AA);
      const buttons = cards();
      expect(buttons.length).toBe(GALLERY_LAYOUTS.length);
      for (const button of buttons) {
        assertNoShrink(button, button.getAttribute('aria-label') ?? '');
        expect(button.className).toContain('w-full');
      }
    } finally {
      restore();
    }
  });
});
