/**
 * #434 후가공 강도축 — 레시피 순수 함수 회귀. 미리보기(CSS)와 저장(canvas)이 공유하는
 * 단일 소스라, 강도 스케일 규칙이 깨지면 두 경로가 동시에 어긋난다. 여기선 그 규칙만 고정한다.
 */
import { describe, expect, test } from 'bun:test';
import { TEXTURE_RECIPES, recipeToGradientCss, defaultIntensityForTexture } from '@/utils/textureRecipes';

function alphasOf(css: string): number[] {
  return Array.from(css.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)).map((m) => parseFloat(m[1]));
}

describe('textureRecipes', () => {
  test('강도 0이면 모든 stop이 완전 투명 — 강도 0 = 무가공 하한(ac2)', () => {
    const alphas = alphasOf(recipeToGradientCss(TEXTURE_RECIPES.hologram, 0));
    expect(alphas.length).toBeGreaterThan(0);
    expect(alphas.every((a) => a === 0)).toBe(true);
  });

  test('강도는 stop alpha에 선형으로 곱해진다 — 0.5는 100%의 절반', () => {
    const full = alphasOf(recipeToGradientCss(TEXTURE_RECIPES.hologram, 1));
    const half = alphasOf(recipeToGradientCss(TEXTURE_RECIPES.hologram, 0.5));
    expect(half.length).toBe(full.length);
    half.forEach((a, i) => expect(a).toBeCloseTo(full[i] / 2, 6));
  });

  test('defaultIntensityForTexture — 레시피 있으면 그 값, 밖이면 1', () => {
    expect(defaultIntensityForTexture('none')).toBe(1); // INITIAL_STATE.textureIntensity와 일치
    expect(defaultIntensityForTexture('hologram')).toBe(0.7);
    expect(defaultIntensityForTexture('original')).toBe(1); // 레시피 밖
    expect(defaultIntensityForTexture('artpaper')).toBe(1); // 물리재질(레시피 밖, feTurbulence 후속)
  });

  test('gradient CSS는 레시피 각도와 stop 위치를 그대로 반영한다', () => {
    const css = recipeToGradientCss(TEXTURE_RECIPES.none, 1);
    expect(css.startsWith('linear-gradient(135deg,')).toBe(true);
    expect(css).toContain('50%'); // none의 하이라이트 피크 stop
  });
});
