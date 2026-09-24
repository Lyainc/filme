import { afterEach, expect, test } from 'bun:test';
import { themeScript } from '@/pages/_document';
import { STORAGE_KEY } from '@/hooks/usePhototicket';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('chrome-dark', 'theme-dark', 'has-draft');
});

test('old dark preference does not override the light UI or draft entry', () => {
  window.localStorage.setItem('phototicket:theme', 'dark');
  window.localStorage.setItem(STORAGE_KEY, '{}');
  document.documentElement.classList.add('theme-dark', 'chrome-dark');
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  document.head.appendChild(meta);
  try {
    new Function(themeScript)();
    expect(document.documentElement.classList.contains('theme-dark')).toBe(false);
    expect(document.documentElement.classList.contains('chrome-dark')).toBe(false);
    expect(document.documentElement.classList.contains('has-draft')).toBe(true);
    expect(meta.content).toBe('#fffcf7');
  } finally { meta.remove(); }
});
