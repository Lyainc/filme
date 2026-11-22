/**
 * 랜딩 히어로 auto-scroll 갤러리의 `prefers-reduced-motion` 폴백(#615 완료조건 3).
 *
 * `useMatchMedia`(src/hooks/useMatchMedia.ts)는 `window.matchMedia(query).matches`를 이펙트에서
 * 읽으므로, `window.matchMedia`를 stub해 reduce 상태를 강제한 뒤 트랙(marquee) 대신 줄바꿈
 * 3열 격자가 렌더되는지 확인한다(#826 S5 constraint-6 · acceptance-6) — 자동 전환 · 기둥 · 위치 표시가 없고,
 * 안내는 격자 스크롤 영역 밖에 뜨며, 오버레이가 걷힐 때도 전환이 없다.
 */
import { describe, expect, test, afterEach, beforeEach, jest } from 'bun:test';
import { render, screen, cleanup, within, act, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { GALLERY_LAYOUTS } from '@/components/v2/Landing';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const landing = () => screen.getByTestId('landing');

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

describe('랜딩 무드 전시 동작 줄이기 (#615 → #826 S5 L-01.2)', () => {
  const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
  const ocrInput = () => document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;

  test('reduce면 자동 전환 · 기둥 · 위치 표시 없이 5개를 3열 격자로 전부 보이고, 넘치면 전시 안에서만 스크롤한다', () => {
    const restore = stubReducedMotion(true);
    jest.useFakeTimers();
    try {
      render(<Harness />);
      const gallery = within(landing()).getByTestId('mood-gallery');
      expect(gallery.getAttribute('aria-label')).toBe('무드 전시(동작 줄이기)');
      expect(gallery.getAttribute('aria-roledescription') === null).toBe(true);
      expect(gallery.className).toContain('grid');
      expect(gallery.className).toContain('grid-cols-3');
      expect(gallery.className).toContain('overflow-y-auto');
      const labels = () => within(gallery).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
      expect(labels()).toEqual(GALLERY_LAYOUTS.map((l) => `${l.label} 무드로 바로 시작`));
      const before = gallery.innerHTML;
      advance(8000);
      // 아무것도 움직이지 않는다 — 자리 스타일 · 순서가 그대로다.
      expect(gallery.innerHTML === before).toBe(true);
      expect(screen.queryByTestId('mood-gallery-beam') === null).toBe(true);
      expect(screen.queryByTestId('mood-gallery-index') === null).toBe(true);
      expect(screen.queryByRole('button', { name: /자동 전시/ }) === null).toBe(true);
    } finally {
      jest.useRealTimers();
      restore();
    }
  });

  test('격자 모드의 안내는 격자 스크롤 영역 밖, 전시 아래 끝에 뜬다', () => {
    const restore = stubReducedMotion(true);
    jest.useFakeTimers();
    try {
      render(<Harness />);
      fireEvent.change(ocrInput(), { target: { files: [new File(['x'], 'ticket.heic', { type: 'image/heic' })] } });
      const notice = screen.getByTestId('landing-notice');
      expect(notice.textContent).toBe('HEIC는 지원하지 않아요');
      const gallery = within(landing()).getByTestId('mood-gallery');
      expect(gallery.contains(notice)).toBe(false);
      // 격자와 같은 전시 래퍼 안, 격자 다음 형제 — 래퍼 아래 끝에 absolute로 선다.
      expect(gallery.nextElementSibling === notice).toBe(true);
      expect(notice.className).toContain('absolute');
      expect(notice.className).toContain('bottom-1.5');
      advance(3000);
      expect(screen.queryByTestId('landing-notice') === null).toBe(true);
    } finally {
      jest.useRealTimers();
      restore();
    }
  });

  test('reduce면 오버레이가 걷힐 때 전환이 없다(즉시)', () => {
    const restore = stubReducedMotion(true);
    try {
      render(<Harness />);
      fireEvent.click(screen.getByTestId('landing-skip-poster'));
      expect(landing().style.transition).toBe('none');
      expect(landing().classList.contains('hidden')).toBe(true);
    } finally {
      restore();
    }
  });

  test('reduce가 아니면 기둥 위 캐러셀로 무드가 한 벌만 렌더된다', () => {
    const restore = stubReducedMotion(false);
    try {
      render(<Harness />);
      const gallery = within(landing()).getByTestId('mood-gallery');
      expect(gallery.className).toContain('overflow-hidden');
      expect(gallery.getAttribute('aria-roledescription')).toBe('carousel');
      expect(gallery.querySelectorAll('button').length).toBe(GALLERY_LAYOUTS.length);
    } finally {
      restore();
    }
  });
});
