import { useCallback, useEffect, useState } from 'react';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { THEME_COLOR, THEME_STORAGE_KEY, type ThemePreference } from '@/constants/theme';

// 'light' · 'dark'만 저장하고, 저장값 없음 = 시스템. 키는 _document.tsx의 FOUC 스크립트와 공유한다.
export { THEME_STORAGE_KEY };

const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/**
 * 테마 3갈래(#826 S2 D09, acceptance-17) — 선호값은 시스템 · 라이트 · 다크이고, 실제로 칠하는 값(theme)은
 * 선호가 시스템일 때 OS 설정(prefers-color-scheme)으로 풀린다. OS 설정은 시스템 선호인 동안 바뀌는 대로 따라간다.
 * 라이트 · 다크는 localStorage에 쓰고, 시스템은 저장값을 지운다 — 옛 구현은 항상 저장해서 한 번 토글하면 OS를
 * 영영 안 따랐다.
 *
 * SSR 안전: 첫 렌더는 라이트이고 마운트 뒤에 저장값 · OS 설정을 읽는다. 첫 페인트의 클래스는 FOUC 스크립트가 이미
 * 맞춰 뒀으므로, 읽기가 끝나기 전엔 html 클래스 · theme-color를 건드리지 않는다.
 */
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  // 시스템 다크 질의는 useMatchMedia가 쥔다 — 첫 렌더 false, 마운트 뒤 OS 값, 이후 OS 변경을 따라간다.
  const systemDark = useMatchMedia(DARK_QUERY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPreferenceState(readStoredPreference());
    setReady(true);
  }, []);

  const theme: 'light' | 'dark' = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    if (!ready) return;
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('theme-dark', isDark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark ? THEME_COLOR.dark : THEME_COLOR.light);
  }, [theme, ready]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }, []);

  return { preference, theme, setPreference };
}
