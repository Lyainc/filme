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
 * 대상은 두 계열. gradient 4종(none·hologram·metal·scodix)은 stop/각도/blend로 sheen을 얹고,
 * 물리재질 3종(artpaper·vintage·newspaper)은 SVG feTurbulence(fractalNoise) 종이결을 얹는다(#471).
 * 두 계열이 한 레시피 맵(TEXTURE_RECIPES)에 `kind`로 구분돼 공존하므로, 슬라이더 노출·data-texture·
 * 기본 강도·저장 경로의 `TEXTURE_RECIPES[texture]` 게이트가 양쪽에 동일하게 걸린다.
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

export interface GradientRecipe {
  kind: 'gradient';
  /** gradient 각도(deg, CSS 관례: 0=위, 시계방향) */
  angle: number;
  stops: TextureStop[];
  blend: TextureBlend;
  /** 슬라이더 미조작 시 기본 강도 0..1 */
  defaultIntensity: number;
}

/**
 * 물리재질 종이결(#471) — gradient 대신 SVG feTurbulence(fractalNoise) 노이즈 결(grain)을 얹는다.
 * 미리보기(CSS background-repeat)와 저장(canvas createPattern)이 같은 noiseTileSvg를 렌더해
 * 미리보기=저장물을 맞춘다. 작은 타일을 stitchTiles로 seam 없이 반복해 iOS 큰 raster 함정(#439)을 피한다.
 */
export interface NoiseRecipe {
  kind: 'noise';
  /** feTurbulence baseFrequency — 높을수록 촘촘한 결 */
  baseFrequency: number;
  numOctaves: number;
  /** 종이결 타일 픽셀 크기(작을수록 iOS raster 안전) */
  tile: number;
  blend: TextureBlend;
  /** 강도 100% 기준 grain 세기 0..1 (intensity가 곱해져 오버레이 레이어 opacity가 된다) */
  alpha: number;
  /** 슬라이더 미조작 시 기본 강도 0..1 */
  defaultIntensity: number;
}

export type TextureRecipe = GradientRecipe | NoiseRecipe;

// 세련화 튜닝값(#434) — 실기기 육안 기준. hologram/metal의 blend를 soft-light 계열로 순화해
// 밝은 영역을 태우지 않고(옛 color-dodge/hard-light의 과노출 주범) 은은히 얹히게 했다. soft-light는
// 효과가 약해 alpha를 옛 값보다 올려 보상한다. defaultIntensity는 슬라이더 미조작 시 "바로 예쁜"
// 기본 강도 — 화려한 홀로/메탈은 0.7로 눌러 두고 원하면 슬라이더로 100%까지 올린다. 유광(gloss)은
// 원래 은은해 1.0(INITIAL_STATE.coatingIntensity와 일치시켜 첫 로드 gloss를 100%로).
//
// #475 2축 재설계 — 이 맵의 키는 재질(artpaper·vintage·newspaper)과 코팅(gloss·hologram·metal·
// scodix) 두 축에 걸쳐 있지만 값 자체가 서로 겹치지 않아 한 맵을 공유한다. 옛 단일축의 `none`
// (유광 록)은 코팅축 `gloss`로 개명 — coating='none'(코팅 없음)과 이름이 겹치면 안 돼서다.
// gloss·scodix(코팅)·artpaper(재질)는 [강화 대상](#475 c8) — 인접 옵션과의 구분감을 강화했다.
export const TEXTURE_RECIPES: Record<string, TextureRecipe> = {
  // ── 코팅 축(coating) ──────────────────────────────────────────────────────
  gloss: {
    kind: 'gradient',
    angle: 125,
    blend: 'screen',
    defaultIntensity: 1,
    // [강화] 유광 광택을 "은은한 얼룩"이 아니라 인화지 위 반사광처럼 좁고 밝은 스펙큘러 밴드로 —
    // 폭을 좁히고(30~70%→38~62%) 피크를 올려(0.18→0.42) 광택이 확실히 보이게 한다.
    stops: [
      { at: 0, rgb: [255, 255, 255], alpha: 0 },
      { at: 30, rgb: [255, 255, 255], alpha: 0.05 },
      { at: 42, rgb: [255, 255, 255], alpha: 0.34 },
      { at: 50, rgb: [255, 255, 255], alpha: 0.42 },
      { at: 58, rgb: [255, 255, 255], alpha: 0.34 },
      { at: 70, rgb: [255, 255, 255], alpha: 0.05 },
      { at: 100, rgb: [255, 255, 255], alpha: 0 },
    ],
  },
  hologram: {
    kind: 'gradient',
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
    kind: 'gradient',
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
    kind: 'gradient',
    angle: 135,
    blend: 'overlay',
    defaultIntensity: 0.85,
    // [강화] "부분 UV 광택 스팟"이 뚜렷이 보이게 밴드를 좁히고(40~55%→38~60%) 앞뒤에 대칭 그림자를
    // 둬 엠보싱 스팟처럼 도드라지게, 피크도 올렸다(0.65→0.85).
    stops: [
      { at: 38, rgb: [255, 255, 255], alpha: 0 },
      { at: 44, rgb: [0, 0, 0], alpha: 0.22 },
      { at: 49, rgb: [255, 255, 255], alpha: 0.85 },
      { at: 54, rgb: [0, 0, 0], alpha: 0.18 },
      { at: 60, rgb: [255, 255, 255], alpha: 0 },
    ],
  },
  // ── 재질 축(material) ─────────────────────────────────────────────────────
  // 물리재질 종이결(#471). 값은 실기기 육안 튜닝 — feTurbulence 결은 계산이 아니라 눈으로 맞춘다.
  // ponytail: 대조 시 결이 과하거나 약하면 alpha/defaultIntensity(세기), baseFrequency(촘촘함),
  // blend(overlay=밝고어둡게·soft-light=은은)만 조정. tile은 iOS raster 안전선(작게 유지).
  artpaper: {
    // [강화] 미술용지 결이 metal 코팅과 뭉치던 문제(#475) — baseFrequency를 낮추고(0.55→0.4)
    // numOctaves를 줄여(3→2) 더 굵고 거친 캔버스 결로, alpha를 올려(0.5→0.65) 결이 확실히 보이게
    // 했다. defaultIntensity는 스펙 default_intensity 표(기존 값 재활용) 그대로 0.6 유지 — 세기는
    // alpha가 담당. tile은 iOS raster 안전선 그대로 유지.
    kind: 'noise',
    baseFrequency: 0.4,
    numOctaves: 2,
    tile: 140,
    blend: 'overlay',
    alpha: 0.65,
    defaultIntensity: 0.6,
  },
  vintage: {
    kind: 'noise',
    baseFrequency: 0.9,
    numOctaves: 2,
    tile: 120,
    blend: 'soft-light',
    alpha: 0.55,
    defaultIntensity: 0.5,
  },
  newspaper: {
    kind: 'noise',
    baseFrequency: 0.7,
    numOctaves: 4,
    tile: 110,
    blend: 'overlay',
    alpha: 0.6,
    defaultIntensity: 0.6,
  },
};

/** 슬라이더 미조작 시 그 texture의 기본 강도. 레시피 밖(original/none)이면 1(무의미). */
export function defaultIntensityForTexture(texture: string): number {
  return TEXTURE_RECIPES[texture]?.defaultIntensity ?? 1;
}

/**
 * 레거시 단일 `texture` → 2축({material, coating}) 매핑(#475 c4). 옛 단일축 8종 각각이 어느
 * 재질·코팅 조합이었는지 — original/vintage/newspaper는 코팅 없는 순수 재질, none/hologram/metal/
 * scodix는 재질 없는(original) 순수 코팅이었다.
 */
export const LEGACY_TEXTURE_MIGRATION: Record<string, { material: string; coating: string }> = {
  original: { material: 'original', coating: 'none' },
  none: { material: 'original', coating: 'gloss' },
  hologram: { material: 'original', coating: 'hologram' },
  metal: { material: 'original', coating: 'metal' },
  scodix: { material: 'original', coating: 'scodix' },
  artpaper: { material: 'artpaper', coating: 'none' },
  vintage: { material: 'vintage', coating: 'none' },
  newspaper: { material: 'newspaper', coating: 'none' },
};

// 위 8종 중 코팅 쪽에 실렸던 값들 — 레거시 textureIntensity가 이 값들이면 coatingIntensity로,
// 아니면(재질 쪽) materialIntensity로 싣는다(#475 c4).
const LEGACY_COATING_TEXTURES = new Set(['none', 'hologram', 'metal', 'scodix']);

/**
 * 저장된 컴포넌트 상태(localStorage 임시저장·undo 스냅샷)가 옛 단일 `texture` 필드 shape면
 * `{material, coating, materialIntensity?, coatingIntensity?}`로 매핑해 반환한다(#475 c4). 이미
 * 새 shape(`material` 존재)면 그대로 통과 — 하위호환 마이그레이션은 1회성이라 재적용해도 안전.
 */
export function migrateLegacyComponents(saved: Record<string, unknown>): Record<string, unknown> {
  if (typeof saved.material === 'string') return saved;
  const legacyTexture = typeof saved.texture === 'string' ? saved.texture : undefined;
  if (!legacyTexture) return saved;
  const mapped = LEGACY_TEXTURE_MIGRATION[legacyTexture] ?? LEGACY_TEXTURE_MIGRATION.original;
  const legacyIntensity = typeof saved.textureIntensity === 'number' ? saved.textureIntensity : undefined;
  const onCoating = LEGACY_COATING_TEXTURES.has(legacyTexture);
  // 옛 texture/textureIntensity 키는 걷어낸다 — 남기면 아무도 안 읽는 죽은 필드가 매 saveDraft()마다
  // localStorage에 계속 재기록된다(claude-review PR #483 P2).
  const { texture: _texture, textureIntensity: _textureIntensity, ...rest } = saved;
  return {
    ...rest,
    material: mapped.material,
    coating: mapped.coating,
    ...(legacyIntensity !== undefined
      ? onCoating
        ? { coatingIntensity: legacyIntensity }
        : { materialIntensity: legacyIntensity }
      : {}),
  };
}

/** intensity를 stop alpha에 곱한 rgba 문자열. intensity=0이면 완전 투명. */
function stopToRgba(stop: TextureStop, intensity: number): string {
  const a = stop.alpha * intensity;
  return `rgba(${stop.rgb[0]}, ${stop.rgb[1]}, ${stop.rgb[2]}, ${a})`;
}

/** 미리보기(CSS)용 linear-gradient 문자열. 저장(canvas)은 같은 레시피를 createLinearGradient로 렌더. */
export function recipeToGradientCss(recipe: TextureRecipe, intensity: number): string {
  if (recipe.kind !== 'gradient') return ''; // noise 레시피는 gradient가 없다(noiseTileSvg 사용)
  const stops = recipe.stops.map((s) => `${stopToRgba(s, intensity)} ${s.at}%`).join(', ');
  return `linear-gradient(${recipe.angle}deg, ${stops})`;
}

/**
 * CSS `linear-gradient(Ndeg, …)`의 gradient 라인 양 끝점을, 박스를 0..1로 정규화한 좌표로(#506 c1).
 *
 * CSS 규정: 각도는 0deg=위·시계방향, 라인은 박스 중심을 지나고, 길이는 `|W·sinθ| + |H·cosθ|`
 * (네 꼭짓점이 0%/100% 밖으로 안 나가는 최소 길이). 그래서 **정규화 좌표에도 박스 종횡비가 남는다**
 * — `L/W = |sinθ| + aspect·|cosθ|`. 이게 gradient를 정사각 비트맵 한 장으로 못 굽고 aspect를 굽기
 * 파라미터로 받아야 하는 이유다(정사각으로 구워 늘리면 각도가 전단돼 결과가 달라진다 = c4 위반).
 * 타일 반복이라 종횡비와 무관한 noise 경로와 갈리는 지점이다.
 *
 * 이 함수가 그 기하의 **유일한** 구현이다. 예전엔 프리뷰가 CSS 문자열로, 저장이 손으로 짠 sin/cos
 * 투영으로 같은 기하를 각자 유도했고, 그 이중화가 divergence의 출처였다(#506 배경).
 *
 * @param aspect 박스 H/W.
 */
export function gradientLineEndpoints(
  angle: number,
  aspect: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const t = (angle * Math.PI) / 180;
  const sin = Math.sin(t);
  const cos = Math.cos(t);
  const lenOverW = Math.abs(sin) + aspect * Math.abs(cos);
  // 방향 (sin, -cos) 위로 중심에서 ±L/2. x는 W로, y는 H(=W·aspect)로 나눠 정규화한다.
  const dx = (sin * lenOverW) / 2;
  const dy = (-cos * lenOverW) / 2 / aspect;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
}

/**
 * gradient 굽기 해상도의 긴 변(px) — 레시피가 소유하는 굽기 파라미터(#506 c3).
 *
 * 값 자체보다 **있다는 것**이 중요하다: viewBox만 있는 SVG는 CSS background-image로는 뜨지만
 * `new Image()`로는 고유 크기가 안 서서 저장 경로가 로드에서 막힌다. 512·1024·2048로 바꿔가며
 * 프리뷰를 픽셀 대조했더니 델타가 완전히 동일했다 — 브라우저가 벡터 SVG 배경을 표시 크기에
 * 맞춰 다시 래스터화하므로 이 값은 화질에 안 걸린다. 그래서 작게 둔다.
 */
const GRADIENT_BAKE_PX = 512;

/** 굽기 캐시 — 키는 레시피 + 굽기 파라미터(aspect)까지만. intensity는 합성 시점 스칼라라 키가 아니다(#506 c2). */
const gradientSvgCache = new Map<string, string>();

/**
 * gradient 레시피를 **비트맵 한 장**(SVG data URL)으로 굽는다(#506 c1). 프리뷰는 이 URL을
 * `background-image`로, 저장은 **같은 URL**을 `loadImage` → `drawImage`로 그린다 — 두 경로가 각자
 * 픽셀을 유도하지 않으므로 어긋남이 구조적으로 불가능하다.
 *
 * **intensity=1로 굽는다**(#506 c2). intensity는 전 stop alpha에 곱해지는 스칼라라(`stopToRgba`),
 * 합성 시점에 레이어 알파로 한 번 곱하는 것과 최종 source alpha가 같다. 그래서 강도 슬라이더를
 * 끌어도 재굽기가 없다 — noise 경로가 이미 같은 규율이다(`opacity: alpha × intensity`).
 *
 * `viewBox="0 0 1 1"` + `preserveAspectRatio="none"`이라 박스에 늘려 그리면 정규화 좌표가 그대로
 * 박스 좌표가 된다. 해상도를 안 정하는 이유(c3): gradient는 저주파라 벡터로 두고 소비 시점에
 * 래스터화하는 게 가장 싸다(타일 반복형 noise가 tile px를 갖는 것과 대비).
 *
 * @param aspect 그릴 박스의 H/W. 캐시 키에 들어가므로 호출부가 반올림해서 넘긴다.
 */
export function gradientBitmapSvg(recipe: GradientRecipe, aspect: number): string {
  const key = `${recipe.angle}|${aspect}|${recipe.stops.map((s) => `${s.at},${s.rgb.join('-')},${s.alpha}`).join(';')}`;
  const cached = gradientSvgCache.get(key);
  if (cached) return cached;

  const { x1, y1, x2, y2 } = gradientLineEndpoints(recipe.angle, aspect);
  const stops = recipe.stops
    .map((s) => `<stop offset="${s.at}%" stop-color="rgb(${s.rgb.join(',')})" stop-opacity="${s.alpha}"/>`)
    .join('');
  // **고유 크기(width/height)는 필수다.** viewBox만 있는 SVG는 CSS background-image로는 멀쩡히
  // 뜨지만(`background-size`가 크기를 준다) `new Image()`로 로드하면 고유 크기가 안 서서 저장
  // 경로가 그대로 멈춘다 — 실브라우저에서 export가 "저장 중..."에서 안 끝나는 것으로 잡혔다.
  // 긴 변 512는 굽기 해상도(c3): gradient는 저주파라 이 정도면 늘려도 육안 차이가 없고, 가장
  // 좁은 밴드를 가진 scodix(38~60%, 라인의 22%)도 512 기준 110px이라 계단이 안 보인다.
  const w = aspect >= 1 ? Math.round(GRADIENT_BAKE_PX / aspect) : GRADIENT_BAKE_PX;
  const h = aspect >= 1 ? GRADIENT_BAKE_PX : Math.round(GRADIENT_BAKE_PX * aspect);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1 1" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient></defs>` +
    `<rect width="1" height="1" fill="url(#g)"/>` +
    `</svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  gradientSvgCache.set(key, url);
  return url;
}

/** 캐시 계측용(#506 ac3) — intensity만 바뀔 때 미스가 0인지 테스트가 확인한다. */
export function gradientSvgCacheSize(): number {
  return gradientSvgCache.size;
}

export function isNoiseRecipe(recipe: TextureRecipe): recipe is NoiseRecipe {
  return recipe.kind === 'noise';
}

/**
 * 물리재질 종이결 타일 SVG를 data:URL로(#471). feTurbulence(fractalNoise)를 saturate(0)로 회색 결로
 * 만들고 alpha를 1로 평탄화해 불투명 회색 노이즈 타일을 얻는다 — 세기·색은 오버레이 레이어의
 * opacity·blend·포스터 filter가 정한다. stitchTiles="stitch"로 작은 타일이 seam 없이 반복돼
 * (iOS 큰 raster 함정 회피, #439) CSS background-repeat / canvas createPattern 양쪽에서 같은 결을 낸다.
 * 미리보기(CSS)와 저장(canvas)이 이 한 함수를 공유해 미리보기=저장물을 맞춘다.
 */
export function noiseTileSvg(recipe: NoiseRecipe): string {
  const { tile, baseFrequency, numOctaves } = recipe;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}">` +
    `<filter id="n">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${numOctaves}" stitchTiles="stitch"/>` +
    `<feColorMatrix type="saturate" values="0"/>` +
    `<feComponentTransfer><feFuncA type="discrete" tableValues="1"/></feComponentTransfer>` +
    `</filter>` +
    `<rect width="100%" height="100%" filter="url(#n)"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
