/**
 * #402 회귀 테스트 — 모바일 셸(#363 상시 다크) html 배경 동기화.
 *
 * .chrome-dark는 셸 내부 div 스코프라 documentElement(html) 자신의 배경(--bg)까진 CSS 변수
 * 상속이 안 닿는다(상속은 자손 방향으로만). showMobile일 때 index.tsx가 documentElement에도
 * chrome-dark를 얹지 않으면, 라이트 테마에서 html/body가 밝은 배경으로 남아 iOS 탄성 스크롤·
 * 100dvh 재계산 순간 다크 크롬 위로 노출된다(실기기 스크린샷으로 확인).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import Home from '@/pages/index';

function setViewportWidth(width: number) {
  window.innerWidth = width;
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('chrome-dark', 'theme-dark');
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove('chrome-dark', 'theme-dark');
});

describe('모바일 셸 html 배경 chrome-dark 동기화 (#402)', () => {
  test('모바일(showMobile) 렌더 시 documentElement에 chrome-dark 적용', () => {
    setViewportWidth(500);
    render(<Home />);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(true);
  });

  test('데스크톱 렌더 시엔 documentElement에 chrome-dark 미적용', () => {
    setViewportWidth(1200);
    render(<Home />);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });

  test('unmount(페이지 이동) 시 chrome-dark cleanup', () => {
    setViewportWidth(500);
    const { unmount } = render(<Home />);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(true);
    unmount();
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });
});
