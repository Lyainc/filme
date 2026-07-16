import { describe, expect, test } from 'bun:test';
import { computeOutputSize } from '@/utils/ocrPreprocess';

/**
 * #404 회귀 — 하단 18% 크롭이 되살아나면 outH/outW 비율이 원본 비율과 어긋난다.
 * canvas/createImageBitmap은 happy-dom에서 안정적으로 모킹하기 어려워(실제 이미지
 * 디코딩이 필요) 치수 계산만 순수 함수로 분리해 검증한다.
 */
describe('computeOutputSize — 크롭 없는 512 다운스케일(#404)', () => {
  test('세로 스크린샷(1170×2532) — 크롭 있었다면 outH=909였겠지만, 크롭 없이 outH=1108', () => {
    const { outW, outH } = computeOutputSize(1170, 2532);
    expect(outW).toBe(512);
    expect(outH).toBe(1108); // round(2532 * 512/1170); 크롭 시엔 909
  });

  test('영수증형 가로 사진(4032×3024, EXIF 미적용) — 512×384로 크롭 없이 축소', () => {
    const { outW, outH } = computeOutputSize(4032, 3024);
    expect(outW).toBe(512);
    expect(outH).toBe(384);
  });

  test('출력 종횡비가 입력 종횡비와 정확히 같다(크롭 부재 확인)', () => {
    const W = 1170;
    const H = 2532;
    const { outW, outH } = computeOutputSize(W, H);
    expect(outH / outW).toBeCloseTo(H / W, 2);
  });

  test('width가 이미 512 이하면 스케일 1(그대로)', () => {
    expect(computeOutputSize(400, 300)).toEqual({ outW: 400, outH: 300 });
    expect(computeOutputSize(512, 900)).toEqual({ outW: 512, outH: 900 });
  });
});
