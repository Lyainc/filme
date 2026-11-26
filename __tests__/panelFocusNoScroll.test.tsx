/**
 * #826 S8 — 입력 패널의 ‹ › 전환이 새 입력에 스크롤 없는 포커스를 건다.
 *
 * iOS Simulator 27.0(iPhone 18 Pro) 실측: 키보드가 떠 있는 채 '다음 항목'으로 제목 → 원제로 넘어가면 새 입력의 autoFocus에
 * Safari가 문서를 176px 스크롤해, 프레임 기준 fixed 패널이 키보드 · 액세서리 바 뒤로 밀려났다. focus({ preventScroll: true })는
 * 그 스크롤만 막고 키보드는 둔다(같은 기기에서 plain 176 → preventScroll 0). happy-dom엔 스크롤이 없어 위치가 아니라
 * 포커스 호출의 옵션을 잠근다 — 기기 축은 scripts/ios-sim/run585.py fields의 noDocScroll · allPanelVisible이 잰다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { mobileShellProps } from './shellHarness';

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('입력 패널 포커스 — 스크롤 없음(#826 S8)', () => {
  test('정보 행으로 연 첫 입력과 ‹ › 로 넘어간 입력 전부가 preventScroll 포커스를 받는다', async () => {
    const calls: { label: string | null; preventScroll: boolean }[] = [];
    // spyOn이 아니라 기술자를 저장 · 복원한다 — 전체 실행에선 앞선 파일이 focus를 접근자로 바꿔 두어 spyOn이 거부한다
    // (docs/TESTING.md 6절: 실행 순서 의존은 단독 실행과 갈린다).
    const proto = HTMLElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'focus');
    const original = proto.focus;
    Object.defineProperty(proto, 'focus', {
      configurable: true,
      writable: true,
      value: function (this: HTMLElement, opts?: FocusOptions) {
        if (this.closest('[data-field-panel]') && /^(INPUT|TEXTAREA)$/.test(this.tagName)) {
          calls.push({ label: this.getAttribute('aria-label'), preventScroll: opts?.preventScroll === true });
        }
        return original.call(this, opts);
      },
    });
    try {
      render(<Harness />);
      fireEvent.click(screen.getByTestId('landing-skip-poster'));
      fireEvent.click(within(screen.getByTestId('dock-body')).getByRole('button', { name: /^제목 (?!티켓에 표시)/ }));
      await screen.findByRole('group', { name: '제목 입력' });
      const seen = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const field = document.querySelector('[data-field-panel]')?.getAttribute('data-field-panel') ?? '';
        if (seen.has(field)) break;
        seen.add(field);
        fireEvent.click(screen.getByRole('button', { name: '다음 항목' }));
      }
      // 순회가 실제로 여러 입력을 지났는지부터 — 아니면 아래 단언이 빈 목록에서 통과한다.
      expect(seen.size).toBeGreaterThan(5);
      expect(calls.length).toBeGreaterThan(5);
      expect(calls.filter((c) => !c.preventScroll)).toEqual([]);
    } finally {
      if (desc) Object.defineProperty(proto, 'focus', desc);
      else delete (proto as { focus?: unknown }).focus;
    }
  });
});
