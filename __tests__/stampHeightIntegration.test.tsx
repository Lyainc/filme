import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { render, cleanup, waitFor } from '@testing-library/react';
import { ChainStamp, FormatStamp } from '../src/components/moods/_shared';

// 로고 스탬프 높이 소폭 동적화(#392) 통합 회귀 — claude-review PR #408 P1: stampHeightDelta 순수
// 함수 테스트만으로는 실제 useNaturalAspect → <img> height 배선이 검증되지 않는다는 지적 반영.
// window.Image를 목업해 onload를 수동 트리거하고, 렌더된 <img>의 height가 종횡비 델타만큼
// 실제로 바뀌는지 확인한다.

const DIMENSIONS: Record<string, [number, number]> = {
  'blob:tall': [60, 240], // aspect 0.25 — delta +14 → 48+14=62
  'blob:wide': [400, 60], // aspect 6.67 — delta clamp -16 → 64-16=48
};

let imageLoadCount = 0;

class MockImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  constructor() {
    imageLoadCount++;
  }
  set src(v: string) {
    const dims = DIMENSIONS[v];
    if (dims) [this.naturalWidth, this.naturalHeight] = dims;
    queueMicrotask(() => this.onload?.());
  }
}

let OriginalImage: typeof Image;

beforeEach(() => {
  imageLoadCount = 0;
  OriginalImage = global.Image;
  // @ts-expect-error 테스트 전용 목업 — 실제 Image 생성자를 대체
  global.Image = MockImage;
});

afterEach(() => {
  global.Image = OriginalImage;
  cleanup();
});

describe('ChainStamp/FormatStamp 높이 보정 통합 (#392)', () => {
  test('세로로 긴 로고는 높이가 +14px 커진다', async () => {
    const { container } = render(<ChainStamp chain="blob:tall" visible height={48} />);
    await waitFor(() => {
      expect(container.querySelector('img')?.style.height).toBe('62px');
    });
  });

  test('가로로 긴 로고는 높이가 -16px cap까지 줄어든다', async () => {
    const { container } = render(<FormatStamp format="blob:wide" visible />);
    await waitFor(() => {
      expect(container.querySelector('img')?.style.height).toBe('48px');
    });
  });

  test('미로드/치수 없음(aspect=null)은 첫 페인트부터 기존 고정 높이', () => {
    const { container } = render(<ChainStamp chain="blob:unmapped" visible height={48} />);
    expect(container.querySelector('img')?.style.height).toBe('48px');
  });

  // claude-review PR #408 P1(2차): delta가 size로 스케일 안 되면 Stub/Editorial처럼 size<1인
  // 무드에서 ±16px가 base height 대비 훨씬 큰 상대 변화를 만든다. (height+delta)*size로 고정.
  test('size<1(예: Stub/Editorial의 0.5)에서도 delta가 함께 스케일된다', async () => {
    const { container } = render(<ChainStamp chain="blob:tall" visible height={48} size={0.5} />);
    await waitFor(() => {
      // (48 + 14) * 0.5 = 31 — delta가 스케일 안 됐다면 24 + 14 = 38이 됐을 것.
      expect(container.querySelector('img')?.style.height).toBe('31px');
    });
  });

  // claude-review PR #410 P1: active 게이팅·즉시 리셋(#190 nit)에 회귀 테스트가 없다는 지적 반영.
  test('완전 비노출(visible=false, ghost=false)이면 Image() 로드 자체를 생략한다', () => {
    render(<ChainStamp chain="blob:tall" visible={false} ghost={false} height={48} />);
    expect(imageLoadCount).toBe(0);
  });

  test('src 교체 시 새 로드가 끝나기 전엔 이전 aspect가 아니라 즉시 기본 높이로 리셋된다', async () => {
    const { container, rerender } = render(<ChainStamp chain="blob:tall" visible height={48} />);
    await waitFor(() => {
      expect(container.querySelector('img')?.style.height).toBe('62px');
    });

    rerender(<ChainStamp chain="blob:wide" visible height={48} />);
    // MockImage의 onload는 microtask라 여기선 아직 새 로드가 끝나기 전 — 이전 62px이 그대로
    // 남아 있으면 리셋이 안 된 것.
    expect(container.querySelector('img')?.style.height).toBe('48px');

    await waitFor(() => {
      expect(container.querySelector('img')?.style.height).toBe('32px'); // 48 - 16px cap
    });
  });
});
