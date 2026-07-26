/**
 * 구조 회귀 테스트 #491 — /t/[id] 공유 랜딩의 CTA가 진입 즉시 폴드 위에 서야 한다.
 *
 * happy-dom엔 레이아웃 엔진이 없어 "폴드 위인지" 자체는 여기서 못 잰다(실측은 실제 브라우저
 * 모바일 뷰포트에서 1회). 대신 폴드 위를 만든 **구조 결정 세 개**를 고정한다 — 티켓 높이 캡,
 * 그 캡을 무력화하는 w-full 부재, 축소된 세로 패딩·간격. 하나라도 되돌아가면 세로 예산
 * (헤더 56 + 패딩 + 티켓 + 간격 + CTA)이 다시 넘쳐 CTA가 스크롤 아래로 밀린다.
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/react';
import TicketLanding from '@/pages/t/[id]';

afterEach(() => cleanup());

function renderLanding() {
  return render(
    <TicketLanding
      imageUrl="https://blob.example/t/abc.jpg"
      title="인터스텔라"
      pageUrl="https://filme.app/t/abc"
      width={960}
      height={1534}
      ogImageUrl="https://blob.example/t/abc.og.jpg"
      ogDescription="《인터스텔라》 포토티켓 — made with FILME."
    />,
  );
}

/** `gap-6` `py-6` 같은 Tailwind 스케일 유틸에서 숫자만 뽑는다. 없으면 null. */
function scaleOf(className: string, prefix: string): number | null {
  const m = new RegExp(`(?:^|\\s)${prefix}-(\\d+)(?:\\s|$)`).exec(className);
  return m ? Number(m[1]) : null;
}

describe('공유 랜딩 세로 예산 (#491)', () => {
  test('히어로 래퍼 폭이 뷰포트 높이 예산에서 환산된다', () => {
    const { container } = renderLanding();
    const img = screen.getByAltText('인터스텔라 · 포토티켓') as HTMLImageElement;
    const wrapper = img.parentElement as HTMLElement;
    // 높이 예산 → 폭 상한 환산: calc(<N>vh * width / height). 티켓 비율이 반영돼야
    // 가로 무드에서 캡이 과하게 좁아지지 않는다.
    const cap = /calc\((\d+)vh\s*\*\s*(\d+)\s*\/\s*(\d+)\)/.exec(wrapper.style.maxWidth);
    expect(cap).not.toBeNull();
    // 45vh 기준. 50vh를 넘으면 세로 무드에서 CTA가 다시 폴드 아래로 밀린다.
    expect(Number(cap![1])).toBeLessThanOrEqual(50);
    expect([Number(cap![2]), Number(cap![3])]).toEqual([960, 1534]);
  });

  test('img는 w-full/h-auto 유지 — 폭이 auto면 #199 비율 예약이 죽어 CLS가 난다', () => {
    renderLanding();
    const img = screen.getByAltText('인터스텔라 · 포토티켓') as HTMLImageElement;
    const classes = img.className.split(/\s+/);
    expect(classes).toContain('w-full');
    expect(classes).toContain('h-auto');
    // max-h를 img에 직접 걸면 w-full과 충돌해 비율이 깨진다 — 캡은 래퍼 폭에만 있어야 한다.
    expect(img.className).not.toMatch(/max-h-/);
    expect(img.getAttribute('width')).toBe('960');
    expect(img.getAttribute('height')).toBe('1534');
  });

  test('main의 세로 패딩·요소 간격이 축소 예산 안에 있다', () => {
    const { container } = renderLanding();
    const main = container.querySelector('main')!;
    expect(scaleOf(main.className, 'py')).toBeLessThanOrEqual(6);
    expect(scaleOf(main.className, 'gap')).toBeLessThanOrEqual(6);
  });

  test('CTA는 슬림해지되 탭 타깃 하한(44px)은 지킨다', () => {
    renderLanding();
    const cta = screen.getByRole('link', { name: /나도 티켓 만들기/ });
    const minH = /min-h-\[(\d+)px\]/.exec(cta.className);
    expect(minH).not.toBeNull();
    expect(Number(minH![1])).toBeGreaterThanOrEqual(44);
    expect(Number(minH![1])).toBeLessThanOrEqual(48);
  });
});
