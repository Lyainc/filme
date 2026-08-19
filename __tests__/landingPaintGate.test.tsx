/**
 * #675 첫 페인트 게이트 — #727 c9로 **방향이 뒤집혔다.**
 *
 * #675는 "draft가 있으면 랜딩 오버레이를 숨긴다"(D7)를 첫 페인트에서 지키는 장치였다. #727이
 * 그 D7 자체를 뒤집어 랜딩을 상시 노출로 바꿨으므로, 같은 `has-draft` 스탬프가 이제 **복원 행
 * ("이어서 만들기")을 첫 페인트에 드러내는** 일을 한다. 오버레이를 숨기던 옛 규칙은 남아 있으면
 * 죽은 코드가 아니라 정면 충돌이라 삭제됐고, 아래 두 번째 테스트가 그 부재를 잠근다.
 *
 * 뒤집혀도 이유는 같다: 행의 근거인 draft 복원은 SSR 하이드레이션 불일치를 피하려 effect로 미룬
 * 것이고 #675가 그 지연을 299ms로 실측했다. React로 그리면 그 사이 행이 없다가 뒤늦게 끼어들어
 * 주 CTA가 아래로 밀리는데, 299ms면 이미 탭할 수 있는 시간이라 오탭이 난다.
 *
 * 이 게이트는 **세 파일이 동시에 맞아야** 성립한다(스크립트가 찍는 클래스 · CSS 규칙 · 걷는 쪽).
 * 아래 앞 세 테스트가 그 합의를, 나머지가 "걷어야 할 때 걷는가"를 잠근다 — 안 걷으면 없는 draft를
 * 가리키는 복원 진입점이 남는다.
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

  // 옛 규칙이 남아 있으면 #727이 뒤집은 명제와 정면으로 부딪힌다 — draft 있는 재방문자에게
  // 랜딩이 통째로 안 뜨고, 그건 이 작업이 없애려는 바로 그 상태다(c9).
  test('globals.css에 오버레이를 숨기던 옛 규칙이 없다 (#727 c9)', () => {
    const css = readFileSync('src/styles/globals.css', 'utf8');
    expect(css).not.toContain("html.has-draft [data-testid='landing'].fixed");
  });

  test('globals.css가 그 클래스로 복원 행을 드러낸다 — 규칙이 없으면 행이 영영 안 보인다', () => {
    const css = readFileSync('src/styles/globals.css', 'utf8');
    expect(css).toContain("[data-testid='landing-restore']");
    expect(css).toContain("html.has-draft [data-testid='landing-restore']");
  });

  // 세 파일이 문자열로만 맞아 있으면 testid가 바뀌는 흔한 리팩터에 규칙이 조용히 빗나간다
  // (fresh-context 리뷰). 랜딩이 오버레이로 뜨고 그 안에 그 testid가 실제로 있는지까지 잰다.
  test('랜딩이 오버레이로 뜨고 CSS 게이트가 잡는 복원 행을 실제로 담고 있다', () => {
    render(<Harness />);

    const landing = screen.getByTestId('landing');
    expect(landing.classList.contains('fixed')).toBe(true);
    expect(getComputedStyle(landing).display).not.toBe('none');
    expect(landing.contains(screen.getByTestId('landing-restore'))).toBe(true);
  });

  test('저장분이 있으면 게이트를 유지한다 — 복원 행이 계속 보여야 한다', async () => {
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

  test('초기화가 게이트를 걷는다 — 안 걷으면 지운 draft를 가리키는 복원 행이 남는다', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ movieInfo: { title: '인터스텔라' } }));
    armGate();

    const { result } = renderHook(() => usePhototicket());
    await waitFor(() => expect(result.current.draftRestored).toBe(true));

    act(() => result.current.clearDraft());

    expect(gateOn()).toBe(false);
    expect(result.current.draftRestored).toBe(false);
  });
});
