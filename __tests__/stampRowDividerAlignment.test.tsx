/**
 * #505 — 체인·포맷 스탬프 사이 구분선이 로고 종횡비에 따른 실제 렌더 높이(stampHeightDelta,
 * ±16px)를 안 따라가고 무드별 하드코딩 상수였던 문제의 회귀. StampRow(_shared.tsx)로 추출한
 * 뒤, 두 스탬프의 실제 렌더 높이(onRenderedHeight로 리포트) 중 큰 쪽에 구분선이 맞춰지는지
 * 5개 무드(Editorial은 세로 스택+dot이라 대상 아님) 전부에서 검증한다.
 *
 * MockImage 패턴은 stampHeightIntegration.test.tsx와 동일 — window.Image를 목업해 onload를
 * 수동 트리거하고, chain은 세로로 긴 로고(aspect 0.25 → delta +14, base height보다 커짐),
 * format은 REF_ASPECT(2)와 같은 로고(delta 0)를 줘서 두 스탬프의 실제 높이를 의도적으로 벌린다.
 */
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { render, cleanup, waitFor } from '@testing-library/react';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodMinimal } from '../src/components/moods/MoodMinimal';
import { MoodStub } from '../src/components/moods/MoodStub';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import type { MovieInfo, TicketComponents } from '../src/types';

const DIMENSIONS: Record<string, [number, number]> = {
  'blob:chain-tall': [60, 240], // aspect 0.25 — delta +14
  'blob:format-normal': [128, 64], // aspect 2 = REF_ASPECT — delta 0
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
  // @ts-expect-error 테스트 전용 목업
  global.Image = MockImage;
});

afterEach(() => {
  global.Image = OriginalImage;
  cleanup();
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
  layout: 'minimal', chain: 'blob:chain-tall', format: 'blob:format-normal',
  chainLabel: '', formatLabel: '',
  material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1,
  posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true, chainScale: 1, formatScale: 1, posterFit: 'cover',
};

const MOODS = [
  ['stub', MoodStub],
  ['criterion', MoodCriterion],
  ['35mm', Mood35mm],
  ['35mm-landscape', Mood35mmLandscape],
  ['minimal', MoodMinimal],
] as const;

describe('#505 StampRow 구분선 정렬', () => {
  test.each(MOODS)('%s: 구분선 높이가 두 스탬프의 실제 렌더 높이 중 큰 값과 일치', async (_name, Mood) => {
    const { container } = render(
      <Mood movieInfo={MOVIE} components={BASE} croppedImageUrl="blob:poster" />
    );

    const divider = await waitFor(() => {
      const el = container.querySelector<HTMLSpanElement>('[data-stamp-divider]');
      expect(el).toBeTruthy();
      return el!;
    });

    const chainImg = container.querySelector<HTMLImageElement>('img[alt="Theater Chain"]');
    const formatImg = container.querySelector<HTMLImageElement>('img[alt="Screening Format"]');
    expect(chainImg).toBeTruthy();
    expect(formatImg).toBeTruthy();

    const chainH = parseFloat(chainImg!.style.height);
    const formatH = parseFloat(formatImg!.style.height);
    // 목업 종횡비가 의도한 대로 두 스탬프 높이를 실제로 벌렸는지 먼저 확인 — 이게 같으면
    // 아래 정렬 검증이 우연히 통과할 수 있다(#408 P1 지적과 동일 함정).
    expect(chainH).not.toBe(formatH);

    await waitFor(() => {
      expect(parseFloat(divider.style.height)).toBe(Math.max(chainH, formatH));
    });
  });

  test.each(MOODS)('%s: 로고 미로드(치수 없음) 상태에서도 throw 없이 렌더', (_name, Mood) => {
    expect(() =>
      render(<Mood movieInfo={MOVIE} components={{ ...BASE, chain: 'blob:unmapped', format: 'blob:unmapped2' }} croppedImageUrl="blob:poster" />)
    ).not.toThrow();
  });
});
