/**
 * 랜딩 히어로 auto-scroll 갤러리의 `prefers-reduced-motion` 폴백(#615 완료조건 3).
 *
 * `useMatchMedia`(src/hooks/useMatchMedia.ts)는 `window.matchMedia(query).matches`를 이펙트에서
 * 읽으므로, `window.matchMedia`를 stub해 reduce 상태를 강제한 뒤 트랙(marquee) 대신 줄바꿈
 * 그리드가 렌더되는지 확인한다 — 코드 읽기로만 확인되고 자동 회귀가 없던 분기(fresh-context 리뷰
 * 지적)를 잠근다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, within } from '@testing-library/react';
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

describe('랜딩 히어로 갤러리 reduced-motion 폴백 (#615)', () => {
  test('reduce 활성화 시 캐러셀이 아니라 줄바꿈 그리드로 갤러리 무드가 한 번씩만 보인다', () => {
    const restore = stubReducedMotion(true);
    try {
      render(<Harness />);
      const gallery = within(landing()).getByTestId('mood-gallery');
      expect(gallery.className).toContain('flex-wrap');
      expect(gallery.className).not.toContain('overflow-hidden');
      // seamless loop 복제가 없어야 한다 — 그리드 폴백은 무드당 카드 하나.
      expect(gallery.querySelectorAll('button').length).toBe(GALLERY_LAYOUTS.length);
    } finally {
      restore();
    }
  });

  test('reduce 비활성화 시 캐러셀로 갤러리 무드가 한 벌만 렌더된다', () => {
    const restore = stubReducedMotion(false);
    try {
      render(<Harness />);
      const gallery = within(landing()).getByTestId('mood-gallery');
      expect(gallery.className).toContain('overflow-hidden');
      expect(gallery.querySelectorAll('button').length).toBe(GALLERY_LAYOUTS.length);
    } finally {
      restore();
    }
  });
});
