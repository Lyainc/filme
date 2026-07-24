import { describe, expect, test } from 'bun:test';
import { applyCssColorFilterToPixel } from '../src/utils/captureToImage';

// #490/#495 — iOS Safari가 canvas ctx.filter를 drawImage에 적용하지 않아, 포스터 색보정을 픽셀로
// 직접 굽는 경로를 넣었다(captureToImage.drawImageColorFiltered/bakeColorFilter). 그 수식이 브라우저
// 네이티브 CSS filter와 어긋나면 저장물이 프리뷰와 다시 달라지므로, CSS/SVG Filter Effects 스펙의
// 알려진 값으로 수식 자체를 고정한다. 여기 숫자는 스펙 행렬에서 손으로 계산한 기대값이다.
describe('#490/#495 — CSS 색보정 필터 픽셀 재현', () => {
  test('brightness는 채널을 비례 배율한다', () => {
    expect(applyCssColorFilterToPixel('brightness(0.5)', 200, 200, 200)).toEqual([100, 100, 100]);
    // 255*0.5 = 127.5 → 반올림 128
    expect(applyCssColorFilterToPixel('brightness(0.5)', 255, 255, 255)).toEqual([128, 128, 128]);
  });

  test('brightness가 여러 번 오면 순서대로 누적된다(vintage/newspaper가 실제로 그렇다)', () => {
    // 200 → ×0.9 → ×0.5 = 90
    expect(applyCssColorFilterToPixel('brightness(0.9) brightness(0.5)', 200, 200, 200)).toEqual([90, 90, 90]);
  });

  test('각 함수 결과는 [0,1]로 클램프된다(filter primitive 단위 클램프)', () => {
    expect(applyCssColorFilterToPixel('brightness(2)', 200, 200, 200)).toEqual([255, 255, 255]);
    expect(applyCssColorFilterToPixel('brightness(0)', 200, 200, 200)).toEqual([0, 0, 0]);
  });

  test('grayscale(1)은 Rec.709 휘도(0.2126/0.7152/0.0722)로 수렴한다', () => {
    expect(applyCssColorFilterToPixel('grayscale(1)', 255, 0, 0)).toEqual([54, 54, 54]); // 0.2126*255
    expect(applyCssColorFilterToPixel('grayscale(1)', 0, 255, 0)).toEqual([182, 182, 182]); // 0.7152*255
    expect(applyCssColorFilterToPixel('grayscale(1)', 0, 0, 255)).toEqual([18, 18, 18]); // 0.0722*255
  });

  test('saturate(0)은 saturate 계수(0.213/0.715/0.072)로 수렴한다 — grayscale과 계수가 다르다', () => {
    expect(applyCssColorFilterToPixel('saturate(0)', 255, 0, 0)).toEqual([54, 54, 54]); // 0.213*255
    expect(applyCssColorFilterToPixel('saturate(0)', 0, 255, 0)).toEqual([182, 182, 182]); // 0.715*255
  });

  test('saturate(1)·contrast(1)·grayscale(0)은 항등이다', () => {
    expect(applyCssColorFilterToPixel('saturate(1)', 130, 90, 40)).toEqual([130, 90, 40]);
    expect(applyCssColorFilterToPixel('contrast(1)', 130, 90, 40)).toEqual([130, 90, 40]);
    expect(applyCssColorFilterToPixel('grayscale(0)', 130, 90, 40)).toEqual([130, 90, 40]);
  });

  test('sepia(1)은 스펙 세피아 행렬을 쓴다', () => {
    // 흰색: R=0.393+0.769+0.189=1.351→클램프 1, G=1.203→1, B=0.937
    expect(applyCssColorFilterToPixel('sepia(1)', 255, 255, 255)).toEqual([255, 255, 239]);
  });

  test('contrast는 0.5를 축으로 벌린다', () => {
    // 중간 회색(≈0.5)은 대비를 걸어도 거의 그대로
    expect(applyCssColorFilterToPixel('contrast(1.05)', 128, 128, 128)).toEqual([128, 128, 128]);
    // 어두운 값은 더 어둡게
    const [r] = applyCssColorFilterToPixel('contrast(2)', 64, 64, 64);
    expect(r).toBeLessThan(64);
  });

  test('포스터 기본 필터(PRINT_SIM + brightness)는 밝기를 절반 가깝게 낮춘다 — #490/#495 증상의 핵심', () => {
    // 실기기 프로브가 찍은 포스터 픽셀. iOS는 이 보정이 통째로 빠져 저장본이 밝게 나왔다.
    const [r, g, b] = applyCssColorFilterToPixel('saturate(0.92) contrast(1.05) brightness(0.5)', 205, 192, 188);
    expect(r).toBeLessThan(115);
    expect(g).toBeLessThan(110);
    expect(b).toBeLessThan(110);
    // 보정을 뺀 원본과 확실히 다르다(= ctx.filter 드롭 시의 저장물)
    expect([r, g, b]).not.toEqual([205, 192, 188]);
  });

  test('목록에 없는 함수는 건너뛰고 나머지는 적용한다(전부 무시되던 기존 iOS 동작보다 낫다)', () => {
    expect(applyCssColorFilterToPixel('hue-rotate(90deg) brightness(0.5)', 200, 200, 200)).toEqual([100, 100, 100]);
  });

  test('빈 필터/none은 픽셀을 그대로 둔다', () => {
    expect(applyCssColorFilterToPixel('', 200, 192, 188)).toEqual([200, 192, 188]);
    expect(applyCssColorFilterToPixel('none', 200, 192, 188)).toEqual([200, 192, 188]);
  });
});
