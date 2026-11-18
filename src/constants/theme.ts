/** 상태 막대 theme-color — globals.css의 --pr-stage(라이트 :root · 다크 .theme-dark)와 같아야 한다(#826 S1).
 * _document의 FOUC 스크립트와 useThemePreference가 이 한 곳에서 읽는다. 일치는 __tests__/themeTokens.test.ts가 잠근다. */
export const THEME_COLOR = { light: '#EDEEEF', dark: '#0B0B0C' } as const;

/** 테마 선호(#826 S2 D09) — 'system'은 저장값 없이 OS 설정을 따른다. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** 테마 선호 저장 키('light' · 'dark'만 저장, 없음 = 시스템) — useThemePreference와 _document의 첫 페인트 스크립트가 같은 값을 읽는다. */
export const THEME_STORAGE_KEY = 'phototicket:theme';
