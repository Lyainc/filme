/**
 * 랜딩 히어로 auto-scroll 갤러리 탭 타깃(#615, 2026-08-04 개정) — WCAG 2.2 SC 2.5.8(AA, 24×24).
 *
 * `__tests__/tapTargets.ts`(#508 → #500·#553)의 클래스 파싱 판정기를 그대로 재사용한다.
 * 버튼 자신이 아니라 **안쪽 카드 div**를 잰다 — 버튼은 눌림 피드백(`active:scale-[0.97]`,
 * PrimaryCta·OcrUploadCard와 동일 패턴)을 들고 있어 tapTargets.ts의 변형 금지 정규식
 * (`\S+:(?:h|w|size|scale|max-[hw])-`)에 그대로 걸리므로, 크기 선언은 그 클래스가 없는
 * 자식이 대신 진다(LayoutStrip/TexturePicker가 스와치만 재고 바깥 버튼은 안 재는 것과 같은 분리,
 * Landing.tsx의 MoodAutoScrollGallery 컴포넌트 주석 참고).
 *
 * 카드는 라벨이 없어 TicketRenderer 하나가 전부라, 높이는 무드별 실제 캔버스 비율로 갈린다 —
 * 세로 슬롯 4종(minimal·criterion·35mm·stub)과 가로 슬롯 2종(editorial·35mm-landscape)이
 * 다른 높이를 선언해야 정상이다(LAYOUTS의 width/height로 검증).
 *
 * 실제 렌더 px는 브라우저 실측 몫이다(measure-chrome.mjs).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { LAYOUTS } from '@/utils/layouts';
import { mobileShellProps } from './shellHarness';
import { assertNoShrink, expectMeetsAA } from './tapTargets';

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const landing = () => screen.getByTestId('landing');

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('랜딩 히어로 갤러리 탭 타깃 (#615, WCAG 2.2 SC 2.5.8 AA)', () => {
  test('무드 6종 샘플 카드가 24px 하한을 넘고, 무드별 실제 비율로 정확히 선언된다', () => {
    render(<Harness />);

    const gallery = within(landing()).getByTestId('mood-gallery');
    const buttons = Array.from(gallery.querySelectorAll('button'));
    // seamless loop를 위해 리스트가 두 벌(marquee 관용구) — 6무드 × 2.
    expect(buttons.length).toBe(12);

    for (const button of buttons) {
      const label = button.getAttribute('aria-label') ?? '';
      const layout = LAYOUTS.find((l) => label.startsWith(`${l.label} 무드로 바로 시작`));
      if (!layout) throw new Error(`aria-label에서 무드를 특정 못함: ${label}`);

      expect(button.getAttribute('data-touch')).toBe('140');
      const card = button.firstElementChild;
      if (!card) throw new Error('갤러리 버튼에 카드 div가 없다');
      for (const el of [card, ...Array.from(card.querySelectorAll('*'))]) {
        assertNoShrink(el, `갤러리 카드 ${label}`);
      }
      const { w, h } = expectMeetsAA(card, `갤러리 카드 ${label}`);
      expect(w).toBe(140);
      expect(h).toBeCloseTo((140 * layout.height) / layout.width, 5);
    }
  });

  test('seamless loop 뒤 절반은 접근성 트리·탭 순서에서 빠진다(fresh-context 리뷰 지적)', () => {
    render(<Harness />);

    const gallery = within(landing()).getByTestId('mood-gallery');
    // role 쿼리는 aria-hidden 서브트리를 기본으로 건너뛴다 — 시각적으로는 12개가 실재해도
    // 키보드·스크린리더 사용자에게는 6개(무드당 하나)만 보여야 정상이다.
    expect(within(gallery).getAllByRole('button')).toHaveLength(6);

    const hidden = Array.from(gallery.querySelectorAll('button[aria-hidden="true"]'));
    expect(hidden).toHaveLength(6);
    for (const button of hidden) {
      expect(button.getAttribute('tabindex')).toBe('-1');
    }
  });
});
