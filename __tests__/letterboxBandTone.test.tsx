/**
 * #461 회귀 테스트 — 상단 레터박스 밴드 톤 정합.
 *
 * #459(PR #460)는 선명 전경↔블러 배경의 "씸"(경계 하드 컷)을 페더로 없앴지만, Criterion/Minimal
 * 처럼 무드 시인성 스크림이 상하 비대칭(하단이 상단보다 훨씬 진함)이면 대칭 크기인 레터박스 밴드
 * 자체가 상단에서만 도드라져 보인다(#460 body 관찰). 스크림을 대칭화하는 대신 Poster가 실측한
 * 밴드 높이(onTopBandHeight)에만 별도 톤 정합 오버레이(TopBandTone)를 얹는 방식이 실제로 배선됐는지,
 * (1) Poster가 밴드 높이를 정확히 리포트하는지, (2) 무드가 그 높이·테마별 톤으로 오버레이를 실제로
 * 그리는지 두 층에서 검증한다. posterFeatherWiring.test.tsx와 동일한 happy-dom 스텁 기법(오프셋
 * 스텁 + FakeImage)을 공유한다.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { render, cleanup, act } from '@testing-library/react';
import { Poster, letterboxToneMatch } from '../src/components/moods/_shared';
import { posterContainRect } from '../src/utils/posterFeather';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import type { MovieInfo, TicketComponents } from '../src/types';

// 슬롯 960×1433(≈0.670) — posterFeatherWiring.test.tsx·posterFeather.test.ts와 동일 고정값 재사용.
const BOX_W = 960;
const BOX_H = 1433;
const NAT_ASPECT = 1200 / 1600; // 0.75 > 슬롯 0.670 → 상하 레터박스
const FRAME_INSET_Y = 22;
const EXPECTED_BAND_H = FRAME_INSET_Y + posterContainRect(BOX_W, BOX_H, NAT_ASPECT).insetY; // 98.5

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1200;
  naturalHeight = 1600;
  set src(_v: string) {
    queueMicrotask(() => this.onload?.());
  }
}

let origW: PropertyDescriptor | undefined;
let origH: PropertyDescriptor | undefined;
let origImage: typeof Image;

beforeEach(() => {
  origW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  origH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => BOX_W });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => BOX_H });
  origImage = globalThis.Image;
  (globalThis as { Image: unknown }).Image = FakeImage;
});

afterEach(() => {
  cleanup();
  if (origW) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origW);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth;
  if (origH) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origH);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
  (globalThis as { Image: unknown }).Image = origImage;
});

// 마운트 effect의 measure()는 observe 이전에 동기 실행되지만, natAspect(FakeImage onload)는
// 마이크로태스크라 한 박자 늦게 갱신된다 — posterFeatherWiring.test.tsx와 동일하게 두 틱 플러시.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('#461 Poster 배선 — onTopBandHeight가 밴드 실측 높이를 리포트한다', () => {
  test('contain + 중앙 정렬(레터박스 있음) → frameInsetY + insetY', async () => {
    const calls: number[] = [];
    await act(async () => {
      render(
        <Poster src="blob:x" fit="contain" frameInsetY={FRAME_INSET_Y} onTopBandHeight={(px) => calls.push(px)} />
      );
    });
    await flush();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[calls.length - 1]).toBeCloseTo(EXPECTED_BAND_H, 1);
  });

  test("contain + align='top' → 0(레터박스가 전부 하단에 몰려 상단 밴드 없음)", async () => {
    const calls: number[] = [];
    await act(async () => {
      render(
        <Poster src="blob:x" fit="contain" align="top" frameInsetY={FRAME_INSET_Y} onTopBandHeight={(px) => calls.push(px)} />
      );
    });
    await flush();
    expect(calls[calls.length - 1]).toBe(0);
  });

  test('cover → 0(전경이 슬롯을 꽉 채워 레터박스 없음)', async () => {
    const calls: number[] = [];
    await act(async () => {
      render(<Poster src="blob:x" fit="cover" onTopBandHeight={(px) => calls.push(px)} />);
    });
    await flush();
    expect(calls[calls.length - 1]).toBe(0);
  });
});

const MOVIE: MovieInfo = {
  title: 'TITLE', titleOg: 'ORIGINAL', releaseDate: '2026-05-01',
  releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '', isReissue: false, watchDate: '2026-05-03',
  watchDateFormat: 'kr-compact', watchTime: '20:30', theater: 'CGV',
  screen: 'IMAX', seat: 'G14', actors: 'Actor', rating: 4.5,
  runtime: '150 MIN', bookingNumber: 'BOOK-1234', signature: '@x',
};

const BASE: TicketComponents = {
  layout: 'minimal', chain: '', format: '', chainLabel: '', formatLabel: '',
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false, posterFit: 'contain',
};

function bandToneEl(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-letterbox-tone="true"]');
}

describe.each([
  ['criterion', MoodCriterion],
  ['minimal', MoodMinimal],
] as const)('#461 무드 배선 — %s 상단 밴드 톤 정합 오버레이', (_name, Mood) => {
  test('contain(레터박스 있음) → 실측 높이로 오버레이가 렌더된다', async () => {
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <Mood movieInfo={MOVIE} components={BASE} croppedImageUrl="blob:test" />
      ).container;
    });
    await flush();
    const el = bandToneEl(container);
    expect(el).not.toBeNull();
    expect(el!.style.height).toBe(`${EXPECTED_BAND_H}px`);
  });

  test('밝은 잉크(inkIsDark=false) → 검정 톤(rgba(0,0,0,0.5))', async () => {
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <Mood movieInfo={MOVIE} components={{ ...BASE, themeColor: '#FFFFFF' }} croppedImageUrl="blob:test" />
      ).container;
    });
    await flush();
    expect(bandToneEl(container)!.style.background).toContain(letterboxToneMatch(false));
  });

  test('어두운 잉크(inkIsDark=true) → 크림 톤(rgba(245,240,232,0.5))', async () => {
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <Mood movieInfo={MOVIE} components={{ ...BASE, themeColor: '#000000' }} croppedImageUrl="blob:test" />
      ).container;
    });
    await flush();
    expect(bandToneEl(container)!.style.background).toContain(letterboxToneMatch(true));
  });

  test("posterFit='cover' → 오버레이 없음(레터박스 자체가 없음)", async () => {
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <Mood movieInfo={MOVIE} components={{ ...BASE, posterFit: 'cover' }} croppedImageUrl="blob:test" />
      ).container;
    });
    await flush();
    expect(bandToneEl(container)).toBeNull();
  });
});

// 35mm-landscape는 frameInsetY를 안 쓰므로(자연 간극 의존, #461 goal) 밴드 높이가 insetY만이다
// (Criterion/Minimal의 FRAME_INSET_Y=22 가산 없음).
const EXPECTED_BAND_H_NO_INSET = posterContainRect(BOX_W, BOX_H, NAT_ASPECT).insetY;

describe('#461 무드 배선 — 35mm-landscape 상단 밴드 톤 정합 오버레이(톤 고정)', () => {
  test('contain(레터박스 있음) → 실측 높이로 오버레이가 렌더된다', async () => {
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <Mood35mmLandscape movieInfo={MOVIE} components={BASE} croppedImageUrl="blob:test" />
      ).container;
    });
    await flush();
    const el = bandToneEl(container);
    expect(el).not.toBeNull();
    expect(el!.style.height).toBe(`${EXPECTED_BAND_H_NO_INSET}px`);
  });

  // ink가 항상 밝은 FS_INK(크림) 고정이라 themeColor를 바꿔도 검정 톤(letterboxToneMatch(false))으로 고정.
  test('테마 무관 검정 톤 고정', async () => {
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <Mood35mmLandscape movieInfo={MOVIE} components={{ ...BASE, themeColor: '#000000' }} croppedImageUrl="blob:test" />
      ).container;
    });
    await flush();
    expect(bandToneEl(container)!.style.background).toContain(letterboxToneMatch(false));
  });

  test("posterFit='cover' → 오버레이 없음(레터박스 자체가 없음)", async () => {
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <Mood35mmLandscape movieInfo={MOVIE} components={{ ...BASE, posterFit: 'cover' }} croppedImageUrl="blob:test" />
      ).container;
    });
    await flush();
    expect(bandToneEl(container)).toBeNull();
  });
});
