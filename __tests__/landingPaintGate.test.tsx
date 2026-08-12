/**
 * #675 회귀 — draft 복원 재방문에서 랜딩 오버레이가 첫 페인트에 뜨지 않는다.
 *
 * 랜딩 표시 판정이 읽는 `draftRestored`는 localStorage 복원 effect에서 서고, 그 복원은 SSR
 * 하이드레이션 불일치를 피하려 일부러 effect로 미룬 것이다 — 그래서 서버 HTML은 항상 랜딩
 * 오버레이를 담고, 재방문자도 그게 페인트된 뒤 effect가 돌 때까지 오버레이를 본다(실측 299ms).
 * 해법은 테마 FOUC와 같은 자리다: `_document.tsx`의 blocking 스크립트가 draft를 보고 `has-draft`를
 * 찍고, globals.css가 그 동안만 오버레이를 숨긴다.
 *
 * 이 게이트는 **세 파일이 동시에 맞아야** 성립한다(스크립트가 찍는 클래스 · CSS 규칙 · 걷는 쪽).
 * 아래 첫 두 테스트가 그 합의를, 나머지가 "걷어야 할 때 걷는가"를 잠근다 — 안 걷으면 랜딩도
 * 캔버스도 없는 빈 셸에 갇히므로 플래시보다 나쁜 회귀다.
 */
import { readFileSync } from 'fs';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { STORAGE_KEY, usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { themeScript } from '@/pages/_document';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const gateOn = () => document.documentElement.classList.contains('has-draft');
const armGate = () => document.documentElement.classList.add('has-draft');

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('has-draft');
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove('has-draft');
});

describe('랜딩 첫 페인트 게이트 (#675)', () => {
  test('첫 페인트 스크립트가 draft 키를 읽어 has-draft를 찍는다', () => {
    expect(themeScript).toContain(JSON.stringify(STORAGE_KEY));
    expect(themeScript).toContain('has-draft');
  });

  test('globals.css가 그 클래스로 오버레이만 숨긴다 — 규칙이 없으면 게이트가 조용히 죽고, .fixed가 빠지면 inline 재방문자가 빈 셸을 본다', () => {
    const css = readFileSync('src/styles/globals.css', 'utf8');
    expect(css).toContain("html.has-draft [data-testid='landing'].fixed");
  });

  // 게이트는 셀렉터가 Landing의 오버레이 클래스(.fixed)에 붙어야 성립한다 — 세 파일이 문자열로만
  // 맞아 있으면 오버레이가 absolute로 바뀌는 흔한 리팩터에 규칙이 조용히 빗나간다(fresh-context 리뷰).
  test('오버레이 모드 랜딩이 실제로 .fixed를 단다 — CSS 게이트가 잡는 그 클래스다', () => {
    render(<Harness />);

    const landing = screen.getByTestId('landing');
    expect(landing.classList.contains('fixed')).toBe(true);
    expect(getComputedStyle(landing).display).not.toBe('none');
  });

  test('저장분이 있으면 게이트를 유지한다 — 복원된 세션은 랜딩을 자기 판정으로 숨긴다', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));
    armGate();

    const { result } = renderHook(() => usePhototicket());

    await waitFor(() => expect(result.current.draftRestored).toBe(true));
    expect(gateOn()).toBe(true);
  });

  test('저장분이 없으면 마운트가 게이트를 걷는다', async () => {
    armGate();

    const { result } = renderHook(() => usePhototicket());

    await waitFor(() => expect(gateOn()).toBe(false));
    expect(result.current.draftRestored).toBe(false);
  });

  test('손상된 저장분도 게이트를 걷는다 — 스크립트는 키의 존재만 봤고 복원은 실패했다', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{손상된 JSON');
    armGate();

    const { result } = renderHook(() => usePhototicket());

    await waitFor(() => expect(gateOn()).toBe(false));
    expect(result.current.draftRestored).toBe(false);
  });

  test('초기화가 게이트를 걷는다 — 안 걷으면 새 문서인데 랜딩이 영영 안 뜬다', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));
    armGate();

    const { result } = renderHook(() => usePhototicket());
    await waitFor(() => expect(result.current.draftRestored).toBe(true));

    act(() => result.current.clearDraft());

    expect(gateOn()).toBe(false);
    expect(result.current.draftRestored).toBe(false);
  });
});
