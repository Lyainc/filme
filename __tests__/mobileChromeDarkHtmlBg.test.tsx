/**
 * #402→#415 회귀 테스트 — 모바일 셸 html 배경 동기화.
 *
 * .chrome-dark는 셸 내부 div 스코프라 documentElement(html) 자신의 배경(--bg)까진 CSS 변수
 * 상속이 안 닿는다(상속은 자손 방향으로만). MobileEditorShell이 theme를 그대로 따르게 되며(#415)
 * html의 기존 .theme-dark 동기화만으로 편집 셸과는 항상 맞아떨어져, showMobile 기준 무조건
 * forcing은 필요 없어졌다(오히려 라이트 테마에서 셸은 라이트인데 html만 다크가 되는 역전 회귀를
 * 만든다). documentElement.chrome-dark forcing은 여전히 다크인 ResultStage(#357, theme 무관)가
 * 떠 있을 때만 필요 — 라이트 테마에서 그 화면을 볼 때 iOS 탄성 스크롤·100dvh 재계산 순간 밝은
 * html 배경이 다크 크롬 위로 노출되는 걸 막는다(원 #402 재현 조건).
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

describe('모바일 셸 html 배경 동기화 (#402→#415)', () => {
  test('모바일 + 라이트 테마(기본): documentElement에 chrome-dark 미적용 — 셸도 라이트라 매치', () => {
    setViewportWidth(500);
    render(<Home />);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });

  test('모바일 + 다크 테마: documentElement에 theme-dark 적용(기존 테마 동기화, chrome-dark forcing 불필요)', () => {
    setViewportWidth(500);
    // _document.tsx의 FOUC 스크립트가 이미 얹어놨을 상태를 시뮬레이트 — Home의 mount effect가
    // 이 클래스를 읽어 theme state를 'dark'로 확정한다.
    document.documentElement.classList.add('theme-dark');
    render(<Home />);
    expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });

  test('데스크톱 렌더 시엔 documentElement에 chrome-dark 미적용', () => {
    setViewportWidth(1200);
    render(<Home />);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
  });
});
