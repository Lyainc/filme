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

class MockImage {
  naturalWidth = 0;
  naturalHeight = 0;
  onload: (() => void) | null = null;
  set src(v: string) {
    const dims = DIMENSIONS[v];
    if (dims) [this.naturalWidth, this.naturalHeight] = dims;
    queueMicrotask(() => this.onload?.());
  }
}

let OriginalImage: typeof Image;

beforeEach(() => {
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
});
