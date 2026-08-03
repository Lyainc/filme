/**
 * #506 — gradient 후가공을 "레시피 1개 → 비트맵 1개"로 굽는 프레임워크.
 *
 * 이 파일이 잠그는 건 두 가지다.
 *  - **c4(보이는 변화 0)**: 새 기하(`gradientLineEndpoints`)가 이주 전 저장 경로의 손으로 짠
 *    sin/cos 투영과 픽셀 단위로 같은 끝점을 낸다. 여기가 갈리면 저장물이 달라진 것이다.
 *  - **c2(intensity는 캐시 키가 아니다)**: 굽기는 intensity=1 고정이라, 강도만 달라져도 재굽기가 없다.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { render, cleanup, act } from '@testing-library/react';
import {
  TEXTURE_RECIPES,
  gradientBitmapSvg,
  gradientLineEndpoints,
  gradientSvgCacheSize,
  EMBOSS_RECIPE,
  embossBitmapSvg,
  embossSvgCacheSize,
  projectEmbossStamps,
  projectEmbossPaths,
  type GradientRecipe,
  type NoiseRecipe,
  type EmbossStamp,
  type EmbossPath,
} from '../src/utils/textureRecipes';
import { posterContentFrac, posterFitRect } from '../src/utils/posterFeather';
import { Poster } from '../src/components/moods/_shared';

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

  test('반올림은 굽기 함수가 소유한다 — 미세하게 갈린 raw aspect가 같은 URL로 수렴', () => {
    // 프리뷰의 getBoundingClientRect 비율과 저장 경로의 bh/bw는 float로 미세하게 갈린다.
    // 반올림이 굽기 함수 안에 있어야 두 경로가 같은 캐시 항목을 친다 — 호출부 어느 한쪽에
    // 반올림을 되돌리면(원래 버그, claude-review PR #643 P1) 여기가 깨진다.
    expect(gradientBitmapSvg(gloss, 1.500041)).toBe(gradientBitmapSvg(gloss, 1.499979));
    // 1e-4보다 크게 갈리면 여전히 다른 비트맵이다 — 반올림이 aspect를 뭉개 각도를 잃으면 안 된다.
    expect(gradientBitmapSvg(gloss, 1.5)).not.toBe(gradientBitmapSvg(gloss, 1.5002));
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

// happy-dom의 getBoundingClientRect는 항상 {0,0,0,0}이다(floatingToolbar.test.tsx와 동일 함정) —
// GradientOverlay/EmbossOverlay는 이 값으로 aspect를 재므로, 0을 그대로 두면 배경 이미지를 아예
// 안 그려 배선 버그를 못 잡는다. 전 엘리먼트를 고정 사각형으로 스텁한다.
const nativeGetBoundingClientRect = Element.prototype.getBoundingClientRect;
function stubGetBoundingClientRect(w: number, h: number): () => void {
  Element.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, top: 0, left: 0, right: w, bottom: h, width: w, height: h, toJSON: () => ({}) } as DOMRect;
  };
  return () => {
    Element.prototype.getBoundingClientRect = nativeGetBoundingClientRect;
  };
}

async function renderPoster(props: Parameters<typeof Poster>[0]) {
  let container!: HTMLElement;
  await act(async () => {
    container = render(<Poster {...props} />).container;
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return container;
}

// GradientOverlay는 _shared.tsx가 export하지 않는 내부 컴포넌트라, aria-hidden 오버레이 div 중
// mix-blend-mode가 걸린 것으로 식별한다(recipe.blend는 항상 걸리므로 그 존재 자체가 오버레이 마커).
//
// backgroundImage **문자열 내용**은 여기서 못 잰다 — happy-dom의 CSSStyleDeclaration setter가
// 이 data URL을 통째로 거부한다(빈 문자열로 되돌아옴). 이진 탐색으로 확정: 굽힌 SVG 안의
// `rgb(255,255,255)` 같은 stop-color 값이 원인이다 — `encodeURIComponent`는 `(`/`)`를 이스케이프
// 안 하는데(JS 사양), happy-dom의 값 파서가 CSS `url("...")` 안에 든 이 괄호를 따옴표로 안 감싸진
// 것처럼 잘못 세어(2>2000 실측: cut 400=OK, cut 800=실패, 경계가 정확히 그 stop-color 자리) 값
// 자체를 버린다. 실브라우저는 인용부호 안 내용을 그대로 보존한다(gradientBitmapSvg가 이미
// production에서 이 방식으로 렌더되고 있고, capture-export.mjs 픽셀 대조가 그린이라는 게 증거).
// 그래서 이 스위트는 "오버레이가 aspect 측정 후 올바른 recipe.blend·intensity로 뜨는가"까지만
// DOM으로 재고, "baked 비트맵 URL 자체가 맞는가"는 위 gradientBitmapSvg 순수 함수 테스트가 맡는다.
function findOverlayDiv(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div[aria-hidden="true"]')).filter(
    (el) => el.style.mixBlendMode !== '',
  );
}

describe('#506 c1 세 번째 소비자(#509) 이전, GradientOverlay 배선 DOM 검증 — 3라운드 반복 지적 갭', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = stubGetBoundingClientRect(960, 600); // aspect = 0.625
  });
  afterEach(() => {
    cleanup();
    restore();
  });

  test('coating이 gradient 레시피면 오버레이 하나가 그 recipe.blend·intensity로 뜬다', async () => {
    const container = await renderPoster({ src: 'blob:x', coating: 'gloss', coatingIntensity: 0.8 });
    const overlays = findOverlayDiv(container);
    expect(overlays).toHaveLength(1);
    expect(overlays[0].style.mixBlendMode).toBe('screen'); // gloss recipe.blend
    expect(overlays[0].style.opacity).toBe('0.8'); // intensity가 그대로 opacity — 재굽기가 아니라 합성 시점 alpha
    // aspect 측정(ref.getBoundingClientRect → useIsomorphicLayoutEffect)이 실제로 반영됐다는 증거 —
    // 이 두 속성은 aspect가 null이 아닐 때만 스프레드되는 조건부 블록 안에 backgroundImage와
    // 나란히 있다(backgroundImage 자체만 happy-dom이 못 읽을 뿐 같은 블록의 형제 값은 읽힌다).
    expect(overlays[0].style.backgroundSize).toBe('100% 100%');
    expect(overlays[0].style.backgroundRepeat).toBe('no-repeat');
  });

  test('material이 noise 레시피면 gradient 오버레이(mix-blend-mode)가 아니라 noiseTileSvg 반복 패턴을 그린다', async () => {
    const container = await renderPoster({ src: 'blob:x', material: 'artpaper', materialIntensity: 1 });
    // noise 레시피는 aspect 측정이 없어 mixBlendMode가 항상 즉시 걸린다(조건부 블록 밖) — gradient
    // 분기(GradientOverlay)와 구분은 backgroundRepeat: 'repeat'(noise) vs 'no-repeat'(gradient, aspect
    // 측정 후)로 낸다.
    const overlays = findOverlayDiv(container);
    expect(overlays).toHaveLength(1);
    expect(overlays[0].style.backgroundRepeat).toBe('repeat');
  });

  test('coating 레시피 밖(none)이면 오버레이 자체가 없다', async () => {
    const container = await renderPoster({ src: 'blob:x', coating: 'none' });
    expect(findOverlayDiv(container)).toHaveLength(0);
  });
});

describe('#509 EmbossOverlay 배선 DOM 검증 — 강도 0 = 완전 무가공(acceptance)', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = stubGetBoundingClientRect(960, 600);
  });
  afterEach(() => {
    cleanup();
    restore();
  });

  test('embossStamps가 있으면 오버레이가 EMBOSS_RECIPE.blend·intensity로 뜬다', async () => {
    const container = await renderPoster({
      src: 'blob:x',
      embossStamps: [{ x: 0.5, y: 0.5, r: 0.1 }],
      embossIntensity: 0.6,
    });
    const overlays = findOverlayDiv(container);
    expect(overlays).toHaveLength(1);
    expect(overlays[0].style.mixBlendMode).toBe(EMBOSS_RECIPE.blend);
    expect(overlays[0].style.opacity).toBe('0.6');
  });

  test('intensity=0이면 오버레이는 뜨되 opacity 0 — CSS 합성상 무가공과 픽셀 동일(acceptance)', async () => {
    const container = await renderPoster({
      src: 'blob:x',
      embossStamps: [{ x: 0.5, y: 0.5, r: 0.1 }],
      embossIntensity: 0,
    });
    const overlays = findOverlayDiv(container);
    expect(overlays).toHaveLength(1);
    expect(overlays[0].style.opacity).toBe('0');
  });

  test('embossStamps가 비었으면 오버레이 자체가 없다(빈 SVG를 안 굽는다)', async () => {
    const container = await renderPoster({ src: 'blob:x', embossStamps: [] });
    expect(findOverlayDiv(container)).toHaveLength(0);
  });
});

describe('#561 artpaper baseFrequency 회귀 — 0.4로 되돌리면 결이 격자무늬로 깨진다', () => {
  test('artpaper.baseFrequency는 0.7 리터럴로 고정된다', () => {
    // 리터럴 기대값 — recipe.baseFrequency를 그대로 읽어 비교하면(textureRecipes.test.ts의 기존
    // noiseTileSvg 테스트) 값 자체가 바뀌어도 항상 통과하는 동어반복이 된다. 0.4/0.55는 Perlin 격자
    // 셀이 2.5px가 돼 결이 아니라 줄무늬로 읽혔다(FFT 축상 에너지 1.38%, newspaper 0.78 대비 이상치) —
    // 0.7이 그 회귀를 되돌린 값이라 리터럴로 잠근다(CLAUDE.md 📏 #561 실측 참고).
    const recipe = TEXTURE_RECIPES.artpaper as NoiseRecipe;
    expect(recipe.kind).toBe('noise');
    expect(recipe.baseFrequency).toBe(0.7);
  });
});

describe('#509 c1 — 형압 비트맵 굽기(#506 프레임워크 세 번째 소비자, noiseTileSvg의 feTurbulence와 동일 규율)', () => {
  const stamps: EmbossStamp[] = [{ x: 0.3, y: 0.5, r: 0.1 }, { x: 0.6, y: 0.4, r: 0.08 }];

  test('스탬프+aspect가 같으면 같은 문자열(캐시 히트) — intensity는 굽기 파라미터가 아니다(합성 시점 alpha)', () => {
    const before = embossSvgCacheSize();
    const a = embossBitmapSvg(stamps, [], 1.5);
    const b = embossBitmapSvg(stamps, [], 1.5);
    expect(a).toBe(b);
    expect(embossSvgCacheSize()).toBe(before + 1);
  });

  test('스탬프 목록이 다르면 다른 비트맵이다', () => {
    expect(embossBitmapSvg(stamps, [], 1.5)).not.toBe(embossBitmapSvg([{ x: 0.5, y: 0.5, r: 0.1 }], [], 1.5));
  });

  test('aspect 반올림은 gradientBitmapSvg와 동일 규율 — 1e-4 이내로 갈린 raw aspect가 같은 URL로 수렴', () => {
    // gradientBitmapSvg 테스트와 달리 emboss는 원 좌표가 aspect가 아니라 굽기 박스 w/h(px 반올림)
    // 로만 정해지므로, 1.5±0.0002 같은 미세 델타는 w=round(512/aspect)를 안 넘겨 반올림 전에도
    // 이미 같은 문자열이 나온다(그 자체로 무해 — 같은 결과가 같은 캐시 키 없이도 같다는 뜻일
    // 뿐이다). 그래서 수렴 주장은 정밀도 경계값(1e-4)로, 발산 주장은 굽기 박스 폭이 실제로
    // 바뀌는 큰 델타로 검증한다.
    expect(embossBitmapSvg(stamps, [], 1.500041)).toBe(embossBitmapSvg(stamps, [], 1.499979));
    expect(embossBitmapSvg(stamps, [], 1.5)).not.toBe(embossBitmapSvg(stamps, [], 1.7));
  });

  test('굽힌 SVG는 라이브 필터가 아니라 정적 data URL — feGaussianBlur+feDiffuseLighting을 담되 canvas drawImage로 소비 가능', () => {
    const url = embossBitmapSvg(stamps, [], 1.5);
    expect(url).toStartWith('data:image/svg+xml,');
    const svg = decodeURIComponent(url.slice('data:image/svg+xml,'.length));
    expect(svg).toStartWith('<svg');
    expect(svg).toContain('feGaussianBlur');
    expect(svg).toContain('feDiffuseLighting');
    // 스탬프 좌표가 원 목록으로 그대로 실린다(포스터 자연 0..1 분율 → 굽기 박스 픽셀로 환산, c7).
    expect((svg.match(/<circle/g) ?? []).length).toBe(stamps.length);
  });

  test('빈 스탬프도 굽기는 되지만(호출부가 게이트) 원이 하나도 없다', () => {
    const svg = decodeURIComponent(embossBitmapSvg([], [], 1.5));
    expect(svg).not.toContain('<circle');
  });

  test('EMBOSS_RECIPE.blend가 합성 시점 mix-blend-mode/globalCompositeOperation 값이다', () => {
    expect(EMBOSS_RECIPE.blend).toBe('overlay');
  });

  test('같은 스트로크의 연속 스탬프는 선(round cap)으로 잇는다 — 겹친 원의 울퉁불퉁한 윤곽 회귀 방지', () => {
    // 실캡처에서 원만 찍으면 겹친 원의 합집합 윤곽이 울퉁불퉁해 블러+조명이 "구슬을 꿴" 것처럼
    // 보였다(EmbossStamp.newStroke 주석) — 연속 스탬프 사이에 선분이 있어야 매끈한 캡슐이 된다.
    const stroke: EmbossStamp[] = [
      { x: 0.3, y: 0.5, r: 0.1, newStroke: true },
      { x: 0.35, y: 0.52, r: 0.1 },
      { x: 0.4, y: 0.54, r: 0.1 },
    ];
    const svg = decodeURIComponent(embossBitmapSvg(stroke, [], 1.5).slice('data:image/svg+xml,'.length));
    expect((svg.match(/<line/g) ?? []).length).toBe(2); // 스탬프 3개 → 이음선 2개
    expect((svg.match(/<circle/g) ?? []).length).toBe(3);
  });

  test('newStroke:true는 앞 스탬프와 안 잇는다 — 스트로크 경계를 건너뛰는 원치 않는 연결선 방지', () => {
    const twoStrokes: EmbossStamp[] = [
      { x: 0.1, y: 0.1, r: 0.1, newStroke: true },
      { x: 0.9, y: 0.9, r: 0.1, newStroke: true }, // 포인터업→다운으로 멀리 떨어진 새 스트로크
    ];
    const svg = decodeURIComponent(embossBitmapSvg(twoStrokes, [], 1.5).slice('data:image/svg+xml,'.length));
    expect(svg).not.toContain('<line'); // 둘 다 newStroke라 잇는 선이 하나도 없어야 한다
    expect((svg.match(/<circle/g) ?? []).length).toBe(2);
  });
});

describe('#509 재매핑 — posterFitRect/posterContentFrac/projectEmbossStamps(fit·align 인식 매핑)', () => {
  test('posterFitRect contain — 가로로 넓은 이미지는 위아래 레터박스(offsetY만 양수)', () => {
    // box 100×100, natAspect=2(가로로 넓음) → 폭에 맞춰 100×50, 세로로 25px씩 남는다.
    const rect = posterFitRect(100, 100, 2, 'contain');
    expect(rect.cw).toBeCloseTo(100, 6);
    expect(rect.ch).toBeCloseTo(50, 6);
    expect(rect.offsetX).toBeCloseTo(0, 6);
    expect(rect.offsetY).toBeCloseTo(25, 6);
  });

  test('posterFitRect cover — 같은 box·natAspect는 좌우로 넘쳐 offsetX가 음수(compositeRaster의 dx와 동일 공식)', () => {
    const rect = posterFitRect(100, 100, 2, 'cover');
    expect(rect.cw).toBeCloseTo(200, 6);
    expect(rect.ch).toBeCloseTo(100, 6);
    expect(rect.offsetX).toBeCloseTo(-50, 6); // 중앙 정렬이라 좌우 50씩 잘림
    expect(rect.offsetY).toBeCloseTo(0, 6);
  });

  test('posterFitRect posX/posY — align="top"(posY=0)이면 offsetY가 항상 0(레터박스가 전부 아래로)', () => {
    const rect = posterFitRect(100, 100, 2, 'contain', 0.5, 0);
    expect(rect.offsetY).toBeCloseTo(0, 6);
  });

  test('posterContentFrac — frameInsetY로 줄어든 img 박스를 root 분율로 되돌린다(#527 minimal 시나리오)', () => {
    // root 960×1534, frameInsetY=22(위아래) → img 박스는 960×1490. natAspect가 그 img 박스와
    // 정확히 같으면(무손실 크롭) 레터박스 0 — fx=0,fw=1, fy는 딱 insetY 분율, fh는 나머지 전부.
    const rootW = 960;
    const rootH = 1534;
    const insetY = 22;
    const imgH = rootH - insetY * 2;
    const natAspect = rootW / imgH;
    const cf = posterContentFrac(rootW, rootH, insetY, imgH, natAspect, 'contain');
    expect(cf.fx).toBeCloseTo(0, 6);
    expect(cf.fw).toBeCloseTo(1, 6);
    expect(cf.fy).toBeCloseTo(insetY / rootH, 6);
    expect(cf.fh).toBeCloseTo(imgH / rootH, 6);
  });

  test('projectEmbossStamps — 자연 분율(u,v,r)을 contentFrac으로 박스 분율로 투영한다', () => {
    const cf = { fx: 0.1, fy: 0.05, fw: 0.8, fh: 0.6 };
    const [projected] = projectEmbossStamps([{ x: 0.5, y: 0.5, r: 0.1, newStroke: true }], cf);
    expect(projected.x).toBeCloseTo(0.1 + 0.5 * 0.8, 6);
    expect(projected.y).toBeCloseTo(0.05 + 0.5 * 0.6, 6);
    expect(projected.r).toBeCloseTo(0.1 * 0.8, 6);
    expect(projected.newStroke).toBe(true);
  });

  test('무드·posterFit이 바뀌어도(contentFrac이 달라져도) 같은 자연 좌표는 각 박스에서 올바른 지점에 투영된다(#509 acceptance)', () => {
    // 시나리오 1: minimal 풀블리드 contain, 무손실 크롭(레터박스 0).
    const cfMinimal = posterContentFrac(960, 1534, 22, 1490, 960 / 1490, 'contain');
    // 시나리오 2: 35mm Wide 926×617 cover, 세로로 크롭된 포스터가 넘어와 좌우가 넘친 경우.
    const cfWide = posterContentFrac(926, 617, 0, 617, 0.6, 'cover');

    const natural: EmbossStamp = { x: 0.5, y: 0.3, r: 0.05 }; // 포스터 상단 근처 한 점
    const [a] = projectEmbossStamps([natural], cfMinimal);
    const [b] = projectEmbossStamps([natural], cfWide);

    // 두 박스에서 나온 픽셀 위치는 서로 다르다(박스 형태가 다르므로 당연) — 하지만 각 박스 안에서
    // 역변환하면 정확히 원래 자연 좌표로 되돌아온다(정합 유지, 폐기 없이도 항상 맞는 지점).
    const invert = (p: { x: number; y: number; r: number }, cf: typeof cfMinimal) => ({
      x: (p.x - cf.fx) / cf.fw,
      y: (p.y - cf.fy) / cf.fh,
      r: p.r / cf.fw,
    });
    expect(invert(a, cfMinimal).x).toBeCloseTo(natural.x, 6);
    expect(invert(a, cfMinimal).y).toBeCloseTo(natural.y, 6);
    expect(invert(b, cfWide).x).toBeCloseTo(natural.x, 6);
    expect(invert(b, cfWide).y).toBeCloseTo(natural.y, 6);
  });
});

describe('#509 2단계(c10) — projectEmbossPaths/embossBitmapSvg 올가미 다각형', () => {
  test('projectEmbossPaths — 다각형 정점 각각을 projectEmbossStamps와 같은 공식으로 투영한다', () => {
    const cf = { fx: 0.1, fy: 0.05, fw: 0.8, fh: 0.6 };
    const path: EmbossPath = { points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] };
    const [projected] = projectEmbossPaths([path], cf);
    expect(projected.points[0]).toEqual({ x: cf.fx, y: cf.fy });
    expect(projected.points[1].x).toBeCloseTo(cf.fx + cf.fw, 6);
    expect(projected.points[2].y).toBeCloseTo(cf.fy + cf.fh, 6);
  });

  test('무드·posterFit이 바뀌어도 같은 자연 다각형은 각 박스에서 올바른 지점으로 투영된다(브러시와 동형, #509 acceptance 5)', () => {
    const cfMinimal = posterContentFrac(960, 1534, 22, 1490, 960 / 1490, 'contain');
    const cfWide = posterContentFrac(926, 617, 0, 617, 0.6, 'cover');
    const natural: EmbossPath = { points: [{ x: 0.4, y: 0.3 }, { x: 0.6, y: 0.3 }, { x: 0.5, y: 0.5 }] };
    const [a] = projectEmbossPaths([natural], cfMinimal);
    const [b] = projectEmbossPaths([natural], cfWide);
    const invert = (p: { x: number; y: number }, cf: typeof cfMinimal) => ({
      x: (p.x - cf.fx) / cf.fw,
      y: (p.y - cf.fy) / cf.fh,
    });
    a.points.forEach((p, i) => {
      expect(invert(p, cfMinimal).x).toBeCloseTo(natural.points[i].x, 6);
      expect(invert(p, cfMinimal).y).toBeCloseTo(natural.points[i].y, 6);
    });
    b.points.forEach((p, i) => {
      expect(invert(p, cfWide).x).toBeCloseTo(natural.points[i].x, 6);
      expect(invert(p, cfWide).y).toBeCloseTo(natural.points[i].y, 6);
    });
  });

  test('embossBitmapSvg — 올가미 다각형이 <polygon>으로, 브러시 스탬프가 <circle>로 같은 SVG에 함께 굽힌다(c5 동시 존재 검증)', () => {
    const stamps: EmbossStamp[] = [{ x: 0.2, y: 0.2, r: 0.05 }];
    const paths: EmbossPath[] = [{ points: [{ x: 0.6, y: 0.6 }, { x: 0.8, y: 0.6 }, { x: 0.7, y: 0.8 }] }];
    const svg = decodeURIComponent(embossBitmapSvg(stamps, paths, 1.5).slice('data:image/svg+xml,'.length));
    expect((svg.match(/<circle/g) ?? []).length).toBe(1);
    expect((svg.match(/<polygon/g) ?? []).length).toBe(1);
    // 다각형도 원과 같은 filter(<g filter="url(#e)">) 안에 있어야 같은 블러+조명 실루엣으로 합쳐진다.
    expect(svg).toMatch(/<g filter="url\(#e\)">[\s\S]*<polygon/);
  });

  test('빈 stamps + 빈 paths면 원도 다각형도 없다(호출부 게이트 전제)', () => {
    const svg = decodeURIComponent(embossBitmapSvg([], [], 1.5));
    expect(svg).not.toContain('<circle');
    expect(svg).not.toContain('<polygon');
  });

  test('stamps는 같고 paths만 다르면 다른 캐시 키(다른 비트맵)다', () => {
    const stamps: EmbossStamp[] = [{ x: 0.5, y: 0.5, r: 0.1 }];
    const pathA: EmbossPath[] = [{ points: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0.05, y: 0.1 }] }];
    const pathB: EmbossPath[] = [{ points: [{ x: 0, y: 0 }, { x: 0.2, y: 0 }, { x: 0.1, y: 0.2 }] }];
    expect(embossBitmapSvg(stamps, pathA, 1.5)).not.toBe(embossBitmapSvg(stamps, pathB, 1.5));
  });
});
