/**
 * 랜딩 히어로 auto-scroll 갤러리의 `prefers-reduced-motion` 폴백(#615 완료조건 3).
 *
 * `useMatchMedia`(src/hooks/useMatchMedia.ts)는 `window.matchMedia(query).matches`를 이펙트에서
 * 읽으므로, `window.matchMedia`를 stub해 reduce 상태를 강제한 뒤 트랙(marquee) 대신 줄바꿈
 * 3열 격자가 렌더되는지 확인한다(#826 S5 constraint-6 → S9 constraint-6) — 자동 전환 · 진행 막대가 없고,
 * 카드 탭은 고르기이며, 오버레이가 걷힐 때도 전환이 없다.
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

describe('랜딩 무드 전시 동작 줄이기 (#615 → #826 S5 → S9)', () => {
  const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

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
      expect(labels()).toEqual(GALLERY_LAYOUTS.map((l) => l.label));
      const before = gallery.innerHTML;
      advance(8000);
      // 아무것도 움직이지 않는다 — 자리 스타일 · 순서가 그대로다.
      expect(gallery.innerHTML === before).toBe(true);
      expect(screen.queryByTestId('mood-gallery-beam') === null).toBe(true);
      expect(screen.queryByTestId('mood-gallery-index') === null).toBe(true);
      expect(screen.queryByRole('button', { name: /자동 전시/ }) === null).toBe(true);
      expect(screen.queryByTestId('mood-gallery-progress') === null).toBe(true);
    } finally {
      jest.useRealTimers();
      restore();
    }
  });

  // 삭제: '격자 모드의 안내는 격자 스크롤 영역 밖에 뜬다' — 전시 아래 안내 자리(landing-notice)가 S9에서 없어졌다
  // (안내는 첨부 시트 행으로, landingOcrNotice.test.tsx). 대신 격자의 고르기 계약(S9 constraint-6)을 잠근다.
  test('격자는 처음 첫 카드(미니멀)가 골라져 있고, 탭은 고르기만 한다(랜딩 그대로 · 재단 표시 하나)', () => {
    const restore = stubReducedMotion(true);
    try {
      render(<Harness />);
      const gallery = within(landing()).getByTestId('mood-gallery');
      const pressed = () =>
        within(gallery).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label'));
      expect(pressed()).toEqual([GALLERY_LAYOUTS[0].label]);
      expect(within(gallery).getAllByTestId('mood-crop-marks').length).toBe(1);
      fireEvent.click(within(gallery).getByRole('button', { name: GALLERY_LAYOUTS[3].label }));
      expect(pressed()).toEqual([GALLERY_LAYOUTS[3].label]);
      const marks = within(gallery).getAllByTestId('mood-crop-marks');
      expect(marks.length).toBe(1);
      expect(marks[0].closest('button')?.getAttribute('aria-label')).toBe(GALLERY_LAYOUTS[3].label);
      expect(landing().classList.contains('hidden')).toBe(false);
    } finally {
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

describe('동작 줄이기 격자의 실시간 반영 (S9 constraint-10, requirement-gap 1라운드)', () => {
  test('시트가 열리고 실시간 티켓이 오면 격자의 고른 칸에 선다 — 예외 없음', async () => {
    const restore = stubReducedMotion(true);
    try {
      // Landing만 렌더한다 — 시트 · 실시간 티켓은 셸이 주는 prop이라 여기선 직접 넣는다.
      const { Landing } = require('@/components/v2/Landing') as typeof import('@/components/v2/Landing');
      const noop = () => {};
      render(
        <Landing
          mode="overlay"
          onRestore={noop}
          restoreTitle=""
          onDirect={noop}
          onOpenSheet={noop}
          sheet={{ screenshot: { kind: 'done' }, posterThumb: null, canMake: true }}
          onPickScreenshot={noop}
          onPickPoster={noop}
          onMake={noop}
          onCloseSheet={noop}
          livePreview={<div data-testid="live-ticket" />}
        >
          <span />
        </Landing>,
      );
      const gallery = within(landing()).getByTestId('mood-gallery');
      expect(gallery.getAttribute('aria-label')).toBe('무드 전시(동작 줄이기)');
      const live = within(gallery).queryByTestId('live-ticket');
      expect(!!live).toBe(true);
      // 실시간 티켓은 고른 칸(aria-pressed true) 안에 하나뿐이다.
      expect(within(gallery).getAllByTestId('live-ticket').length).toBe(1);
      const cell = live!.closest('button');
      expect(cell?.getAttribute('aria-pressed')).toBe('true');
    } finally {
      restore();
    }
  });
});
