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
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { CARD_H, GALLERY_LAYOUTS } from '@/components/v2/Landing';
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

describe('랜딩 무드 전시 탭 타깃 (#615 → #826 S5 → S9, WCAG 2.2 SC 2.5.8 AA)', () => {
  const cards = () =>
    Array.from(within(landing()).getByTestId('mood-gallery').querySelectorAll('button[data-index]')) as HTMLElement[];
  const nameOf = (b: HTMLElement) => b.getAttribute('aria-label') ?? '';

  // S9: 카드는 폭 %가 아니라 높이 식 CARD_H(전시 높이 · 폭 중 작은 쪽) + 세로 비율로 선다(Landing.tsx slotStyle).
  // happy-dom엔 레이아웃이 없어 px를 못 재므로 선언만 잠그고, 실제 rect(높이 0.85 · 간격 16px)는 measure-chrome.mjs landing 축이 잰다.
  test('전시 카드는 전부 같은 높이 선언 · 같은 세로 비율이고 축소 수단이 없다', () => {
    render(<Harness />);
    const buttons = cards();
    expect(buttons.length).toBe(GALLERY_LAYOUTS.length);
    // 높이 식은 전시 높이와 폭(엿보기 자리 112px를 뺀 폭의 세로 환산) 중 작은 쪽이다 — 세로로 긴 프레임에서 카드가 프레임
    // 폭을 넘지 않게(S9 헤드리스 캡처 2026-11-24). happy-dom은 min() · cq 단위를 버려 인라인 값을 못 읽으니 상수로 잠근다.
    expect(CARD_H).toBe('min(calc(100cqh - 44px), calc((100cqw - 112px) * 1534 / 960))');
    for (const button of buttons) {
      // 옆 카드는 의도된 0.82배 엿보기라 assertNoShrink(인라인 scale<1 금지)는 가운데 카드에만 건다 — 옆은 배율 하한만 잠근다.
      if (button.getAttribute('aria-pressed') === 'true') assertNoShrink(button, nameOf(button));
      else expect(Number(button.style.transform.match(/scale\(([\d.]+)\)/)![1])).toBeGreaterThanOrEqual(0.8);
      expect(button.style.aspectRatio.replace(/\s/g, '')).toBe('960/1534');
    }
  });

  test('가로 캔버스 무드는 전시에서 빠지거나(35mm 와이드) 돌려 세운다(에디토리얼)', () => {
    render(<Harness />);
    const labels = cards().map(nameOf);
    expect(labels).not.toContain('35mm 와이드');
    expect(labels).toContain('에디토리얼');
    const editorial = cards().find((b) => nameOf(b) === '에디토리얼')!;
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
        assertNoShrink(button, nameOf(button));
        expect(button.className).toContain('w-full');
      }
    } finally {
      restore();
    }
  });

  // S9 새 버튼 — 44px 하한(마스터 .c-btn 48, 이용 고지 min-h-touch). 클래스 선언으로 잰다(위 helper 관례).
  test('랜딩의 새 버튼(이용 고지 · 주 · 직접 입력)과 시트 버튼은 44px 이상이다', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: '이용 고지' }).className).toContain('min-h-touch');
    for (const id of ['landing-cta', 'landing-skip-poster']) {
      expect(screen.getByTestId(id).className).toContain('min-h-[48px]');
    }
    fireEvent.click(screen.getByTestId('landing-cta'));
    const sheet = screen.getByRole('dialog', { name: '티켓과 포스터' });
    expect(within(sheet).getByRole('button', { name: '닫기' }).className).toMatch(/h-touch/);
    expect(within(sheet).getByRole('button', { name: '닫기' }).className).toMatch(/w-touch/);
    for (const id of ['landing-sheet-screenshot', 'landing-sheet-poster']) {
      expect(screen.getByTestId(id).className).toContain('min-h-[64px]');
    }
    expect(screen.getByTestId('landing-sheet-make').className).toContain('min-h-[48px]');
  });
});
