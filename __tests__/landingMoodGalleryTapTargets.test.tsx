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
 * 카드는 라벨이 없어 TicketRenderer 하나가 전부다. **모든 카드가 같은 세로 비율(1534/960)로
 * 선다**는 게 2026-08-08 사용자 피드백으로 확정된 규칙이다 — 가로 캔버스가 섞이면 같은 폭에서
 * 높이만 62%로 주저앉아 줄의 리듬이 깨졌다. `35mm Wide`는 갤러리에서 빠졌고(`GALLERY_LAYOUTS`),
 * `editorial`은 남되 90° 돌려 세로로 선다. 그래서 이 테스트는 "무드별로 높이가 갈린다"가 아니라
 * 그 반대인 "전부 같은 비율"을 잠근다.
 *
 * 실제 렌더 px는 브라우저 실측 몫이다(measure-chrome.mjs).
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { render, screen, cleanup, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { GALLERY_LAYOUTS } from '@/components/v2/Landing';
import { getLayout } from '@/utils/layouts';
import { mobileShellProps } from './shellHarness';
import { assertNoShrink, expectMeetsAA } from './tapTargets';

/** 세로 무드의 캔버스 비율 — 갤러리 카드는 전부 이 비율로 선다(위 파일 주석). */
const PORTRAIT_RATIO = getLayout('minimal').height / getLayout('minimal').width;

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
  test('샘플 카드가 24px 하한을 넘고, 무드와 무관하게 전부 같은 세로 비율로 선다', () => {
    render(<Harness />);

    const gallery = within(landing()).getByTestId('mood-gallery');
    // data-touch가 붙은 건 무드 카드뿐이다(좌우 이동 버튼은 안 붙는다).
    const buttons = Array.from(gallery.querySelectorAll('button[data-touch]'));
    // 캐러셀은 카드 한 벌만 둔다 — marquee 시절의 복제 두 벌이 사라진 게 이 개편의 이득 중 하나다.
    expect(buttons.length).toBe(GALLERY_LAYOUTS.length);

    for (const button of buttons) {
      const label = button.getAttribute('aria-label') ?? '';
      const layout = GALLERY_LAYOUTS.find((l) => label.startsWith(`${l.label} 무드로 바로 시작`));
      if (!layout) throw new Error(`갤러리에 없어야 할 무드가 섰다: ${label}`);

      expect(button.getAttribute('data-touch')).toBe('140');
      const card = button.firstElementChild;
      if (!card) throw new Error('갤러리 버튼에 카드 div가 없다');
      for (const el of [card, ...Array.from(card.querySelectorAll('*'))]) {
        assertNoShrink(el, `갤러리 카드 ${label}`);
      }
      const { w, h } = expectMeetsAA(card, `갤러리 카드 ${label}`);
      expect(w).toBe(140);
      // 가로 캔버스(editorial)도 돌려 세우므로 여기서 갈리면 안 된다 — 갈리는 순간 그 무드만
      // 높이 62%로 주저앉아 줄의 리듬이 깨진다(2026-08-08 사용자 피드백).
      expect(h / w).toBeCloseTo(PORTRAIT_RATIO, 5);
    }
  });

  test('가로 캔버스 무드는 갤러리에서 빠지거나(35mm Wide) 돌려 세운다(editorial)', () => {
    render(<Harness />);

    const gallery = within(landing()).getByTestId('mood-gallery');
    const labels = Array.from(gallery.querySelectorAll('button')).map(
      (b) => (b.getAttribute('aria-label') ?? '').split(' 무드로')[0],
    );
    expect(labels).not.toContain('35mm Wide');
    expect(labels).toContain('Editorial');

    // editorial 카드 안쪽이 실제로 돌아가 있어야 한다 — 박스 비율만 세로면 내용은 가로인 채
    // 위아래가 잘린다. 회전은 인라인 transform이라 클래스가 아니라 style로 잰다.
    const editorial = Array.from(gallery.querySelectorAll('button')).find((b) =>
      (b.getAttribute('aria-label') ?? '').startsWith('Editorial 무드로'),
    )!;
    const inner = editorial.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.transform).toContain('rotate(90deg)');
  });

  test('카드가 한 벌뿐이라 접근성 트리에 죽은 복제가 없다', () => {
    render(<Harness />);

    const gallery = within(landing()).getByTestId('mood-gallery');
    // marquee 시절엔 복제 절반을 aria-hidden + tabIndex=-1로 빼는 처리가 필요했다. 캐러셀은
    // 애초에 한 벌뿐이라 그 예외가 없어야 정상이다 — 남아 있으면 처리가 덜 걷힌 것이다.
    expect(gallery.querySelectorAll('button[aria-hidden="true"]')).toHaveLength(0);
    expect(gallery.querySelectorAll('button[tabindex="-1"]')).toHaveLength(0);
    // 무드 카드 + 좌우 이동 버튼 둘.
    expect(within(gallery).getAllByRole('button')).toHaveLength(GALLERY_LAYOUTS.length + 2);
  });

  test('터치에서도 자동 전환을 멈출 수 있다 — 좌우 버튼이 hover 없는 유일한 수단이다 (SC 2.2.2)', () => {
    render(<Harness />);

    const gallery = within(landing()).getByTestId('mood-gallery');
    for (const side of ['prev', 'next']) {
      const btn = within(gallery).getByTestId(`mood-carousel-${side}`);
      // 44px 하한 — 같은 파일의 카드와 같은 기준(#646).
      expect(btn.className).toContain('min-h-touch');
      expect(btn.getAttribute('aria-label')).toMatch(/무드 보기$/);
    }
  });
});
