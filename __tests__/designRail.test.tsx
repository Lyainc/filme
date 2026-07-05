/**
 * #217 회귀 테스트 — 모바일 디자인 레일(무드·후보정).
 *
 * (a) 아이콘 클릭 → 패널 disclosure 토글(aria-expanded), 한 번에 하나만 열림, 재클릭 시 닫힘.
 * (b) EditorCanvas hideRailSections=true면 Mood·Texture 섹션 미렌더(false/미전달이면 렌더).
 * (c) rail에서 무드를 고르면 photo.state.components.layout에 반영.
 *
 * 셋업은 mobileEditorShellGating.test.tsx 미러 — Harness가 usePhototicket()으로 실제 photo를
 * 만들고 컴포넌트에 그대로 넘긴다. 모듈 mock 없음(전역 누수 회피). photo 상태 관찰은
 * DOM에 값을 흘려(probe) queryByTestId로 읽는다. usePhototicket이 localStorage에 디바운스
 * 저장하므로 파일 내/간 격리를 위해 매 테스트 전후로 clear.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket } from '@/hooks/usePhototicket';
import { DesignRail } from '@/components/v2/DesignRail';
import { EditorCanvas } from '@/components/v2/EditorCanvas';

function RailHarness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="layout">{photo.state.components.layout}</div>
      <DesignRail photo={photo} />
    </>
  );
}

function EditorHarness({ hide }: { hide?: boolean }) {
  const photo = usePhototicket();
  return <EditorCanvas photo={photo} onPendingFetchChange={() => {}} hideRailSections={hide} />;
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
    await user.click(screen.getByRole('button', { name: '다음 무드' }));

    expect(screen.getByTestId('layout').textContent).not.toBe('minimal');
  });
});

describe('EditorCanvas hideRailSections (#217)', () => {
  // LayoutPicker 캐러셀(role=group "Mood designs")·TexturePicker(role=radiogroup "Texture")가
  // 곧 Mood·Texture 섹션의 존재 신호 — 이 둘만 hideRailSections로 사라져야 한다.
  test('true → Mood·Texture 섹션 미렌더', () => {
    render(<EditorHarness hide />);
    expect(screen.queryByRole('group', { name: 'Mood designs' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Texture' })).toBeNull();
  });

  test('미전달(기본 false) → Mood·Texture 섹션 렌더', () => {
    render(<EditorHarness />);
    expect(screen.queryByRole('group', { name: 'Mood designs' })).not.toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Texture' })).not.toBeNull();
  });
});
