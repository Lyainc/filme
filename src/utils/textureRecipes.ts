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

import type { EmbossContentFrac } from './posterFeather';

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
    // [강화] 미술용지 결이 metal 코팅과 뭉치던 문제(#475) — numOctaves를 줄이고(3→2) alpha를
    // 올려(0.5→0.65) 결이 확실히 보이게 했다. defaultIntensity는 0.6 유지 — 세기는 alpha가 담당.
    // tile은 iOS raster 안전선 그대로 유지.
    //
    // [#561] baseFrequency는 0.55→0.4로 같이 내렸다가 **되올렸다(0.7)**. feTurbulence의 Perlin
    // 격자는 축에 정렬돼 있고 셀 크기가 정확히 1/baseFrequency CSS px라, 0.4에선 2.5px가 돼 결이
    // 아니라 **격자무늬**로 읽혔다(FFT 축상 에너지 1.38%, vintage 0.67·newspaper 0.78 대비 유일한
    // 이상치). numOctaves를 4로 올려도 안 없어지고(1.17%, 주기 5.0px 그대로) baseFrequency만 듣는다.
    // 0.7이면 0.77%로 newspaper와 같은 수준이 되고, **결의 굵기는 안 잃는다** — 국소 표준편차가
    // 14.81→14.93으로 사실상 불변이다(굵기는 위 주석대로 alpha가 담당하지 baseFrequency가 아니다).
    kind: 'noise',
    baseFrequency: 0.7,
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
export function migrateLegacyComponents(input: Record<string, unknown>): Record<string, unknown> {
  // #672로 폐기된 배경 프리셋 id는 무조건 걷어낸다 — 아무도 안 읽는데 남기면 매 saveDraft()마다
  // localStorage에 계속 재기록된다(아래 texture/textureIntensity와 같은 처리, PR #483 P2).
  // 아래 이른 return들보다 **앞**에 서야 한다: 그것들은 이미 현대 저장본을 그대로 돌려보낸다.
  const { backgroundPattern: _backgroundPattern, ...saved } = input;
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
 * CSS gradient의 **premultiplied 알파 보간**을 SVG stop 목록으로 재현한다(#506 c4).
 *
 * CSS `linear-gradient`는 인접 stop 사이를 premultiplied(색×알파) 공간에서 보간하는데, SVG
 * `<linearGradient>`의 `stop-color`/`stop-opacity`는 색과 알파를 **따로** 보간한다. 그래서 색과
 * 알파가 **함께** 변하는 구간에서만 갈린다 — 실측이 그대로다: 색이 고정인 gloss와 알파가 고정인
 * hologram은 기하만 맞추면 max Δ 1(반올림)인데, 둘 다 변하는 metal(18)·scodix(45)만 남았다.
 * 굽는 쪽에서 CSS와 같은 공식으로 촘촘히 샘플링해 그 차이를 없앤다.
 *
 * 샘플 간격은 0.25%다. 1%로 시작했더니 밴드가 제일 좁은 scodix(38~60%, 라인의 22%)만 max Δ 7이
 * 남았고, 0.25%로 줄이니 나머지와 같은 반올림 수준으로 떨어졌다. 원래 stop 위치도 반드시 포함시킨다
 * — 꺾이는 지점이 샘플 격자에 안 걸리면 피크가 뭉개진다.
 */
function premultipliedStops(stops: TextureStop[]): { at: number; rgb: [number, number, number]; alpha: number }[] {
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  const marks: number[] = [];
  for (let t = 0; t <= 400; t += 1) marks.push(t / 4);
  for (const s of sorted) if (!marks.includes(s.at)) marks.push(s.at);
  marks.sort((x, y) => x - y);

  return marks.map((t) => {
    let i = 0;
    while (i < sorted.length - 1 && sorted[i + 1].at < t) i += 1;
    const a = sorted[i];
    const b = sorted[Math.min(i + 1, sorted.length - 1)];
    if (b.at === a.at || t <= a.at) return { at: t, rgb: a.rgb, alpha: a.alpha };
    if (t >= b.at) return { at: t, rgb: b.rgb, alpha: b.alpha };
    const u = (t - a.at) / (b.at - a.at);
    const alpha = a.alpha * (1 - u) + b.alpha * u;
    // premultiplied 보간 후 되나누기. alpha=0이면 색이 무의미하므로 이웃 색을 그대로 쓴다.
    const rgb = (alpha > 0
      ? ([0, 1, 2] as const).map((k) =>
          Math.round((a.rgb[k] * a.alpha * (1 - u) + b.rgb[k] * b.alpha * u) / alpha),
        )
      : [...a.rgb]) as [number, number, number];
    return { at: t, rgb, alpha: Math.round(alpha * 1e4) / 1e4 };
  });
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
 * `aspect` 반올림은 **여기가 소유한다**(claude-review PR #643 P1). 예전엔 프리뷰만 2자리로
 * 반올림하고 저장 경로는 raw `bh/bw`를 넘겨서, 같은 박스인데 캐시 키가 갈려 두 경로가 서로 다른
 * 비트맵을 받았다 — c1("한 비트맵")과 acceptance 4("같은 캐시를 통과")가 문자 그대로는 안 서 있던
 * 자리다. 정밀도가 1e-4인 건 두 요구를 같이 만족하는 지점이라서다: 캐시가 float 지터로 무한히
 * 늘지 않을 만큼 거칠면서, 저장 출력이 안 움직일 만큼 곱다(0.626 캔버스에서 기하 이동 0.03px 미만).
 *
 * @param aspect 그릴 박스의 H/W(raw). 호출부는 반올림하지 않는다.
 */
export function gradientBitmapSvg(recipe: GradientRecipe, rawAspect: number): string {
  const aspect = Math.round(rawAspect * 1e4) / 1e4;
  const key = `${recipe.angle}|${aspect}|${recipe.stops.map((s) => `${s.at},${s.rgb.join('-')},${s.alpha}`).join(';')}`;
  const cached = gradientSvgCache.get(key);
  if (cached) return cached;

  const w = aspect >= 1 ? Math.round(GRADIENT_BAKE_PX / aspect) : GRADIENT_BAKE_PX;
  const h = aspect >= 1 ? GRADIENT_BAKE_PX : Math.round(GRADIENT_BAKE_PX * aspect);
  // 끝점을 **실좌표(userSpaceOnUse)** 로 준다. 기본값 objectBoundingBox는 rect의 bbox를 단위
  // 정사각으로 정규화한 뒤 뷰포트 전단을 얹어 각도가 어긋난다 — 격리 대조에서 밴드 각도가 눈에
  // 띄게 갈리는 것으로 잡혔다(scodix max 149/255). 굽는 캔버스를 목표 박스와 같은 종횡비로 잡고
  // 끝점을 그 픽셀 좌표로 주면, preserveAspectRatio="none" 늘리기가 각도를 보존한다.
  const { x1, y1, x2, y2 } = gradientLineEndpoints(recipe.angle, aspect);
  const stops = premultipliedStops(recipe.stops)
    .map((s) => `<stop offset="${s.at}%" stop-color="rgb(${s.rgb.join(',')})" stop-opacity="${s.alpha}"/>`)
    .join('');
  // **고유 크기(width/height)는 필수다.** viewBox만 있는 SVG는 CSS background-image로는 멀쩡히
  // 뜨지만(`background-size`가 크기를 준다) `new Image()`로 로드하면 고유 크기가 안 서서 저장
  // 경로가 그대로 멈춘다 — 실브라우저에서 export가 "저장 중..."에서 안 끝나는 것으로 잡혔다.
  // 긴 변 512는 굽기 해상도(c3): gradient는 저주파라 이 정도면 늘려도 육안 차이가 없고, 가장
  // 좁은 밴드를 가진 scodix(38~60%, 라인의 22%)도 512 기준 110px이라 계단이 안 보인다.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">` +
    `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" ` +
    `x1="${x1 * w}" y1="${y1 * h}" x2="${x2 * w}" y2="${y2 * h}">${stops}</linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
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
 * 형압(#509) — 사용자가 브러시로 칠한 원형 스탬프의 마스크. 포스터 **자연 이미지** 0..1 분율
 * 좌표(c7) — x/y는 각각 실제 사진 콘텐츠의 폭/높이 기준, r도 그 폭 기준(종횡비가 어떻든 원이
 * 찌그러지지 않는다). 박스(포스터 슬롯) 분율이 아니라 자연 이미지 분율이라 layout(무드)·
 * posterFit("꽉 채우기") 전환처럼 박스와 이미지의 대응 관계 자체가 바뀌는 변경에도 좌표가
 * 안 흔들린다 — 렌더 시점(EmbossOverlay/compositeEmbossOverlay)에 `projectEmbossStamps`가
 * **그 순간의 fit/align**으로 박스 분율로 변환해서 굽는다(#509 재매핑, compositeRaster의
 * dx/dy/dw/dh와 동일 공식). 브러시 입력(EmbossBrushLayer)은 반대 방향 변환(박스 분율 클릭 →
 * 자연 분율)으로 이 좌표계에 맞춰 저장한다.
 *
 * `newStroke`(#509 실측 보정) — 이 스탬프가 포인터다운 직후 첫 스탬프인지. embossBitmapSvg가
 * 이걸로 "앞 스탬프와 선(round cap)으로 이어 매끈한 스트로크를 만들지"를 판정한다. 원만 겹쳐
 * 찍으면(브러시 반경의 30% 간격) 블러+diffuseLighting이 겹친 원의 울퉁불퉁한 합집합 윤곽을 그대로
 * 반영해 "구슬을 꿴" 것처럼 보인다(실캡처로 확인, `docs/PRINT_CALIBRATION.md` 급의 육안 문제라
 * 슬쩍 넘길 수 없었다) — 연속 스탬프를 선분으로 이어 매끈한 캡슐 실루엣을 만들면 사라진다. 새
 * 스트로크의 첫 스탬프는 앞(이전 스트로크의 마지막) 스탬프와 잇지 않아야 하므로 이 플래그가 필요.
 */
export interface EmbossStamp {
  x: number;
  y: number;
  r: number;
  newStroke?: boolean;
}

/**
 * 자연 이미지 분율(EmbossStamp)을 지금 박스의 fit/align 배치 기준 박스 분율로 투영한다(#509
 * 재매핑). embossBitmapSvg는 박스 분율을 그리므로, 굽기 직전 항상 이 함수를 거친다 — 자연
 * 좌표 자체는 안 바뀌고 렌더할 때만 "지금 박스에서 어디에 해당하는지"를 다시 계산하는 것이라
 * layout·posterFit이 바뀌어도 마스크를 버릴 필요가 없다.
 */
export function projectEmbossStamps(stamps: EmbossStamp[], cf: EmbossContentFrac): EmbossStamp[] {
  return stamps.map((s) => ({
    x: cf.fx + s.x * cf.fw,
    y: cf.fy + s.y * cf.fh,
    r: s.r * cf.fw,
    newStroke: s.newStroke,
  }));
}

/**
 * 자석 올가미(#509 2단계, c10 soft)로 그린 닫힌 다각형. 좌표계는 EmbossStamp와 동일 —
 * 포스터 자연 이미지 0..1 분율(c7). 브러시(원형 스탬프 유니온)와 달리 내부를 통째로 채우는
 * 실루엣이라 별도 타입이지만, projectEmbossPaths·embossBitmapSvg가 같은 재투영·굽기 경로를
 * 공유해 layout·posterFit 전환에 안 흔들리는 성질이 브러시와 동형으로 성립한다.
 */
export interface EmbossPath {
  /** 3개 이상, 닫힌 다각형(SVG polygon처럼 첫 점과 마지막 점을 자동으로 잇는다). */
  points: { x: number; y: number }[];
}

/** projectEmbossStamps와 동일한 자연 분율 → 박스 분율 투영을 다각형 정점에 적용한다. */
export function projectEmbossPaths(paths: EmbossPath[], cf: EmbossContentFrac): EmbossPath[] {
  return paths.map((p) => ({
    points: p.points.map((pt) => ({ x: cf.fx + pt.x * cf.fw, y: cf.fy + pt.y * cf.fh })),
  }));
}

/**
 * 균일 융기 베벨 레시피(#509) — material/coating과 달리 이름으로 고르는 프리셋이 아니라
 * 상수 하나다(사용자가 조절하는 건 마스크 모양과 intensity뿐). #591 인쇄 실측 반영: 톤 양 끝
 * 5%가 인쇄에서 붕괴하므로 하이라이트·섀도를 순백/순흑이 아니라 **미드톤 대비**로 잡는다 —
 * midSlope/midIntercept가 feDiffuseLighting 원출력을 gray 0.35~0.7 근방으로 압축한다.
 */
export interface EmbossRecipe {
  kind: 'emboss';
  /** 베벨 폭 — 포스터 폭 기준 분율(feGaussianBlur stdDeviation). */
  bevelFrac: number;
  surfaceScale: number;
  diffuseConstant: number;
  /** feComponentTransfer linear — 원출력을 미드톤 대역으로 눌러 인쇄 톤 붕괴 구간을 피한다. */
  midSlope: number;
  midIntercept: number;
  azimuth: number;
  elevation: number;
  blend: TextureBlend;
  defaultIntensity: number;
}

// 브라우저 실측(300/512/960px 박스 3종 동일 룩 확인)으로 고른 값 — bevelFrac·surfaceScale은
// 굽기 해상도(EMBOSS_BAKE_PX)와 무관하게 같은 비율로 재현된다(SVG 필터가 좌표계 상대이므로
// gradientBitmapSvg의 해상도 무관 실측과 동형). ponytail: 룩이 과하거나 약하면 diffuseConstant
// (세기)·bevelFrac(폭)만 조정 — azimuth/elevation은 광원 방향이라 다른 레시피의 각도(125~135deg
// 사선)와 톤을 맞춘 값.
export const EMBOSS_RECIPE: EmbossRecipe = {
  kind: 'emboss',
  bevelFrac: 0.02,
  surfaceScale: 8,
  diffuseConstant: 1.2,
  midSlope: 0.35,
  midIntercept: 0.35,
  azimuth: 235,
  elevation: 50,
  blend: 'overlay',
  defaultIntensity: 1,
};

/** gradientBitmapSvg와 동일 굽기 해상도 컨벤션(#506 c3) — 벡터/필터 좌표계가 상대적이라 값
 *  자체는 화질에 안 걸린다(실측, 위 EMBOSS_RECIPE 주석). */
const EMBOSS_BAKE_PX = 512;

/**
 * 굽기 캐시 — 키는 스탬프 목록 + aspect까지만(#506 c2, intensity는 합성 시점 alpha).
 *
 * gradient/noise 캐시(레시피 몇 종 × 무드 aspect 몇 종, 유한 키 공간)와 달리 이 캐시의 키
 * 공간은 **살아있는 스탬프 배열**이다 — 브러시 드래그 중 pointermove마다(MIN_STAMP_SPACING로
 * 줄여도 스트로크 하나에 수십 개) 스탬프가 늘어난 새 배열이 매번 새 캐시 키를 치므로, 무제한
 * Map이면 한 세션의 드래그 여러 번으로 항목이 계속 쌓이고(가장 최근 몇 개만 다시 그려지지,
 * 이전 중간 상태는 다시 안 읽힌다) 페이로드 크기도 스탬프 수에 비례해 커진다(fresh-context
 * 리뷰 지적 — 세션 수명 메모리 누수). MAX_EMBOSS_CACHE개를 넘으면 가장 오래된 항목(Map은
 * 삽입 순서를 보존한다)부터 지운다 — 마스크가 세션 한정(c8)이라 캐시도 그 이상 오래 살 필요가
 * 없다.
 */
const MAX_EMBOSS_CACHE = 64;
const embossSvgCache = new Map<string, string>();

/**
 * 형압 마스크(스탬프 목록)를 **비트맵 한 장**으로 굽는다(#509 c1, #506 c2 규율 재사용).
 * 프리뷰는 이 URL을 background-image로, 저장은 같은 URL을 loadImage → drawImage로 그린다.
 *
 * SVG `<filter>`(feGaussianBlur+feDiffuseLighting)를 쓰지만 **라이브 필터가 아니다** — DOM
 * 엘리먼트에 `filter: url(#x)`를 걸어 html-to-image가 캡처해야 하는 방식(c1이 금지하는 것,
 * #495 증상의 원인)이 아니라, 정적 SVG data URL을 `new Image()`로 로드해 canvas
 * `drawImage`로 합성하는 방식 — noiseTileSvg(feTurbulence)가 이미 이 경로로 저장물에
 * 들어가고 있어(#471), 같은 규율의 세 번째 소비자다.
 *
 * 블러(feGaussianBlur)로 마스크 실루엣을 범프맵 삼아 feDiffuseLighting을 걸면, 평평한
 * 중앙(블러 후 알파 기울기 0)은 광원 각도와 무관하게 일정한 톤 — "균일 융기" — 이 되고, 블러
 * 폭만큼의 가장자리 구간만 광원 방향에 따라 밝기/어둡기가 갈린다 — 실물 형압 다이의 "평평한
 * 융기 + 가장자리 베벨" 룩 그대로. feComposite(operator="in", in2=SourceGraphic)로 최종
 * 알파를 원래(블러 전) 원 모양에 맞춰 잘라 경계가 또렷하게 선다.
 *
 * @param stamps 브러시(1단계) 원형 스탬프. stamps·paths가 둘 다 빈 배열이면 호출부가 오버레이
 *   자체를 렌더하지 않아야 한다(빈 SVG를 안 굽는다).
 * @param paths 자석 올가미(2단계, c10) 닫힌 다각형. 같은 filter 아래 stamps와 함께 굽는다 —
 *   두 입력 다 흰 실루엣(union)일 뿐이라 블러+조명 필터엔 출처 구분이 없다.
 * @param rawAspect 그릴 박스의 H/W(raw). gradientBitmapSvg와 동일하게 반올림은 여기서 한다.
 */
export function embossBitmapSvg(stamps: EmbossStamp[], paths: EmbossPath[], rawAspect: number): string {
  const aspect = Math.round(rawAspect * 1e4) / 1e4;
  const stampKey = stamps.map((s) => `${Math.round(s.x * 1e3)},${Math.round(s.y * 1e3)},${Math.round(s.r * 1e3)},${s.newStroke ? 1 : 0}`).join(';');
  const pathKey = paths.map((p) => p.points.map((pt) => `${Math.round(pt.x * 1e3)},${Math.round(pt.y * 1e3)}`).join(' ')).join('|');
  const key = `${aspect}|${stampKey}|${pathKey}`;
  const cached = embossSvgCache.get(key);
  if (cached) return cached;

  const w = aspect >= 1 ? Math.round(EMBOSS_BAKE_PX / aspect) : EMBOSS_BAKE_PX;
  const h = aspect >= 1 ? EMBOSS_BAKE_PX : Math.round(EMBOSS_BAKE_PX * aspect);
  const rec = EMBOSS_RECIPE;
  const bevel = rec.bevelFrac * w;
  // r은 폭(w) 기준(원 유지, 위 EmbossStamp 주석과 동일 근거). 원만 찍으면 겹친 원들의 합집합
  // 윤곽이 울퉁불퉁해 블러+조명이 "구슬 꿴" 모양으로 도드라진다(실측, EmbossStamp.newStroke
  // 주석) — 같은 스트로크의 연속 스탬프는 둥근 캡 선분으로 이어 캡슐 실루엣을 만든다.
  const circles = stamps
    .map((s, i) => {
      const cx = (s.x * w).toFixed(2);
      const cy = (s.y * h).toFixed(2);
      const r = (s.r * w).toFixed(2);
      const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff"/>`;
      const prev = stamps[i - 1];
      if (i === 0 || s.newStroke || !prev) return circle;
      const px = (prev.x * w).toFixed(2);
      const py = (prev.y * h).toFixed(2);
      const strokeW = (Math.max(s.r, prev.r) * w * 2).toFixed(2);
      return `<line x1="${px}" y1="${py}" x2="${cx}" y2="${cy}" stroke="#fff" stroke-width="${strokeW}" stroke-linecap="round"/>${circle}`;
    })
    .join('');
  // 올가미(2단계) — 다각형 내부를 통째로 채운다(원 유니온이 아니라 실루엣 하나). 같은 filter
  // 아래서 브러시 원과 나란히 굽으므로 겹쳐도 하나의 블러+조명 실루엣으로 합쳐진다.
  const polygons = paths
    .map((p) => `<polygon points="${p.points.map((pt) => `${(pt.x * w).toFixed(2)},${(pt.y * h).toFixed(2)}`).join(' ')}" fill="#fff"/>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><filter id="e" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${bevel}" result="blur"/>` +
    `<feDiffuseLighting in="blur" surfaceScale="${rec.surfaceScale}" diffuseConstant="${rec.diffuseConstant}" lighting-color="#ffffff" result="lit">` +
    `<feDistantLight azimuth="${rec.azimuth}" elevation="${rec.elevation}"/></feDiffuseLighting>` +
    `<feComponentTransfer in="lit" result="mid">` +
    `<feFuncR type="linear" slope="${rec.midSlope}" intercept="${rec.midIntercept}"/>` +
    `<feFuncG type="linear" slope="${rec.midSlope}" intercept="${rec.midIntercept}"/>` +
    `<feFuncB type="linear" slope="${rec.midSlope}" intercept="${rec.midIntercept}"/></feComponentTransfer>` +
    `<feComposite in="mid" in2="SourceGraphic" operator="in"/>` +
    `</filter></defs>` +
    `<g filter="url(#e)">${circles}${polygons}</g></svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  if (embossSvgCache.size >= MAX_EMBOSS_CACHE) {
    const oldest = embossSvgCache.keys().next().value;
    if (oldest !== undefined) embossSvgCache.delete(oldest);
  }
  embossSvgCache.set(key, url);
  return url;
}

/** 캐시 계측용(테스트) — gradientSvgCacheSize와 동일 목적. */
export function embossSvgCacheSize(): number {
  return embossSvgCache.size;
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
