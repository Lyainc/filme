/**
 * #506 — gradient 후가공을 "레시피 1개 → 비트맵 1개"로 굽는 프레임워크.
 *
 * 이 파일이 잠그는 건 두 가지다.
 *  - **c4(보이는 변화 0)**: 새 기하(`gradientLineEndpoints`)가 이주 전 저장 경로의 손으로 짠
 *    sin/cos 투영과 픽셀 단위로 같은 끝점을 낸다. 여기가 갈리면 저장물이 달라진 것이다.
 *  - **c2(intensity는 캐시 키가 아니다)**: 굽기는 intensity=1 고정이라, 강도만 달라져도 재굽기가 없다.
 */
import { describe, expect, test } from 'bun:test';
import {
  TEXTURE_RECIPES,
  gradientBitmapSvg,
  gradientLineEndpoints,
  gradientSvgCacheSize,
  type GradientRecipe,
} from '../src/utils/textureRecipes';

/** 이주 전 `compositeOverlay`가 쓰던 기하 — 회귀 대조군으로 그대로 보존한다. */
function legacyEndpointsPx(angle: number, bw: number, bh: number) {
  const t = (angle * Math.PI) / 180;
  const dirX = Math.sin(t);
  const dirY = -Math.cos(t);
  const len = Math.abs(bw * Math.sin(t)) + Math.abs(bh * Math.cos(t));
  const cx = bw / 2;
  const cy = bh / 2;
  return {
    x1: cx - (dirX * len) / 2,
    y1: cy - (dirY * len) / 2,
    x2: cx + (dirX * len) / 2,
    y2: cy + (dirY * len) / 2,
  };
}

describe('#506 c4 — 새 정규화 기하가 옛 canvas 투영과 같은 끝점을 낸다', () => {
  // 실제로 쓰이는 각도(125·135) + 축 정렬(0·90·180·270) + 비대칭 각도.
  const angles = [0, 45, 90, 125, 135, 180, 217, 270, 330];
  // 세로 포스터(0.667의 역수 1.5), 신용카드 캔버스(1.598), 가로 슬롯(0.667), 정사각.
  const boxes = [
    { w: 960, h: 1440 },
    { w: 960, h: 1534 },
    { w: 1440, h: 960 },
    { w: 800, h: 800 },
  ];

  for (const angle of angles) {
    for (const { w, h } of boxes) {
      test(`angle=${angle} box=${w}x${h}`, () => {
        const n = gradientLineEndpoints(angle, h / w);
        const legacy = legacyEndpointsPx(angle, w, h);
        // 정규화 좌표를 박스 크기로 되돌리면 옛 픽셀 끝점과 같아야 한다.
        expect(n.x1 * w).toBeCloseTo(legacy.x1, 6);
        expect(n.y1 * h).toBeCloseTo(legacy.y1, 6);
        expect(n.x2 * w).toBeCloseTo(legacy.x2, 6);
        expect(n.y2 * h).toBeCloseTo(legacy.y2, 6);
      });
    }
  }
});

describe('#506 c1/c2 — 굽기 산출물과 캐시 규율', () => {
  const gloss = TEXTURE_RECIPES.gloss as GradientRecipe;

  test('굽기 파라미터가 같으면 같은 문자열을 돌려준다(캐시 히트) — 강도는 파라미터가 아니다', () => {
    const before = gradientSvgCacheSize();
    const a = gradientBitmapSvg(gloss, 1.5);
    const b = gradientBitmapSvg(gloss, 1.5);
    expect(a).toBe(b);
    // 강도가 어떻든 굽기 호출은 여전히 같은 (레시피, aspect) 하나뿐이라 캐시가 1만 는다.
    expect(gradientSvgCacheSize()).toBe(before + 1);
  });

  test('종횡비가 다르면 다른 비트맵이다 — aspect가 굽기 파라미터이자 캐시 키다', () => {
    expect(gradientBitmapSvg(gloss, 1.5)).not.toBe(gradientBitmapSvg(gloss, 0.667));
  });

  test('intensity=1로 굽는다 — stop alpha가 레시피 값 그대로 실린다(합성 시점에 곱한다)', () => {
    const svg = decodeURIComponent(gradientBitmapSvg(gloss, 1.5));
    // gloss 피크 alpha 0.42가 스케일 없이 그대로 있어야 한다.
    expect(svg).toContain('stop-opacity="0.42"');
    // 끝점은 실좌표로 준다 — 기본 objectBoundingBox는 bbox를 단위 정사각으로 정규화한 뒤
    // 뷰포트 전단을 얹어 각도가 어긋난다(격리 대조에서 scodix max 149/255로 잡혔다).
    expect(svg).toContain('gradientUnits="userSpaceOnUse"');
    // 굽는 캔버스가 목표 박스와 같은 종횡비여야 preserveAspectRatio="none" 늘리기가 각도를 보존한다.
    const m = svg.match(/<svg[^>]*\swidth="(\d+)"[^>]*\sheight="(\d+)"[^>]*\sviewBox="0 0 (\d+) (\d+)"/);
    expect(m).not.toBeNull();
    const [, w, h, vw, vh] = m!.map(Number);
    // 고유 크기가 없으면 CSS background로는 뜨지만 new Image() 로드가 서지 않아 저장이 멈춘다.
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
    expect(vw).toBe(w);
    expect(vh).toBe(h);
    expect(h / w).toBeCloseTo(1.5, 2); // 요청한 aspect
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  test('CSS의 premultiplied 알파 보간을 재현한다 — 색과 알파가 함께 변하는 구간의 중간색', () => {
    // scodix 44%(검정 α0.22) → 49%(흰색 α0.85)의 중간 46.5%. premultiplied면
    // α=0.535, rgb=(0×0.22×0.5 + 255×0.85×0.5)/0.535 ≈ 203. 색·알파를 따로 보간하면 128이 된다.
    const svg = decodeURIComponent(gradientBitmapSvg(TEXTURE_RECIPES.scodix as GradientRecipe, 1.5));
    const m = svg.match(/offset="46\.5%" stop-color="rgb\((\d+),/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThan(190); // 128(비-premultiplied)과 확실히 갈린다
  });

  test('gradient 4종 전부 구워진다(레시피 누락 시 컴파일이 아니라 여기서 잡힌다)', () => {
    for (const id of ['gloss', 'hologram', 'metal', 'scodix']) {
      const r = TEXTURE_RECIPES[id];
      expect(r.kind).toBe('gradient');
      expect(gradientBitmapSvg(r as GradientRecipe, 1.5)).toStartWith('data:image/svg+xml,');
    }
  });
});
