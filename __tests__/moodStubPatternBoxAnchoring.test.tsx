/** #768: 좌표 환산·React 갱신·observer 수명·spacer 배선을 검증한다.
 * happy-dom은 레이아웃을 계산하지 않으므로 실제 기하·텍스트·JPEG 대조는
 * scripts/capture-export.mjs --stub-check가 담당한다. */
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { anchorStampBox, MoodStub } from '@/components/moods/MoodStub';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

afterEach(cleanup);

test('크기 변화 없는 이동과 측정 불가 전환도 이전 좌표를 남기지 않는다 (#768)', () => {
  let top = 1000;
  let height = 80;
  const rect = spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return (this.hasAttribute('data-pattern-spacer')
      ? { left: 56, top, width: 848, height }
      : { left: 0, top: 0, width: 960, height: 1534 }) as DOMRect;
  });
  try {
    const props = { components: { ...makeMoodBase('stub'), backgroundPatternImage: 'blob:stamp' }, croppedImageUrl: null };
    const { container, rerender } = render(<MoodStub {...props} movieInfo={FULL_MOVIE} />);
    const layer = () => container.querySelector<HTMLElement>('[data-bg-pattern]')!;
    expect(layer().style.top).toBe('1019px');
    // Admission/Film 모두 on 유지, spacer 크기도 동일 — ResizeObserver는 위치 이동을 알리지 않는다.
    top = 1100;
    rerender(<MoodStub {...props} movieInfo={{ ...FULL_MOVIE, title: '새 제목' }} />);
    expect(layer().style.top).toBe('1119px');
    height = 0;
    rerender(<MoodStub {...props} movieInfo={{ ...FULL_MOVIE, title: '공간 없음' }} />);
    expect(layer().style.height).toBe('0px');
  } finally {
    cleanup();
    rect.mockRestore();
  }
});

test('네 섹션 조합과 ghost 전환마다 새 spacer를 관찰하고 비동기 크기 변화도 반영한다', () => {
  const OriginalObserver = globalThis.ResizeObserver;
  const observers: TestObserver[] = [];
  class TestObserver {
    targets: Element[] = [];
    disconnected = false;
    constructor(private callback: ResizeObserverCallback) { observers.push(this); }
    observe(target: Element) { this.targets.push(target); }
    unobserve() {}
    disconnect() { this.disconnected = true; }
    notify() { this.callback([], this); }
  }
  globalThis.ResizeObserver = TestObserver;
  let height = 80;
  const rect = spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return (this.hasAttribute('data-pattern-spacer')
      ? { left: 56, top: 1200, width: 848, height }
      : { left: 0, top: 0, width: 960, height: 1534 }) as DOMRect;
  });
  try {
    const props = { components: { ...makeMoodBase('stub'), backgroundPatternImage: 'blob:stamp' }, croppedImageUrl: null };
    const { container, rerender, unmount } = render(<MoodStub {...props} movieInfo={FULL_MOVIE} />);
    const admissionOff = { seat: '', watchDate: '', watchTime: '', theater: '', screen: '' };
    const filmOff = { runtime: '', rating: 0, releaseDate: '', isReissue: false, reissueDate: '', actors: '' };
    for (const movieInfo of [FULL_MOVIE, { ...FULL_MOVIE, ...admissionOff }, { ...FULL_MOVIE, ...admissionOff, ...filmOff }, { ...FULL_MOVIE, ...filmOff }]) {
      rerender(<MoodStub {...props} movieInfo={movieInfo} />);
      const spacer = container.querySelector('[data-pattern-spacer]')!;
      const observer = observers.findLast(o => !o.disconnected && o.targets.includes(spacer));
      expect(observer).toBeDefined();
      height += 10;
      act(() => observer!.notify());
      expect(container.querySelector<HTMLElement>('[data-bg-pattern]')!.style.top).toBe(`${1200 + (height - 42) / 2}px`);
    }
    rerender(<MoodStub {...props} movieInfo={{ ...FULL_MOVIE, ...admissionOff, ...filmOff }} ghost />);
    expect(container.textContent).toContain('Admission');
    expect(container.textContent).toContain('The Film');
    expect(observers.filter(o => !o.disconnected && o.targets.includes(container.querySelector('[data-pattern-spacer]')!))).toHaveLength(1);
    unmount();
    expect(observers.every(o => o.disconnected)).toBe(true);
  } finally {
    cleanup();
    rect.mockRestore();
    globalThis.ResizeObserver = OriginalObserver;
  }
});

describe('anchorStampBox — 스페이서 실측 → 스탬프 박스 환산 (#768)', () => {
  test('스페이서가 스탬프보다 크면 우측 정렬·세로 중앙에 앉는다', () => {
    const root = { left: 0, top: 0, width: 960 };
    const spacer = { left: 56, top: 1000, width: 848, height: 190 };
    expect(anchorStampBox(root, spacer)).toEqual({ left: 604, top: 1074, width: 300, height: 42 });
  });

  test('프리뷰 배율과 무관하다 — root/spacer가 같은 배율로 축소돼도 자연좌표 결과는 같다', () => {
    const natural = anchorStampBox({ left: 0, top: 0, width: 960 }, { left: 56, top: 1000, width: 848, height: 190 })!;
    const scale = 0.4;
    const scaled = anchorStampBox(
      { left: 100, top: 50, width: 960 * scale },
      { left: 100 + 56 * scale, top: 50 + 1000 * scale, width: 848 * scale, height: 190 * scale }
    )!;
    // 부동소수점 배율 나눗셈이라 비트 단위 동일은 안 보장된다 — 자리수로 충분.
    expect(scaled.left).toBeCloseTo(natural.left, 9);
    expect(scaled.top).toBeCloseTo(natural.top, 9);
    expect(scaled.width).toBeCloseTo(natural.width, 9);
    expect(scaled.height).toBeCloseTo(natural.height, 9);
  });

  test('스탬프가 스페이서보다 크면 스페이서 크기로 줄어든다 — 절대 못 넘친다', () => {
    const root = { left: 0, top: 0, width: 960 };
    const spacer = { left: 700, top: 1200, width: 100, height: 10 };
    expect(anchorStampBox(root, spacer)).toEqual({ left: 700, top: 1200, width: 100, height: 10 });
  });

  test('root/spacer 폭·높이가 0이면 null — 호출부가 스탬프 크기를 비운다', () => {
    expect(anchorStampBox({ left: 0, top: 0, width: 0 }, { left: 0, top: 0, width: 0, height: 0 })).toBeNull();
    expect(anchorStampBox({ left: 0, top: 0, width: 960 }, { left: 56, top: 1000, width: 0, height: 190 })).toBeNull();
    expect(anchorStampBox({ left: 0, top: 0, width: 960 }, { left: 56, top: 1000, width: 848, height: 0 })).toBeNull();
  });
});

describe('spacerRef 배선 — 실제로 비어 있는 스페이서 하나에만 걸린다 (#768)', () => {
  const BASE = makeMoodBase('stub');
  // 스탬프 이미지가 없으면 BackgroundPatternLayer 자체가 null이라 마커 유무 확인엔 영향 없다 —
  // 여기서 보는 건 스페이서 마커지 스탬프 레이어가 아니다.
  const admissionOff = { seat: false, watchDate: false, watchTime: false, screen: false, theater: false } as const;
  const filmOff = { runtime: false, rating: false, releaseDate: false, reissue: false, actors: false } as const;

  function render(fieldVisibility?: Record<string, boolean>) {
    return renderToStaticMarkup(
      <MoodStub movieInfo={FULL_MOVIE} components={BASE} croppedImageUrl={null} fieldVisibility={fieldVisibility as never} />
    );
  }

  test('Admission·Film 둘 다 켜지면 마커가 그 사이(가운데 spacer)에 정확히 하나 선다', () => {
    const html = render();
    const admissionIdx = html.indexOf('Admission');
    const markerIdx = html.indexOf('data-pattern-spacer');
    const filmIdx = html.indexOf('The Film');
    expect((html.match(/data-pattern-spacer/g) || []).length).toBe(1);
    expect(admissionIdx).toBeGreaterThan(-1);
    expect(filmIdx).toBeGreaterThan(-1);
    expect(admissionIdx).toBeLessThan(markerIdx);
    expect(markerIdx).toBeLessThan(filmIdx);
  });

  test('Admission만 꺼지면 마커가 Film 콘텐츠 뒤(트레일링 spacer)에 선다', () => {
    const html = render(admissionOff);
    const filmIdx = html.indexOf('The Film');
    const markerIdx = html.indexOf('data-pattern-spacer');
    expect(html).not.toContain('Admission');
    expect((html.match(/data-pattern-spacer/g) || []).length).toBe(1);
    expect(filmIdx).toBeGreaterThan(-1);
    expect(filmIdx).toBeLessThan(markerIdx);
  });

  test('Film만 꺼지면 마커가 Admission 콘텐츠 뒤(트레일링 spacer)에 선다', () => {
    const html = render(filmOff);
    const admissionIdx = html.indexOf('Admission');
    const markerIdx = html.indexOf('data-pattern-spacer');
    expect(html).not.toContain('The Film');
    expect((html.match(/data-pattern-spacer/g) || []).length).toBe(1);
    expect(admissionIdx).toBeGreaterThan(-1);
    expect(admissionIdx).toBeLessThan(markerIdx);
  });

  test('둘 다 꺼지면 마커 하나만 선다(Admission·Film 텍스트는 없음)', () => {
    const html = render({ ...admissionOff, ...filmOff });
    expect(html).not.toContain('Admission');
    expect(html).not.toContain('The Film');
    expect((html.match(/data-pattern-spacer/g) || []).length).toBe(1);
  });
});
