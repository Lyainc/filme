/**
 * #526 ① 회귀 테스트 — Poster는 포스터를 두 번 디코드하지 않는다.
 *
 * 예전엔 `useNaturalAspect(src, fit === 'contain')`가 `new Image()`로 **전경 <img>와 같은 src**를
 * 한 번 더 로드해 naturalWidth/Height 두 숫자만 읽었다(마운트당 1회, 에디터 프리뷰와 결과 렌더러가
 * 따로 마운트되므로 최소 2회). 게다가 #527의 "꽉 채우기" 토글로 active 인자가 런타임에 뒤집히면서
 * cover→contain으로 되돌릴 때마다 재디코드가 한 번씩 더 붙었다. 지금은 그 값을 전경 <img>에서
 * 직접 읽는다 — 여기선 (1) 추가 디코드가 0인지, (2) 늦게 도착한 load에서도 종횡비가 잡히는지를 본다.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { Poster } from '../src/components/moods/_shared';

const BOX_W = 960;
const BOX_H = 1433;

let decoded: string[];
let origImage: typeof Image;
let origW: PropertyDescriptor | undefined;
let origH: PropertyDescriptor | undefined;

beforeEach(() => {
  decoded = [];
  origImage = globalThis.Image;
  // 프로브가 되살아나면 여기 src가 쌓인다. onload를 안 부르므로 프로브 경로는 종횡비도 못 얻는다.
  (globalThis as { Image: unknown }).Image = class {
    onload: (() => void) | null = null;
    set src(v: string) {
      decoded.push(v);
    }
  };
  origW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  origH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => BOX_W });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => BOX_H });
});

afterEach(() => {
  cleanup();
  (globalThis as { Image: unknown }).Image = origImage;
  if (origW) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origW);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetWidth;
  if (origH) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origH);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
});

function fgPoster(container: HTMLElement): HTMLImageElement {
  const imgs = Array.from(container.querySelectorAll('img[data-role="poster"]')) as HTMLImageElement[];
  return imgs.find((im) => !im.hasAttribute('data-poster-bg'))!;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('#526 ① Poster 자연 종횡비 — 전경 <img>에서 읽고, 추가 디코드는 없다', () => {
  test('contain 마운트에서 포스터 src를 new Image()로 다시 로드하지 않는다', async () => {
    const { container } = render(<Poster src="blob:poster" fit="contain" />);
    await flush();
    expect(fgPoster(container)).not.toBeNull();
    expect(decoded).toEqual([]);
  });

  test('꽉 채우기 토글(cover↔contain, #527)을 왕복해도 재디코드가 없다', async () => {
    const { container, rerender } = render(<Poster src="blob:poster" fit="contain" />);
    await flush();
    await act(async () => { rerender(<Poster src="blob:poster" fit="cover" />); });
    await act(async () => { rerender(<Poster src="blob:poster" fit="contain" />); });
    await flush();
    expect(container.querySelector('img[data-role="poster"]')).not.toBeNull();
    expect(decoded).toEqual([]);
  });

  test('늦게 도착한 load 이벤트로 종횡비가 잡혀 페더 마스크가 선다', async () => {
    const { container } = render(<Poster src="blob:poster" fit="contain" />);
    await flush();
    const fg = fgPoster(container);
    expect(fg.style.maskImage || '').not.toContain('linear-gradient'); // 로드 전엔 마스크 없음

    // 0.75 > 슬롯 0.670 → 상하 레터박스 → 세로 페더 대상.
    Object.defineProperty(fg, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(fg, 'naturalWidth', { configurable: true, get: () => 1200 });
    Object.defineProperty(fg, 'naturalHeight', { configurable: true, get: () => 1600 });
    await act(async () => { fireEvent.load(fg); });

    expect(fg.style.maskImage).toContain('linear-gradient');
    expect(fg.style.maskImage).toContain('to bottom');
    expect(decoded).toEqual([]);
  });
});
