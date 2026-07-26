/**
 * #459 (PR #460 P1) — Poster의 CSS-mask 배선 상호작용 테스트. posterFeather.test.ts는 순수 기하만,
 * captureComposite.test.ts는 export(canvas)만 검증한다. 여기선 실제 Poster 컴포넌트가
 * ResizeObserver 측정(boxSize) + 자연 종횡비(natAspect)를 거쳐 전경 <img>의 style.maskImage까지
 * 잇는 배선을 검증한다 — 이게 없으면 measure 인자 실수·정렬 미반영 같은 배선 버그를 CI가 못 잡는다.
 *
 * happy-dom은 offsetWidth/Height=0, new Image() 미발화라 (1) 슬롯 크기와 (2) 포스터 자연 종횡비를
 * 스텁한다. 마운트 effect의 measure()는 observe 이전에 동기 실행되므로 ResizeObserver 콜백 발화와
 * 무관하게 초기값이 잡힌다(floatingToolbar.test.tsx와 동일 패턴).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { render, cleanup, act } from '@testing-library/react';
import { stubBox, stubImgNatural } from './setup/posterStubs';
import { Poster } from '../src/components/moods/_shared';

// 슬롯 960×1433(≈0.670) — 프레임 인셋 반영된 wrapper 근사.
const BOX_W = 960;
const BOX_H = 1433;

// 0.75 > 슬롯 0.670 → 상하 레터박스 → 세로 페더 대상.
const NAT_W = 1200;
const NAT_H = 1600;

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [stubBox(BOX_W, BOX_H), stubImgNatural(NAT_W, NAT_H)];
});

afterEach(() => {
  cleanup();
  restore.forEach((r) => r());
});

// 전경 포스터 <img>: data-role=poster지만 blur 배경(data-poster-bg)이 아닌 쪽.
function fgPoster(container: HTMLElement): HTMLImageElement | null {
  const imgs = Array.from(container.querySelectorAll('img[data-role="poster"]')) as HTMLImageElement[];
  return imgs.find((im) => !im.hasAttribute('data-poster-bg')) ?? null;
}

async function renderPoster(props: Parameters<typeof Poster>[0]) {
  let container!: HTMLElement;
  await act(async () => {
    container = render(<Poster {...props} />).container;
  });
  // natAspect(<img> 마운트 시 complete 체크) + boxSize effect가 반영되도록 플러시.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return container;
}

describe('#459 Poster 배선 — 전경 <img>에 페더 mask-image가 실제로 적용된다', () => {
  // happy-dom은 style.maskImage 속성엔 저장하지만 style '속성 문자열'엔 mask-image를 직렬화하지
  // 않는다(probe 확인). 배선 검증은 CSSStyleDeclaration 속성으로 읽는다.
  test('contain + 중앙 정렬(레터박스) → 전경 <img>에 linear-gradient mask 적용', async () => {
    const container = await renderPoster({ src: 'blob:x', fit: 'contain', frameInsetY: 22 });
    const fg = fgPoster(container);
    expect(fg).not.toBeNull();
    expect(fg!.style.maskImage).toContain('linear-gradient'); // 씸에 그라데이션 마스크 = 하드 컷 아님
    expect(fg!.style.maskImage).toContain('to bottom'); // 상하 레터박스 → 세로 페더
  });

  test("contain + align='top' → 마스크 없음(비대칭 레터박스에서 컨텐츠 잘림 방지, PR #460 P1)", async () => {
    const container = await renderPoster({ src: 'blob:x', fit: 'contain', align: 'top', frameInsetY: 22 });
    const fg = fgPoster(container);
    expect(fg).not.toBeNull();
    expect(fg!.style.maskImage || '').not.toContain('linear-gradient');
  });

  test('cover → 마스크 없음(전경이 슬롯을 꽉 채워 씸 없음)', async () => {
    const container = await renderPoster({ src: 'blob:x', fit: 'cover' });
    const fg = fgPoster(container);
    expect(fg).not.toBeNull();
    expect(fg!.style.maskImage || '').not.toContain('linear-gradient');
  });
});
