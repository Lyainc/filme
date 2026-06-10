import { describe, it, expect, afterEach, spyOn } from 'bun:test';
import { clusterPixels } from './colorCluster';

/**
 * clusterPixels는 worker 경로(colorExtraction.worker.ts)와 메인스레드 동기 fallback
 * (colorExtraction.ts)이 공유하는 유일한 클러스터링 코어다. 여기서 동작을 고정하면
 * 두 경로의 결과가 함께 고정된다.
 *
 * K-means++ 첫 중심점은 기존 구현 그대로 Math.random() 픽이라 비결정적 —
 * 결정성이 필요한 테스트는 Math.random을 고정해서 검증한다.
 */

/** [r,g,b,a] 픽셀 튜플 배열 → RGBA flat 배열 */
function rgba(pixels: Array<[number, number, number, number]>): number[] {
  const flat: number[] = [];
  for (const [r, g, b, a] of pixels) flat.push(r, g, b, a);
  return flat;
}

let randomSpy: ReturnType<typeof spyOn> | null = null;
afterEach(() => {
  randomSpy?.mockRestore();
  randomSpy = null;
});

describe('clusterPixels', () => {
  it('불투명 픽셀이 없으면 fallback 색상을 반환한다', () => {
    expect(clusterPixels([], 2)).toEqual(['#FFFFFF', '#000000']);
    // 전부 투명(alpha <= 128)인 경우도 동일
    const transparent = rgba([[255, 0, 0, 0], [0, 255, 0, 128]]);
    expect(clusterPixels(transparent, 2)).toEqual(['#FFFFFF', '#000000']);
  });

  it('단색 이미지는 랜덤 시드와 무관하게 그 색으로 수렴한다', () => {
    const red = rgba(Array.from({ length: 100 }, () => [200, 30, 40, 255] as [number, number, number, number]));
    // 단색이면 어떤 픽셀이 첫 중심점으로 뽑혀도 결과가 같다 (k=2 → 같은 색 2개)
    expect(clusterPixels(red, 2)).toEqual(['#C81E28', '#C81E28']);
  });

  it('잘 분리된 두 색은 정확히 두 클러스터로 추출된다 (시드 고정)', () => {
    randomSpy = spyOn(Math, 'random').mockReturnValue(0); // 첫 중심점 = pixels[0] = red
    const pixels = rgba([
      ...Array.from({ length: 50 }, () => [255, 0, 0, 255] as [number, number, number, number]),
      ...Array.from({ length: 50 }, () => [0, 0, 255, 255] as [number, number, number, number]),
    ]);
    expect(clusterPixels(pixels, 2)).toEqual(['#FF0000', '#0000FF']);
  });

  it('alpha <= 128 픽셀은 샘플링에서 제외된다', () => {
    randomSpy = spyOn(Math, 'random').mockReturnValue(0);
    const pixels = rgba([
      ...Array.from({ length: 50 }, () => [255, 0, 0, 255] as [number, number, number, number]),
      ...Array.from({ length: 50 }, () => [0, 255, 0, 100] as [number, number, number, number]), // 투명 green
      ...Array.from({ length: 50 }, () => [0, 0, 255, 255] as [number, number, number, number]),
    ]);
    const colors = clusterPixels(pixels, 2);
    expect(colors).toEqual(['#FF0000', '#0000FF']);
    expect(colors).not.toContain('#00FF00');
  });

  it('Uint8ClampedArray 입력(worker의 ArrayBuffer 경로)과 number[] 입력(동기 경로)의 결과가 동일하다', () => {
    randomSpy = spyOn(Math, 'random').mockReturnValue(0.42);
    const flat = rgba([
      ...Array.from({ length: 40 }, (_, i) => [200 + (i % 8), 20, 30, 255] as [number, number, number, number]),
      ...Array.from({ length: 40 }, (_, i) => [10, 40, 180 + (i % 8), 255] as [number, number, number, number]),
    ]);
    const fromArray = clusterPixels(flat, 2);
    randomSpy.mockReturnValue(0.42); // 동일 시드로 재실행
    const fromClamped = clusterPixels(new Uint8ClampedArray(flat), 2);
    expect(fromClamped).toEqual(fromArray);
  });
});
