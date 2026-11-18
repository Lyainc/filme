/**
 * #826 S2 acceptance-17 — 테마 3갈래(시스템 · 라이트 · 다크).
 *
 * 옛 index.tsx는 토글할 때마다 phototicket:theme을 항상 저장해서, 한 번 만지면 OS 설정을 영영 안 따랐다. 지금은
 *  - 라이트 · 다크는 저장하고, 시스템은 **저장값을 지운다**(_document FOUC 스크립트가 '저장값 없음 = 시스템'으로 읽는다),
 *  - 선호가 시스템인 동안 OS 설정(prefers-color-scheme)이 바뀌면 따라간다.
 * matchMedia는 happy-dom이 주는 값을 믿지 않고 스텁으로 갈아끼워 OS 쪽을 직접 움직인다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { useThemePreference, THEME_STORAGE_KEY } from '@/hooks/useThemePreference';
import { THEME_COLOR } from '@/constants/theme';

type Listener = (e: { matches: boolean }) => void;

function stubMatchMedia(initialDark: boolean) {
  const listeners = new Set<Listener>();
  let dark = initialDark;
  const mq = {
    get matches() {
      return dark;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  const real = window.matchMedia;
  window.matchMedia = (() => mq) as unknown as typeof window.matchMedia;
  return {
    setOsDark(next: boolean) {
      dark = next;
      listeners.forEach((l) => l({ matches: next }));
    },
    listenerCount: () => listeners.size,
    restore() {
      window.matchMedia = real;
    },
  };
}

function Probe() {
  const { preference, theme, setPreference } = useThemePreference();
  return (
    <>
      <div data-testid="pref">{preference}</div>
      <div data-testid="theme">{theme}</div>
      {(['system', 'light', 'dark'] as const).map((p) => (
        <button key={p} type="button" onClick={() => setPreference(p)}>
          pick-{p}
        </button>
      ))}
    </>
  );
}

const pref = () => screen.getByTestId('pref').textContent;
const theme = () => screen.getByTestId('theme').textContent;
const htmlDark = () => document.documentElement.classList.contains('theme-dark');
const themeColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');

let mm: ReturnType<typeof stubMatchMedia>;
let metaEl: HTMLMetaElement;

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('theme-dark');
  metaEl = document.createElement('meta');
  metaEl.setAttribute('name', 'theme-color');
  metaEl.setAttribute('content', '#EDEEEF');
  document.head.appendChild(metaEl);
});
afterEach(() => {
  cleanup();
  mm?.restore();
  metaEl.remove();
  window.localStorage.clear();
  document.documentElement.classList.remove('theme-dark');
});

describe('useThemePreference (#826 S2)', () => {
  test('저장값이 없으면 선호는 시스템이고 OS 설정을 따른다 — OS 다크면 다크', () => {
    mm = stubMatchMedia(true);
    render(<Probe />);
    expect(pref()).toBe('system');
    expect(theme()).toBe('dark');
    expect(htmlDark()).toBe(true);
    expect(themeColor()).toBe(THEME_COLOR.dark);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull(); // 마운트가 저장값을 만들지 않는다
  });

  test('저장값(light · dark)이 있으면 그 선호로 시작하고 OS 설정은 무시한다', () => {
    mm = stubMatchMedia(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<Probe />);
    expect(pref()).toBe('light');
    expect(theme()).toBe('light');
    expect(htmlDark()).toBe(false);
    expect(themeColor()).toBe(THEME_COLOR.light);
  });

  test('라이트 · 다크를 고르면 저장하고, 시스템을 고르면 저장값을 지운다', () => {
    mm = stubMatchMedia(false);
    render(<Probe />);

    fireEvent.click(screen.getByText('pick-dark'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(theme()).toBe('dark');
    expect(htmlDark()).toBe(true);

    fireEvent.click(screen.getByText('pick-light'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(htmlDark()).toBe(false);

    fireEvent.click(screen.getByText('pick-system'));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(pref()).toBe('system');
    expect(theme()).toBe('light'); // OS는 라이트
  });

  test('시스템인 동안 OS 설정 변화를 따라가고, 고정 선호일 땐 따라가지 않는다', () => {
    mm = stubMatchMedia(false);
    render(<Probe />);
    expect(theme()).toBe('light');

    act(() => mm.setOsDark(true));
    expect(theme()).toBe('dark');
    expect(htmlDark()).toBe(true);
    expect(themeColor()).toBe(THEME_COLOR.dark);

    fireEvent.click(screen.getByText('pick-light'));
    act(() => mm.setOsDark(false));
    act(() => mm.setOsDark(true));
    expect(theme()).toBe('light');

    // 다시 시스템 — 그 순간의 OS 값(다크)으로 풀린다.
    fireEvent.click(screen.getByText('pick-system'));
    expect(theme()).toBe('dark');
  });

  test('언마운트하면 OS 변화 구독을 거둔다', () => {
    mm = stubMatchMedia(false);
    const { unmount } = render(<Probe />);
    expect(mm.listenerCount()).toBe(1);
    unmount();
    expect(mm.listenerCount()).toBe(0);
  });
});
