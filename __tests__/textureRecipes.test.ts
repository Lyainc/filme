/**
 * #434 후가공 강도축 — 레시피 순수 함수 회귀. 미리보기(CSS)와 저장(canvas)이 공유하는
 * 단일 소스라, 강도 스케일 규칙이 깨지면 두 경로가 동시에 어긋난다. 여기선 그 규칙만 고정한다.
 */
import { describe, expect, test } from 'bun:test';
import {
  TEXTURE_RECIPES,
  recipeToGradientCss,
  defaultIntensityForTexture,
  isNoiseRecipe,
  noiseTileSvg,
  LEGACY_TEXTURE_MIGRATION,
  migrateLegacyComponents,
  type TextureRecipe,
} from '@/utils/textureRecipes';
import { defaultBrightnessForTexture } from '@/components/moods/_shared';

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
    expect(defaultIntensityForTexture('gloss')).toBe(1); // INITIAL_STATE.coatingIntensity와 일치
    expect(defaultIntensityForTexture('hologram')).toBe(0.7);
    expect(defaultIntensityForTexture('original')).toBe(1); // 재질 레시피 밖
    expect(defaultIntensityForTexture('none')).toBe(1); // 코팅 레시피 밖(#475 — 'none'은 이제 coating='없음')
    // 물리재질도 이제 레시피에 편입(#471) — 각 noise 레시피의 defaultIntensity를 그대로 반환한다.
    expect(defaultIntensityForTexture('artpaper')).toBe(TEXTURE_RECIPES.artpaper.defaultIntensity);
    expect(defaultIntensityForTexture('vintage')).toBeGreaterThan(0);
  });

  test('gradient CSS는 레시피 각도와 stop 위치를 그대로 반영한다', () => {
    const css = recipeToGradientCss(TEXTURE_RECIPES.gloss, 1);
    expect(css.startsWith('linear-gradient(125deg,')).toBe(true);
    expect(css).toContain('50%'); // gloss의 하이라이트 피크 stop
  });
});

describe('#475 재질×코팅 2축 재설계', () => {
  test('코팅 축 레시피(gloss·hologram·metal·scodix)와 재질 축 레시피(artpaper·vintage·newspaper)가 한 맵에 겹치지 않고 공존한다', () => {
    const coatingIds = ['gloss', 'hologram', 'metal', 'scodix'];
    const materialIds = ['artpaper', 'vintage', 'newspaper'];
    for (const id of [...coatingIds, ...materialIds]) {
      expect(TEXTURE_RECIPES[id]).toBeDefined();
    }
    // 옛 단일축 키 'none'(유광)은 코팅축 'gloss'로 개명됐다 — 남아 있으면 코팅=없음과 이름이 겹친다.
    expect(TEXTURE_RECIPES.none).toBeUndefined();
  });

  test('강화 대상(gloss·scodix·artpaper)은 인접 유지 대상보다 피크 강도가 뚜렷이 높다(ac3 구분감)', () => {
    // gloss(강화) vs hologram/metal(유지) — 코팅 gradient stop 최대 alpha 비교.
    const peakAlpha = (recipe: TextureRecipe) =>
      recipe.kind === 'gradient' ? Math.max(...recipe.stops.map((s) => s.alpha)) : recipe.alpha;
    expect(peakAlpha(TEXTURE_RECIPES.gloss)).toBeGreaterThan(0.3); // 옛 0.18보다 뚜렷이 강화
    expect(peakAlpha(TEXTURE_RECIPES.scodix)).toBeGreaterThan(0.65); // 옛 0.65 초과
    expect(TEXTURE_RECIPES.artpaper.kind === 'noise' && TEXTURE_RECIPES.artpaper.alpha).toBeGreaterThan(0.5); // 옛 0.5 초과
  });

  test('migrateLegacyComponents — 레거시 단일 texture 8종 전부가 migration_map대로 매핑된다(c4)', () => {
    for (const [legacy, mapped] of Object.entries(LEGACY_TEXTURE_MIGRATION)) {
      const result = migrateLegacyComponents({ texture: legacy, textureIntensity: 0.42, layout: 'minimal' });
      expect(result.material).toBe(mapped.material);
      expect(result.coating).toBe(mapped.coating);
      expect(result.layout).toBe('minimal'); // 무관 필드는 그대로 통과
    }
  });

  test('migrateLegacyComponents — 강도는 코팅형 레거시면 coatingIntensity, 재질형이면 materialIntensity에 실린다', () => {
    expect(migrateLegacyComponents({ texture: 'hologram', textureIntensity: 0.3 })).toMatchObject({
      material: 'original', coating: 'hologram', coatingIntensity: 0.3,
    });
    expect(migrateLegacyComponents({ texture: 'vintage', textureIntensity: 0.3 })).toMatchObject({
      material: 'vintage', coating: 'none', materialIntensity: 0.3,
    });
  });

  test('migrateLegacyComponents — 이미 새 shape(material 존재)면 그대로 통과(idempotent)', () => {
    const alreadyNew = { material: 'newspaper', coating: 'scodix', materialIntensity: 0.4, coatingIntensity: 0.9 };
    expect(migrateLegacyComponents(alreadyNew)).toEqual(alreadyNew);
  });

  test('migrateLegacyComponents — texture도 material도 없으면 그대로 통과(신규 유저·빈 저장분)', () => {
    const empty = { layout: 'minimal' };
    expect(migrateLegacyComponents(empty)).toEqual(empty);
  });

  test('migrateLegacyComponents — 매핑 후 죽은 texture/textureIntensity 키를 남기지 않는다(claude-review PR #483 P2)', () => {
    const result = migrateLegacyComponents({ texture: 'hologram', textureIntensity: 0.3, layout: 'minimal' });
    expect(result).not.toHaveProperty('texture');
    expect(result).not.toHaveProperty('textureIntensity');
    expect(result.layout).toBe('minimal');
  });

  test('defaultBrightnessForTexture — 옛 단일축 8종의 기본 밝기가 2축 마이그레이션 후에도 정확히 재현된다(c5, claude-review PR #483 P1)', () => {
    // 옛 FULL_BRIGHTNESS_TEXTURES = {original, vintage, newspaper} → 1.0, 나머지 → 0.5.
    const legacyExpected: Record<string, number> = {
      original: 1.0, none: 0.5, hologram: 0.5, metal: 0.5, scodix: 0.5,
      artpaper: 0.5, vintage: 1.0, newspaper: 1.0,
    };
    for (const [legacy, expected] of Object.entries(legacyExpected)) {
      const mapped = LEGACY_TEXTURE_MIGRATION[legacy];
      expect(defaultBrightnessForTexture(mapped.material, mapped.coating)).toBe(expected);
    }
  });

  test('defaultBrightnessForTexture — 코팅이 있으면(none 아니면) 재질과 무관하게 항상 0.5', () => {
    for (const material of ['original', 'artpaper', 'vintage', 'newspaper']) {
      for (const coating of ['gloss', 'hologram', 'metal', 'scodix']) {
        expect(defaultBrightnessForTexture(material, coating)).toBe(0.5);
      }
    }
  });

  test('defaultBrightnessForTexture — 코팅 없음(none)이면 artpaper만 예외로 0.5, 나머지 재질은 1.0', () => {
    expect(defaultBrightnessForTexture('artpaper', 'none')).toBe(0.5);
    for (const material of ['original', 'vintage', 'newspaper']) {
      expect(defaultBrightnessForTexture(material, 'none')).toBe(1.0);
    }
  });
});

describe('물리재질 종이결(#471) — feTurbulence noise 레시피', () => {
  test('artpaper·vintage·newspaper는 noise 레시피(kind)로 편입돼 슬라이더·저장 게이트가 걸린다', () => {
    for (const t of ['artpaper', 'vintage', 'newspaper']) {
      const recipe = TEXTURE_RECIPES[t];
      expect(recipe).toBeDefined();
      expect(isNoiseRecipe(recipe)).toBe(true);
    }
    // gradient 계열은 noise가 아니다 — 두 계열이 한 맵에서 kind로 분리됨.
    expect(isNoiseRecipe(TEXTURE_RECIPES.hologram)).toBe(false);
  });

  test('noise 레시피에 recipeToGradientCss는 빈 문자열(gradient 없음)', () => {
    expect(recipeToGradientCss(TEXTURE_RECIPES.artpaper, 1)).toBe('');
  });

  test('noiseTileSvg는 stitch되는 fractalNoise 타일 data:URL을 낸다 — 미리보기=저장물 단일 소스', () => {
    const recipe = TEXTURE_RECIPES.newspaper;
    if (!isNoiseRecipe(recipe)) throw new Error('newspaper must be a noise recipe');
    const url = noiseTileSvg(recipe);
    expect(url.startsWith('data:image/svg+xml,')).toBe(true);
    const svg = decodeURIComponent(url.slice('data:image/svg+xml,'.length));
    expect(svg).toContain('feTurbulence');
    expect(svg).toContain('fractalNoise');
    expect(svg).toContain('stitchTiles="stitch"'); // 작은 타일 seam 없는 반복(iOS raster 안전, #439)
    expect(svg).toContain(`baseFrequency="${recipe.baseFrequency}"`);
    expect(svg).toContain(`width="${recipe.tile}"`);
  });
});
