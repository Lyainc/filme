/**
 * #217/#218 회귀 테스트 — 모바일 디자인 레일(무드·컬러·후보정).
 *
 * (a) 아이콘 클릭 → 패널 disclosure 토글(aria-expanded), 한 번에 하나만 열림, 재클릭 시 닫힘.
 * (c) rail에서 무드를 고르면 photo.state.components.layout에 반영.
 * (d) 컬러 아이콘 클릭 → 컬러 패널 열림, 무드·후보정과 배타(#218).
 *
 * 셋업은 mobileEditorShellGating.test.tsx 미러 — Harness가 usePhototicket()으로 실제 photo를
 * 만들고 컴포넌트에 그대로 넘긴다. 모듈 mock 없음(전역 누수 회피). photo 상태 관찰은
 * DOM에 값을 흘려(probe) queryByTestId로 읽는다. usePhototicket이 localStorage에 디바운스
 * 저장하므로 파일 내/간 격리를 위해 매 테스트 전후로 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';

function RailHarness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="layout">{photo.state.components.layout}</div>
      <div data-testid="componentOpacity">{photo.state.components.componentOpacity}</div>
      <div data-testid="themeColor">{photo.state.components.themeColor}</div>
      <DesignRail photo={photo} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DesignRail (#217)', () => {
  test('(a) 아이콘 클릭 → 패널 토글 · 한 번에 하나 · 재클릭 닫힘', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    const mood = screen.getByRole('button', { name: '무드' });
    const texture = screen.getByRole('button', { name: '후보정' });

    // 초기: 둘 다 닫힘
    expect(mood.getAttribute('aria-expanded')).toBe('false');
    expect(texture.getAttribute('aria-expanded')).toBe('false');

    // 무드 열기
    await user.click(mood);
    expect(mood.getAttribute('aria-expanded')).toBe('true');
    expect(texture.getAttribute('aria-expanded')).toBe('false');

    // 후보정 열기 → 무드 닫힘(한 번에 하나)
    await user.click(texture);
    expect(mood.getAttribute('aria-expanded')).toBe('false');
    expect(texture.getAttribute('aria-expanded')).toBe('true');

    // 후보정 재클릭 → 닫힘
    await user.click(texture);
    expect(texture.getAttribute('aria-expanded')).toBe('false');
  });

  test('(c) rail에서 무드 선택 → photo.state.components.layout 반영', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    expect(screen.getByTestId('layout').textContent).toBe('minimal');

    await user.click(screen.getByRole('button', { name: '무드' })); // 패널 열기(닫힘 땐 inert)
    // 스트립(#262 갭2): 캐러셀 화살표 대신 무드 카드를 직접 탭. 캡션으로 카드 특정.
    await user.click(screen.getByRole('radio', { name: /크라이테리언/ }));

    expect(screen.getByTestId('layout').textContent).toBe('criterion');
  });

  test('(c2) 스트립: 선택된 무드 카드만 aria-checked (#262 갭2)', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    await user.click(screen.getByRole('button', { name: '무드' }));

    const minimal = screen.getByRole('radio', { name: /미니멀 시네마틱/ });
    const criterion = screen.getByRole('radio', { name: /크라이테리언/ });
    expect(minimal.getAttribute('aria-checked')).toBe('true'); // 기본값
    expect(criterion.getAttribute('aria-checked')).toBe('false');

    await user.click(criterion);
    expect(criterion.getAttribute('aria-checked')).toBe('true');
    expect(minimal.getAttribute('aria-checked')).toBe('false');
  });

  test('(d) 컬러 아이콘 클릭 → 컬러 패널 열림 · 무드/후보정과 배타 (#218)', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    const mood = screen.getByRole('button', { name: '무드' });
    const color = screen.getByRole('button', { name: '컬러' });
    const texture = screen.getByRole('button', { name: '후보정' });

    // 컬러 열기 → ColorPicker 노출
    await user.click(color);
    expect(color.getAttribute('aria-expanded')).toBe('true');
    expect(mood.getAttribute('aria-expanded')).toBe('false');
    expect(texture.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Ink · logo & type color')).not.toBeNull();

    // 무드 열기 → 컬러 닫힘(한 번에 하나)
    await user.click(mood);
    expect(mood.getAttribute('aria-expanded')).toBe('true');
    expect(color.getAttribute('aria-expanded')).toBe('false');
  });

  test('(e) 투명도 아이콘 클릭 → 듀얼 슬라이더 패널 열림 · 무드와 배타 (#219)', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    const mood = screen.getByRole('button', { name: '무드' });
    const opacity = screen.getByRole('button', { name: '투명도' });

    await user.click(opacity);
    expect(opacity.getAttribute('aria-expanded')).toBe('true');
    expect(mood.getAttribute('aria-expanded')).toBe('false');
    // 포스터·컴포넌트 듀얼 슬라이더 노출
    expect(screen.getByLabelText('포스터')).not.toBeNull();
    expect(screen.getByLabelText('컴포넌트')).not.toBeNull();

    // 무드 열기 → 투명도 닫힘(한 번에 하나)
    await user.click(mood);
    expect(mood.getAttribute('aria-expanded')).toBe('true');
    expect(opacity.getAttribute('aria-expanded')).toBe('false');
  });

  test('(f) 컴포넌트 슬라이더 변경 → components.componentOpacity 반영 (#219)', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    expect(screen.getByTestId('componentOpacity').textContent).toBe('1');

    await user.click(screen.getByRole('button', { name: '투명도' }));
    fireEvent.change(screen.getByLabelText('컴포넌트'), { target: { value: '0.5' } });

    expect(screen.getByTestId('componentOpacity').textContent).toBe('0.5');
  });

  // #262 갭1 — 잉크 원탭 토글(2a 레일 5번째 버튼). 컬러 패널 안 열고 라이트↔다크 즉시 전환.
  test('(g) 잉크 토글 → themeColor 라이트(#FFFFFF)↔다크(#000000) 즉시 전환', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    // 기본 잉크 = 라이트(#FFFFFF)
    expect(screen.getByTestId('themeColor').textContent).toBe('#FFFFFF');

    const ink = screen.getByRole('button', { name: /잉크 색상 전환/ });
    await user.click(ink);
    expect(screen.getByTestId('themeColor').textContent).toBe('#000000');
    await user.click(ink);
    expect(screen.getByTestId('themeColor').textContent).toBe('#FFFFFF');
  });

  test('(h) 잉크 토글은 disclosure가 아니다 — 패널을 열지 않음', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    const mood = screen.getByRole('button', { name: '무드' });
    const ink = screen.getByRole('button', { name: /잉크 색상 전환/ });

    // 잉크 토글엔 aria-expanded/aria-controls가 없다(패널 disclosure 아님)
    expect(ink.getAttribute('aria-expanded')).toBeNull();
    expect(ink.getAttribute('aria-controls')).toBeNull();

    // 잉크를 눌러도 어떤 패널도 안 열림
    await user.click(ink);
    expect(mood.getAttribute('aria-expanded')).toBe('false');
  });

  test('(i) 35mm 무드에선 잉크 토글 disabled — 톤 고정(ColorPicker와 동일 조건)', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    // 무드 패널 열고 35mm 카드 직접 탭(캡션 '35mm 임프린트'로 특정 — '35mm Wide'와 구분)
    await user.click(screen.getByRole('button', { name: '무드' }));
    await user.click(screen.getByRole('radio', { name: /35mm 임프린트/ }));
    expect(screen.getByTestId('layout').textContent).toBe('35mm');

    const ink = screen.getByRole('button', { name: /잉크 색상 전환/ }) as HTMLButtonElement;
    expect(ink.disabled).toBe(true);
  });
});
