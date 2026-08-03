/**
 * #509 2단계(c10) — 자석 올가미 엣지-스냅의 순수 함수(computeGradientMagnitude/snapToEdge)만
 * 잠근다. buildLassoGradientMap(canvas/img 의존)은 happy-dom에 Canvas 2D 구현이 없어(CLAUDE.md
 * 🧪 참고) 여기서 직접 테스트하지 않는다 — 실브라우저 검증은 capture-export.mjs 올가미 시나리오가 맡는다.
 */
import { describe, expect, test } from 'bun:test';
import { computeGradientMagnitude, snapToEdge, type GradientMap } from '../src/utils/embossLasso';

/** width×height RGBA 버퍼를 만든다. fill(x,y)가 각 픽셀의 회색값(0..255)을 정한다. */
function makeRgba(width: number, height: number, fill: (x: number, y: number) => number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = fill(x, y);
      const o = (y * width + x) * 4;
      rgba[o] = v;
      rgba[o + 1] = v;
      rgba[o + 2] = v;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

describe('computeGradientMagnitude', () => {
  test('세로 에지(좌 검정/우 흰색)는 경계 열에서 그라디언트가 최대', () => {
    const w = 10;
    const h = 10;
    const rgba = makeRgba(w, h, (x) => (x < w / 2 ? 0 : 255));
    const map = computeGradientMagnitude(rgba, w, h);
    const magAt = (x: number, y: number) => map.data[y * w + x];
    // 경계(x=4,5 부근)가 평탄부(x=1, x=8)보다 훨씬 강하다.
    expect(magAt(4, 5)).toBeGreaterThan(magAt(1, 5));
    expect(magAt(5, 5)).toBeGreaterThan(magAt(8, 5));
  });

  test('완전히 평탄한 이미지는 그라디언트가 어디서나 0', () => {
    const w = 6;
    const h = 6;
    const rgba = makeRgba(w, h, () => 128);
    const map = computeGradientMagnitude(rgba, w, h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        expect(map.data[y * w + x]).toBe(0);
      }
    }
  });
});

describe('snapToEdge', () => {
  function mapWithPeakAt(w: number, h: number, px: number, py: number): GradientMap {
    const data = new Float32Array(w * h);
    data[py * w + px] = 999;
    return { data, width: w, height: h };
  }

  test('탐색 반경 안에 있는 국소 최댓값으로 스냅한다', () => {
    const map = mapWithPeakAt(20, 20, 12, 10);
    const snapped = snapToEdge(map, 10, 10, 5); // 목표(10,10) 반경 5 안에 (12,10) 포함
    expect(snapped).toEqual({ x: 12, y: 10 });
  });

  test('피크가 탐색 반경 밖이면 그 피크를 못 찾고, 창 안에서 동률(전부 0)인 첫 스캔 후보(좌상단)로 남는다', () => {
    const map = mapWithPeakAt(20, 20, 19, 19); // 반경 밖 피크
    const snapped = snapToEdge(map, 5, 5, 2);
    // 창 안이 전부 0이라 스캔 순서(dy,dx 오름차순)상 처음 만나는 좌표(목표-반경)에서 안 움직인다 —
    // 커서 근처에서 안 벗어나는 "튀지 않는" 성질이 중요하지, 어느 구석이냐는 구현 세부다.
    expect(snapped).toEqual({ x: 3, y: 3 });
  });

  test('경계 근처 목표도 범위를 안 벗어나며(크래시 없음) 유효 창 안에서 스냅한다', () => {
    const map = mapWithPeakAt(20, 20, 1, 1);
    const snapped = snapToEdge(map, 0, 0, 5);
    expect(snapped.x).toBeGreaterThanOrEqual(1);
    expect(snapped.y).toBeGreaterThanOrEqual(1);
    expect(snapped).toEqual({ x: 1, y: 1 });
  });
});
