/**
 * 포스터 후가공 sheen 오버레이의 단일 소스(#434).
 *
 * 미리보기(CSS `mix-blend-mode` + linear-gradient)와 저장(canvas `globalCompositeOperation`
 * + createLinearGradient)이 **같은 레시피**를 각자 렌더해 미리보기=저장물을 보장한다. 저장 경로가
 * 오버레이를 재현하는 이유는 `captureToImage`가 포스터 서브트리(`data-poster-root`)를 통째로
 * 제외하고 canvas 2D로 다시 합성하기 때문 — 그 안의 gradient div였던 옛 TextureOverlay는 저장물에서
 * 통째로 빠졌다(#434 c1, dev 실측 확정). 그래서 blend는 base PNG가 아니라 포스터가 이미 그려진
 * canvas 합성 단계에서만 성립한다.
 *
 * intensity(0..1)는 각 stop alpha에 곱해진다(globalAlpha/CSS opacity를 안 쓰는 이유: 별도
 * 레이어 opacity는 새 stacking context를 만들어 mix-blend-mode 대상을 바꾼다). intensity=0이면
 * 전 stop alpha가 0 → 투명 → 완전 무가공(original)과 동치다.
 *
 * 대상은 gradient 계열 4종(none·hologram·metal·scodix). 물리재질(artpaper·vintage·newspaper)은
 * SVG feTurbulence 결이 필요해 별도 이슈로 분리(#434 후속) — 여기 레시피에 없다.
 *
 * CSS mix-blend-mode 값과 canvas globalCompositeOperation 값은 이름이 동일하다(screen·overlay·
 * soft-light·hard-light·multiply·color-dodge). 두 API가 같은 W3C Compositing/Blending 공식을 쓰나
 * 브라우저 구현 미세차가 있을 수 있어, 최종 일치는 실측으로 확정한다(#434 슬라이스4).
 */

export type TextureBlend =
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'multiply'
  | 'color-dodge';

export interface TextureStop {
  /** gradient 라인상 위치 0..100 (%) */
  at: number;
  rgb: [number, number, number];
  /** 강도 100% 기준 알파 0..1 (intensity가 곱해진다) */
  alpha: number;
}

export interface TextureRecipe {
  /** gradient 각도(deg, CSS 관례: 0=위, 시계방향) */
  angle: number;
  stops: TextureStop[];
  blend: TextureBlend;
  /** 슬라이더 미조작 시 기본 강도 0..1 */
  defaultIntensity: number;
}

// 세련화 튜닝값(#434) — 실기기 육안 기준. hologram/metal의 blend를 soft-light 계열로 순화해
// 밝은 영역을 태우지 않고(옛 color-dodge/hard-light의 과노출 주범) 은은히 얹히게 했다. soft-light는
// 효과가 약해 alpha를 옛 값보다 올려 보상한다. defaultIntensity는 슬라이더 미조작 시 "바로 예쁜"
// 기본 강도 — 화려한 홀로/메탈은 0.7로 눌러 두고 원하면 슬라이더로 100%까지 올린다. 유광(none)은
// 원래 은은해 1.0(INITIAL_STATE.textureIntensity와 일치시켜 첫 로드 none을 100%로).
export const TEXTURE_RECIPES: Record<string, TextureRecipe> = {
  none: {
    angle: 135,
    blend: 'screen',
    defaultIntensity: 1,
    stops: [
      { at: 0, rgb: [255, 255, 255], alpha: 0 },
      { at: 30, rgb: [255, 255, 255], alpha: 0.06 },
      { at: 50, rgb: [255, 255, 255], alpha: 0.18 },
      { at: 70, rgb: [255, 255, 255], alpha: 0.06 },
      { at: 100, rgb: [255, 255, 255], alpha: 0 },
    ],
  },
  hologram: {
    angle: 135,
    blend: 'soft-light',
    defaultIntensity: 0.7,
    stops: [
      { at: 0, rgb: [255, 150, 180], alpha: 0.5 },
      { at: 20, rgb: [255, 210, 150], alpha: 0.5 },
      { at: 40, rgb: [245, 255, 150], alpha: 0.5 },
      { at: 60, rgb: [150, 255, 190], alpha: 0.5 },
      { at: 80, rgb: [150, 210, 255], alpha: 0.5 },
      { at: 100, rgb: [210, 160, 230], alpha: 0.5 },
    ],
  },
  metal: {
    angle: 135,
    blend: 'soft-light',
    defaultIntensity: 0.7,
    stops: [
      { at: 0, rgb: [255, 255, 255], alpha: 0.5 },
      { at: 30, rgb: [180, 190, 200], alpha: 0.12 },
      { at: 50, rgb: [255, 255, 255], alpha: 0.6 },
      { at: 70, rgb: [90, 100, 115], alpha: 0.18 },
      { at: 100, rgb: [25, 35, 50], alpha: 0.45 },
    ],
  },
  scodix: {
    angle: 135,
    blend: 'overlay',
    defaultIntensity: 0.85,
    stops: [
      { at: 40, rgb: [255, 255, 255], alpha: 0 },
      { at: 45, rgb: [0, 0, 0], alpha: 0.12 },
      { at: 50, rgb: [255, 255, 255], alpha: 0.65 },
      { at: 55, rgb: [255, 255, 255], alpha: 0 },
    ],
  },
};

/** 슬라이더 미조작 시 그 texture의 기본 강도. 레시피 밖(original·물리재질)이면 1(무의미). */
export function defaultIntensityForTexture(texture: string): number {
  return TEXTURE_RECIPES[texture]?.defaultIntensity ?? 1;
}

/** intensity를 stop alpha에 곱한 rgba 문자열. intensity=0이면 완전 투명. */
function stopToRgba(stop: TextureStop, intensity: number): string {
  const a = stop.alpha * intensity;
  return `rgba(${stop.rgb[0]}, ${stop.rgb[1]}, ${stop.rgb[2]}, ${a})`;
}

/** 미리보기(CSS)용 linear-gradient 문자열. 저장(canvas)은 같은 레시피를 createLinearGradient로 렌더. */
export function recipeToGradientCss(recipe: TextureRecipe, intensity: number): string {
  const stops = recipe.stops.map((s) => `${stopToRgba(s, intensity)} ${s.at}%`).join(', ');
  return `linear-gradient(${recipe.angle}deg, ${stops})`;
}
