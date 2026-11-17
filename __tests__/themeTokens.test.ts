import { afterEach, describe, expect, test } from 'bun:test';
import { themeScript } from '@/pages/_document';
import { THEME_COLOR } from '@/constants/theme';
import { PR_COLORS, darkBlock, readVar, rootBlock } from './cssTokens';

// #826 S1 — 테마 3상태(명시 라이트 · 명시 다크 · 저장값 없음=시스템)가 토큰 층에서 맞게 풀리는지.
// 3상태 선택 UI는 S6이고, 판정은 지금처럼 _document의 FOUC 스크립트가 .theme-dark 클래스로 한다.

// 페이지 마스터 결정 10(D02-B, docs/826-page-master 9bcf558의 master.css)의 값. 코드와 마스터가 갈라지면 여기서 깨진다.
const MASTER = {
  light: { stage: '#EDEEEF', s1: '#F6F7F8', s2: '#FFFFFF', ink: '#121314', 'ink-2': '#55585D', 'ink-3': '#62666C', accent: '#A3182F', 'accent-ink': '#FFFFFF', warn: '#8F5410' },
  dark: { stage: '#0B0B0C', s1: '#141416', s2: '#1C1C1F', ink: '#ECECEE', 'ink-2': '#A7A9AE', 'ink-3': '#8E9196', accent: '#C8283F', 'accent-ink': '#FFFFFF', warn: '#E0A35A' },
} as const;

describe('globals.css --pr 블록', () => {
  for (const [theme, block] of [['light', rootBlock], ['dark', darkBlock]] as const) {
    test(`${theme}: 마스터 색 토큰을 빠짐없이 정의한다`, () => {
      const missing = PR_COLORS.filter((n) => readVar(block, `pr-${n}`) === null);
      expect(missing).toEqual([]);
    });
    test(`${theme}: 값이 마스터 결정 10과 같다`, () => {
      for (const [n, v] of Object.entries(MASTER[theme])) expect(`${n}=${readVar(block, `pr-${n}`)}`).toBe(`${n}=${v}`);
    });
    // 파생 토큰과 무드 별칭은 var()가 선언된 요소에서 풀리므로 다크(.chrome-dark 하위 포함)에도 다시 적어야 한다.
    test(`${theme}: 무드 전용 별칭 --accent는 var(--pr-accent)`, () => {
      expect(readVar(block, 'accent')).toBe('var(--pr-accent)');
    });
  }
});

describe('theme-color 상수 = --pr-stage', () => {
  test('라이트 · 다크', () => {
    expect(readVar(rootBlock, 'pr-stage')).toBe(THEME_COLOR.light);
    expect(readVar(darkBlock, 'pr-stage')).toBe(THEME_COLOR.dark);
  });
});

describe('FOUC 테마 스크립트 — 네 경우', () => {
  const realMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    localStorage.clear();
    document.documentElement.classList.remove('theme-dark', 'has-draft');
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  });

  function run(saved: 'light' | 'dark' | null, systemDark: boolean) {
    if (saved) localStorage.setItem('phototicket:theme', saved);
    window.matchMedia = ((q: string) => ({ matches: systemDark && q.includes('dark') })) as unknown as typeof window.matchMedia;
    new Function(themeScript)();
    return {
      dark: document.documentElement.classList.contains('theme-dark'),
      meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    };
  }

  test.each([
    ['저장값 light + 시스템 다크 → 라이트', 'light', true, false],
    ['저장값 dark + 시스템 라이트 → 다크', 'dark', false, true],
    ['저장값 없음 + 시스템 다크 → 다크', null, true, true],
    ['저장값 없음 + 시스템 라이트 → 라이트', null, false, false],
  ] as const)('%s', (_l, saved, systemDark, expectDark) => {
    const r = run(saved, systemDark);
    expect(r.dark).toBe(expectDark);
    expect(r.meta).toBe(expectDark ? THEME_COLOR.dark : THEME_COLOR.light);
  });
});
