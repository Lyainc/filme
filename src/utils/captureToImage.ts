import { POSTER_EDGE_FEATHER, posterFeatherAxes } from './posterFeather';
import { TEXTURE_RECIPES, isNoiseRecipe, noiseTileSvg } from './textureRecipes';

interface CaptureOptions {
  width: number;
  height: number;
  filename: string;
  quality?: number;
  pixelRatio?: number;
}

// #439 실기기 진단 로그 게이트 — ?debug=1일 때만 켠다. DebugConsole(컴포넌트)이 콘솔을 패치해
// 화면에 보여주는 쪽이라면, 이건 애초에 로그를 만들지 말지를 정하는 발신 쪽 게이트다(claude-review
// PR #458 P1 — 이게 없으면 일반 사용자의 모든 캡처마다 내부 파이프라인 정보가 콘솔에 찍힌다).
function isCaptureDebugEnabled(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
}

// 인쇄 기계가 여백 없는 이미지의 가장자리를 잘라내는 문제 때문에, export 결과물에만 상하좌우
// 흰 여백을 둔다(#382). 프리뷰는 이 함수를 거치지 않는 별도 렌더 경로(TicketRenderer)라
// 자동으로 영향 밖이다. 10px(#449) — 캔버스 자체가 960×1534로 커지면서 여백 포함 신용카드
// 종횡비(0.631)를 맞추려면 20px로는 넘쳐 축소했다.
const EXPORT_MARGIN_PX = 10;

export function buildJpegOptions(
  width: number,
  height: number,
  quality = 0.95,
  pixelRatio = 2
) {
  const marginedWidth = width + EXPORT_MARGIN_PX * 2;
  const marginedHeight = height + EXPORT_MARGIN_PX * 2;
  return {
    quality,
    pixelRatio,
    // width/height는 SVG 캔버스(여백 포함) 크기 — html-to-image가 캡처 노드 자체의 CSS
    // width/height에도 강제로 씌우는 값이라, 노드 실크기는 아래 style.width/height로 되돌린다.
    width: marginedWidth,
    height: marginedHeight,
    canvasWidth: marginedWidth * pixelRatio,
    canvasHeight: marginedHeight * pixelRatio,
    // 캔버스 전체 배경(투명 픽셀 채움 + 여백 프레임 색). 캡처 대상 루트 노드는 배경이 없는
    // 투명 wrapper이고 티켓 배경(무드별 색)은 그 자식이 따로 그리므로, 이 흰색은 여백에만
    // 보이고 티켓 배경은 건드리지 않는다.
    backgroundColor: '#FFFFFF',
    cacheBust: false,
    skipFonts: false,
    style: {
      transform: 'none',
      transformOrigin: '0 0',
      // options.width/height(여백 포함)가 먼저 적용된 뒤 style이 나중에 적용되는 순서를 이용해
      // 노드 실크기를 원본으로 되돌리고, margin으로 여백만큼 오프셋을 준다.
      width: `${width}px`,
      height: `${height}px`,
      margin: `${EXPORT_MARGIN_PX}px`,
    },
    filter: (node: unknown) => {
      if (node instanceof Element && node.hasAttribute('data-hide-on-export')) {
        return false;
      }
      return true;
    },
  };
}

/**
 * 한 이미지가 디코드까지 끝났음을 보장한다. `img.decode()`는 로드+디코드가 모두
 * 끝나야 resolve하고, 실패(로드 에러·디코드 실패) 시 reject한다 — 단순 `complete`
 * 체크나 load 이벤트와 달리 "픽셀을 그릴 준비"까지 기다리므로, blob 포스터가 디코드되기
 * 전에 html-to-image가 캡처해 포스터가 빠지는 콜드 미스를 막는다(#138 항목3).
 *
 * 일시적 디코드 레이스를 흡수하려 1회 재시도하고, 그래도 실패하면 throw해 캡처를
 * 중단한다 — 포스터 없는 티켓을 조용히 내보내는 것보다 명시적 실패가 낫다.
 */
async function decodeImage(img: HTMLImageElement): Promise<void> {
  // 로드가 끝났는데(complete) 픽셀이 0인 이미지는 깨진 것(404·디코드 실패)이라 재시도해도
  // 회복 불가다. 무한·무의미 재시도를 막는 가드 — 이 상태면 즉시 throw해 캡처를 중단한다.
  const isBroken = img.complete && img.naturalWidth === 0;

  // decode() 미지원(구형 브라우저) 폴백 — load/error 이벤트로 settle만 보장.
  if (typeof img.decode !== 'function') {
    // 이미 깨진 채 complete면 조용히 통과하지 말고 throw한다(깨진 이미지 무음 캡처 방지).
    if (isBroken) throw new Error('image failed to load');
    if (img.complete) return;
    await new Promise<void>((resolve, reject) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => reject(new Error('image failed to load')), { once: true });
    });
    return;
  }
  // 이미 깨진 게 확정된 이미지는 decode()를 두 번 돌릴 이유가 없다 — 곧장 실패.
  if (isBroken) throw new Error('image failed to load');
  try {
    await img.decode();
  } catch {
    // 디코드 실패가 깨짐으로 확정됐으면 재시도 없이 throw(무한 재시도 방지). 아니면 일시적
    // 레이스로 보고 1회만 재시도하고, 그래도 실패하면 reject가 그대로 throw돼 캡처를 멈춘다.
    if (img.complete && img.naturalWidth === 0) throw new Error('image failed to load');
    await img.decode();
  }
}

/** data URL을 디코드 완료된 <img>로 로드한다(합성 base PNG를 canvas에 그리기 전 단계). */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => img.decode().then(() => resolve(img)).catch(() => resolve(img));
    img.onerror = () => reject(new Error('composite base image failed to load'));
    img.src = src;
  });
}

// CSS filter 문자열의 모든 px 길이를 pixelRatio로 스케일한다. 인라인 style은 자연(CSS) px 기준인데
// 합성 캔버스는 device px(자연×pixelRatio)라, blur(28px)·drop-shadow 오프셋을 같은 배율로 키워야
// 네이티브와 체감이 같다. saturate·contrast·brightness 등 단위 없는 함수는 그대로 통과한다.
function scaleFilterPx(filter: string, pixelRatio: number): string {
  return filter.replace(/([\d.]+)px/g, (_m, n) => `${parseFloat(n) * pixelRatio}px`);
}

// ─── iOS ctx.filter 우회(#490/#495) ───────────────────────────────────────────
// iOS Safari는 canvas `ctx.filter`를 drawImage에 적용하지 않는다 — 실기기 프로브에서 같은 포스터
// 픽셀을 none/brightness(0.5)로 그린 결과가 (205,192,188)로 **동일**하게 나와 확정됐다. 그래서
// 포스터 색보정(saturate/contrast/brightness…)이 프리뷰(CSS filter)엔 걸리고 저장물엔 빠져,
// 저장 포스터가 프리뷰보다 밝게 나온다. #439가 blur를 ctx.filter에서 떼어낸 것과 동형으로,
// 색보정도 확실히 먹는 경로(getImageData 픽셀 연산)로 옮긴다.
//
// 단 UA 스니핑이 아니라 **실제 능력 검사**로 가른다: ctx.filter가 먹는 환경(데스크톱)은 기존
// 경로를 그대로 타 출력이 바뀌지 않고, 안 먹는 환경(iOS)만 픽셀로 굽는다. 판정 불가(캔버스
// 미지원·getImageData 없음)면 기존 경로로 폴백한다.
let ctxFilterHonored: boolean | null = null;
function isCtxFilterHonored(): boolean {
  if (ctxFilterHonored !== null) return ctxFilterHonored;
  ctxFilterHonored = true; // 알 수 없으면 기존(ctx.filter) 경로 유지
  try {
    const src = document.createElement('canvas');
    src.width = 1;
    src.height = 1;
    const sctx = src.getContext('2d');
    const dst = document.createElement('canvas');
    dst.width = 1;
    dst.height = 1;
    const dctx = dst.getContext('2d');
    if (!sctx || !dctx || typeof dctx.getImageData !== 'function') return ctxFilterHonored;
    sctx.fillStyle = 'rgb(200,200,200)';
    sctx.fillRect(0, 0, 1, 1);
    dctx.filter = 'brightness(0.5)';
    dctx.drawImage(src, 0, 0);
    dctx.filter = 'none';
    // 먹으면 200→100, 드롭되면 200 그대로.
    ctxFilterHonored = dctx.getImageData(0, 0, 1, 1).data[0] < 150;
  } catch {
    /* 기본값(true) 유지 — 진단 실패로 저장 경로를 바꾸지 않는다 */
  }
  return ctxFilterHonored;
}

type ColorOpKind = 'saturate' | 'contrast' | 'brightness' | 'sepia' | 'grayscale';
interface ColorOp { k: ColorOpKind; v: number }

// 포스터가 실제로 쓰는 색보정 함수만 다룬다(_shared.tsx: PRINT_SIM·TEXTURE_FILTERS·brightness
// 슬라이더 → saturate·contrast·brightness·sepia·grayscale, 좌→우 순서·중복 허용). blur는 호출
// 전에 이미 분리돼 여기 오지 않는다. 목록에 없는 함수는 건너뛴다 — 전부 무시되던 기존 iOS
// 동작보다는 항상 낫다.
function parseColorOps(filter: string): ColorOp[] {
  const ops: ColorOp[] = [];
  const re = /(saturate|contrast|brightness|sepia|grayscale)\(\s*([\d.]+)(%?)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(filter)) !== null) {
    const raw = parseFloat(m[2]);
    if (!Number.isFinite(raw)) continue;
    ops.push({ k: m[1] as ColorOpKind, v: m[3] === '%' ? raw / 100 : raw });
  }
  return ops;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * CSS filter 색보정 체인을 픽셀 하나에 적용한다(0..255 in/out). CSS/SVG Filter Effects 스펙의
 * 행렬을 그대로 쓴다 — 프리뷰의 네이티브 CSS filter와 결과가 같아야 저장물이 프리뷰와 일치한다.
 * 각 함수는 하나의 filter primitive라 매 단계 [0,1]로 클램프한다(스펙 동작).
 * export는 순수 함수라 유닛 테스트가 이 수식을 직접 검증하기 위함.
 */
export function applyCssColorFilterToPixel(
  filter: string,
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const px = new Uint8ClampedArray([r, g, b, 255]);
  applyColorOpsInto(parseColorOps(filter), px, 0);
  return [px[0], px[1], px[2]];
}

/** 픽셀을 제자리에서 보정한다 — 수백만 픽셀을 도는 핫 루프라 픽셀당 배열을 만들지 않는다. */
function applyColorOpsInto(ops: ColorOp[], d: Uint8ClampedArray, i: number): void {
  let r = d[i] / 255;
  let g = d[i + 1] / 255;
  let b = d[i + 2] / 255;
  for (const op of ops) {
    const v = op.v;
    if (op.k === 'brightness') {
      r *= v; g *= v; b *= v;
    } else if (op.k === 'contrast') {
      const off = 0.5 - 0.5 * v;
      r = r * v + off; g = g * v + off; b = b * v + off;
    } else if (op.k === 'saturate') {
      const nr = (0.213 + 0.787 * v) * r + (0.715 - 0.715 * v) * g + (0.072 - 0.072 * v) * b;
      const ng = (0.213 - 0.213 * v) * r + (0.715 + 0.285 * v) * g + (0.072 - 0.072 * v) * b;
      const nb = (0.213 - 0.213 * v) * r + (0.715 - 0.715 * v) * g + (0.072 + 0.928 * v) * b;
      r = nr; g = ng; b = nb;
    } else if (op.k === 'grayscale') {
      const k = 1 - v; // v=1이면 완전 휘도
      const nr = (0.2126 + 0.7874 * k) * r + (0.7152 - 0.7152 * k) * g + (0.0722 - 0.0722 * k) * b;
      const ng = (0.2126 - 0.2126 * k) * r + (0.7152 + 0.2848 * k) * g + (0.0722 - 0.0722 * k) * b;
      const nb = (0.2126 - 0.2126 * k) * r + (0.7152 - 0.7152 * k) * g + (0.0722 + 0.9278 * k) * b;
      r = nr; g = ng; b = nb;
    } else {
      const k = 1 - v; // sepia
      const nr = (0.393 + 0.607 * k) * r + (0.769 - 0.769 * k) * g + (0.189 - 0.189 * k) * b;
      const ng = (0.349 - 0.349 * k) * r + (0.686 + 0.314 * k) * g + (0.168 - 0.168 * k) * b;
      const nb = (0.272 - 0.272 * k) * r + (0.534 - 0.534 * k) * g + (0.131 + 0.869 * k) * b;
      r = nr; g = ng; b = nb;
    }
    r = clamp01(r); g = clamp01(g); b = clamp01(b);
  }
  d[i] = Math.round(r * 255);
  d[i + 1] = Math.round(g * 255);
  d[i + 2] = Math.round(b * 255);
}

/**
 * 캔버스 전체 픽셀에 색보정을 구워 넣는다(알파는 건드리지 않는다 — 페더 알파는 이후 단계가 칠한다).
 * ponytail: 픽셀당 op 체인을 도는 단순 루프. 포스터 1장(~5.5M px)에 수백 ms 수준이고 export는
 * 원래 수초짜리 작업이라 충분하다. 느려지면 op 체인을 3×3 행렬 하나로 접는 최적화가 다음 수순.
 */
function bakeColorFilter(ctx: CanvasRenderingContext2D, w: number, h: number, filter: string): void {
  const ops = parseColorOps(filter);
  if (!ops.length || w <= 0 || h <= 0) return;
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue; // 완전 투명은 계산 생략
    applyColorOpsInto(ops, d, i);
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * 색보정을 걸어 raster를 그린다. ctx.filter가 먹는 환경(데스크톱)은 기존 경로 그대로 — 출력이
 * 바뀌지 않는다. 안 먹는 환경(iOS)만 오프스크린에 그려 픽셀로 구운 뒤 얹는다. 메인 캔버스에 직접
 * 굽지 않는 이유 — 그 아래 이미 그려진 픽셀(먼저 합성된 블러 배경 등)까지 같이 보정돼버린다.
 */
function drawImageColorFiltered(
  dctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  filter: string,
): void {
  if (filter === 'none' || isCtxFilterHonored()) {
    dctx.filter = filter;
    dctx.drawImage(src, dx, dy, dw, dh);
    return;
  }
  const w = Math.max(1, Math.round(dw));
  const h = Math.max(1, Math.round(dh));
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const octx = off.getContext('2d');
  if (!octx) {
    dctx.filter = filter; // 오프스크린 실패 — 기존 경로로라도 그린다
    dctx.drawImage(src, dx, dy, dw, dh);
    return;
  }
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(src, 0, 0, w, h);
  bakeColorFilter(octx, w, h, filter);
  dctx.filter = 'none';
  dctx.drawImage(off, dx, dy, dw, dh);
}

/** object-position('x% y%')을 0..1 분율로. 미지정/파싱 실패는 중앙(0.5, 0.5). */
function parseObjectPosition(pos: string): [number, number] {
  const m = pos.match(/([\d.]+)%\s+([\d.]+)%/);
  return m ? [parseFloat(m[1]) / 100, parseFloat(m[2]) / 100] : [0.5, 0.5];
}

// raster <img> 하나를, 브라우저가 자기 박스 안에 그리는 그대로(object-fit·object-position·
// transform:scale·filter 반영) 합성 캔버스에 직접 그린다. 이게 이번 수정의 핵심 — html-to-image의
// foreignObject→SVG→drawImage 경로는 iOS Safari에서 큰 raster를 조용히 떨어뜨리는데(#439, blob/
// data/canvas 세 방식 모두 clone-node.ts가 결국 data:URL <img>로 되돌려 같은 함정으로 수렴),
// 순수 Canvas 2D drawImage는 그 경로를 안 타 iOS에서도 확실히 그려진다.
interface DeviceRect { x: number; y: number; w: number; h: number }

function compositeRaster(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  nodeRect: DOMRect,
  width: number,
  height: number,
  pixelRatio: number,
  ticketRect: DeviceRect,
  debug: boolean,
): void {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (!sw || !sh) return;

  // 캡처 노드는 프리뷰 배율(TicketRenderer의 transform: scale)이 걸려 있어 getBoundingClientRect가
  // 축소된 좌표를 준다. 노드 대비 '분율'로 환산하면 배율이 상쇄돼 자연(layout width/height) 좌표로
  // 되돌아온다. 거기에 export 여백(10px)을 더하고 pixelRatio를 곱해 캔버스 device px 박스를 얻는다.
  const r = img.getBoundingClientRect();
  const fx = (r.left - nodeRect.left) / nodeRect.width;
  const fy = (r.top - nodeRect.top) / nodeRect.height;
  const bx = (EXPORT_MARGIN_PX + fx * width) * pixelRatio;
  const by = (EXPORT_MARGIN_PX + fy * height) * pixelRatio;
  const bw = (r.width / nodeRect.width) * width * pixelRatio;
  const bh = (r.height / nodeRect.height) * height * pixelRatio;

  const fit = img.style.objectFit || 'fill';
  let dw: number;
  let dh: number;
  if (fit === 'contain' || fit === 'cover') {
    // getBoundingClientRect은 CSS transform(예: 블러 배경의 scale(1.2))이 이미 반영된 최종 렌더
    // 박스(bw/bh)를 준다 — 그 박스에 object-fit 배율을 맞추면 transform 확대가 자동으로 흡수되므로,
    // scale을 따로 파싱해 또 곱하면 이중 적용이 된다(claude-review PR #458 P1). 그래서 곱하지 않는다.
    const s = fit === 'contain' ? Math.min(bw / sw, bh / sh) : Math.max(bw / sw, bh / sh);
    dw = sw * s;
    dh = sh * s;
  } else {
    dw = bw;
    dh = bh;
  }
  const [px, py] = parseObjectPosition(img.style.objectPosition || '');
  const dx = bx + (bw - dw) * px;
  const dy = by + (bh - dh) * py;

  // 클립은 raster 박스 ∩ 티켓 내용 영역. blur 배경(transform: scale(1.2))의 렌더 박스가 티켓을
  // 넘어 흰 여백으로 새지 않게 티켓 영역으로 잘라낸다(원본은 poster-root의 overflow:hidden이 담당).
  const cx = Math.max(bx, ticketRect.x);
  const cy = Math.max(by, ticketRect.y);
  const cw = Math.min(bx + bw, ticketRect.x + ticketRect.w) - cx;
  const ch = Math.min(by + bh, ticketRect.y + ticketRect.h) - cy;

  if (debug) {
    console.log(`[capture:composite] role=${img.dataset.role ?? '(none)'} fit=${fit} pos=${img.style.objectPosition || '(none)'} nat=${sw}x${sh} box=${Math.round(bx)},${Math.round(by)},${Math.round(bw)}x${Math.round(bh)} draw=${Math.round(dx)},${Math.round(dy)},${Math.round(dw)}x${Math.round(dh)} filter=${img.style.filter || 'none'}`);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx, cy, cw, ch);
  ctx.clip();

  const filterStr = img.style.filter || '';
  const blurMatch = filterStr.match(/blur\(([\d.]+)px\)/);
  if (blurMatch) {
    // iOS Safari의 canvas `ctx.filter` blur은 큰 반경·큰 캔버스에서 신뢰할 수 없다 — 프리뷰(네이티브
    // CSS blur)엔 나오는 레터박스 블러 배경이 실기기 export 결과물에만 통째로 빠지는 증상으로 확인됐다
    // (#439, ?debug=1 실기기 로그). blur만 `ctx.filter`에서 떼서 다운스케일→업스케일 보간으로 만든다
    // (모든 브라우저에서 확실히 렌더). 색보정(saturate/contrast/brightness)은 blur를 뺀 필터로 그대로
    // ctx.filter에 걸어 유지한다 — 이쪽은 fg 포스터에서 이미 정상 렌더돼 iOS에서도 안전이 확인됐다.
    const blurPx = parseFloat(blurMatch[1]) * pixelRatio;
    const nonBlur = scaleFilterPx(filterStr.replace(/\s*blur\([^)]*\)/, '').trim(), pixelRatio) || 'none';
    // 다운스케일 배율 — 작을수록 더 흐리다. blur 반경에 비례시키되(f≈blurPx/3) 최소 2배는 보장.
    // ponytail: 실기기 육안 기준 배율. 블러 세기가 프리뷰와 어긋나면 이 나눗셈 상수만 조정.
    const f = Math.max(2, Math.round(blurPx / 3));
    const tmp = document.createElement('canvas');
    tmp.width = Math.max(1, Math.round(dw / f));
    tmp.height = Math.max(1, Math.round(dh / f));
    const tctx = tmp.getContext('2d');
    if (tctx) {
      tctx.imageSmoothingEnabled = true;
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
      // iOS는 ctx.filter를 무시하므로(#490/#495) 색보정을 축소 tmp에 직접 굽는다. 업스케일 후가
      // 아니라 축소본에 적용하는 건 픽셀 수가 f² 배 적어 훨씬 싸고, 어차피 크게 흐려질 배경이라
      // 육안 차이가 없기 때문. ctx.filter가 먹는 데스크톱은 아래 기존 경로 그대로.
      const bakeBgColor = nonBlur !== 'none' && !isCtxFilterHonored();
      if (bakeBgColor) bakeColorFilter(tctx, tmp.width, tmp.height, nonBlur);
      ctx.filter = bakeBgColor ? 'none' : nonBlur;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tmp, dx, dy, dw, dh); // 작은 캔버스를 크게 업스케일 → 보간이 블러가 된다
    } else {
      ctx.filter = 'none';
      ctx.drawImage(img, dx, dy, dw, dh);
    }
  } else {
    const scaled = filterStr ? scaleFilterPx(filterStr, pixelRatio) : 'none';
    // 전경 포스터 가장자리 페더(#459) — contain 레터박스 축의 outer feather px를 알파로 흘려
    // 뒤의 블러 배경(먼저 그려진 data-poster-bg)과 잇는다. 프리뷰의 CSS mask-image와 동일 씸
    // (posterFeatherAxes 공유)·동일 세기. canvas destination-in 알파라 iOS의 ctx.filter blur
    // 함정(#439)과 무관하다. 좌우 꽉 차는 축(insetX=0)은 페더 안 걸어 무손실 유지(#439).
    // py(object-position y)를 넘겨 align='top'의 비대칭 레터박스에선 세로 페더를 스킵한다(PR #460 P1).
    const axes = img.dataset.role === 'poster' && fit === 'contain'
      ? posterFeatherAxes(bw, bh, sw / sh, py)
      : { x: false, y: false };
    if (axes.x || axes.y) {
      const F = POSTER_EDGE_FEATHER * pixelRatio;
      const tw = Math.max(1, Math.round(dw));
      const th = Math.max(1, Math.round(dh));
      const tmp = document.createElement('canvas');
      tmp.width = tw;
      tmp.height = th;
      const tctx = tmp.getContext('2d');
      if (tctx) {
        // 색보정은 tmp에 그릴 때 적용(전경 포스터 filter엔 blur 없음). 그다음 destination-in으로
        // 가장자리 알파만 깎고, 메인엔 filter 없이 1:1로 얹는다. iOS는 ctx.filter를 무시하므로
        // (#490/#495) 그린 뒤 픽셀로 굽는다 — tmp가 이미 있어 오프스크린을 더 만들지 않는다.
        if (scaled !== 'none' && !isCtxFilterHonored()) {
          tctx.drawImage(img, 0, 0, tw, th);
          bakeColorFilter(tctx, tw, th, scaled);
        } else {
          tctx.filter = scaled;
          tctx.drawImage(img, 0, 0, tw, th);
          tctx.filter = 'none';
        }
        tctx.globalCompositeOperation = 'destination-in';
        const span = axes.y ? th : tw;
        const grad = axes.y ? tctx.createLinearGradient(0, 0, 0, th) : tctx.createLinearGradient(0, 0, tw, 0);
        const f = Math.min(F, span / 2) / span;
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(f, '#000');
        grad.addColorStop(1 - f, '#000');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.fillStyle = grad;
        tctx.fillRect(0, 0, tw, th);
        ctx.filter = 'none';
        ctx.drawImage(tmp, dx, dy, dw, dh);
      } else {
        drawImageColorFiltered(ctx, img, dx, dy, dw, dh, scaled);
      }
    } else {
      drawImageColorFiltered(ctx, img, dx, dy, dw, dh, scaled);
    }
  }
  ctx.restore();
}

// 후가공 sheen 오버레이를 포스터 위에 canvas blend로 합성한다(#434 c1). 미리보기 TextureOverlay와
// 같은 레시피(textureRecipes)를 쓰되, CSS mix-blend-mode 대신 canvas globalCompositeOperation으로
// (값 이름 동일) 이미 그려진 포스터 픽셀과 블렌드한다. 영역은 poster-root 박스 — 원래 CSS 오버레이가
// inset:0으로 깔리던 그 영역이다. intensity는 stop alpha에 곱해 0이면 아무것도 안 그린다. z-order상
// 포스터(compositeRaster) 다음·base 텍스트 PNG 이전에 호출돼 "포스터 위·텍스트 아래"에 얹힌다.
async function compositeOverlay(
  ctx: CanvasRenderingContext2D,
  root: HTMLElement,
  texture: string,
  intensity: number,
  nodeRect: DOMRect,
  width: number,
  height: number,
  pixelRatio: number,
  debug: boolean,
): Promise<void> {
  const recipe = TEXTURE_RECIPES[texture];
  if (!recipe || intensity <= 0) return;

  // compositeRaster와 동일한 분율 환산 — 프리뷰 scale이 걸린 getBoundingClientRect을 노드 대비
  // 분율로 되돌려 자연 좌표 + export 여백 + device px 박스를 얻는다.
  const r = root.getBoundingClientRect();
  const bx = (EXPORT_MARGIN_PX + ((r.left - nodeRect.left) / nodeRect.width) * width) * pixelRatio;
  const by = (EXPORT_MARGIN_PX + ((r.top - nodeRect.top) / nodeRect.height) * height) * pixelRatio;
  const bw = (r.width / nodeRect.width) * width * pixelRatio;
  const bh = (r.height / nodeRect.height) * height * pixelRatio;

  if (isNoiseRecipe(recipe)) {
    // 물리재질 종이결(#471) — feTurbulence 타일 SVG를 raster화해 poster 박스에 pattern으로 반복한다.
    // 미리보기 CSS background-repeat와 같은 SVG·같은 blend·같은 유효 opacity(alpha×intensity)로
    // 재현한다. 작은 타일(iOS raster 안전, #439)이라 큰 raster drawImage 함정을 안 탄다. 타일을
    // device px(tile×pixelRatio)로 스케일해 프리뷰(CSS px)와 결 크기를 맞춘다. 노이즈는 랜덤이라
    // pattern phase(캔버스 원점 기준)가 프리뷰(박스 기준)와 달라도 육안 무차이 → 위상은 안 맞춘다.
    const tileImg = await loadImage(noiseTileSvg(recipe));
    const dev = Math.max(1, Math.round(recipe.tile * pixelRatio));
    const tile = document.createElement('canvas');
    tile.width = dev;
    tile.height = dev;
    const tctx = tile.getContext('2d');
    if (!tctx) return;
    tctx.drawImage(tileImg, 0, 0, dev, dev);
    const pattern = ctx.createPattern(tile, 'repeat');
    if (!pattern) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();
    ctx.globalCompositeOperation = recipe.blend;
    ctx.globalAlpha = recipe.alpha * intensity; // restore()가 원복
    ctx.fillStyle = pattern;
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
    if (debug) {
      console.log(`[capture:overlay] texture=${texture} noise intensity=${intensity} blend=${recipe.blend} tile=${recipe.tile} box=${Math.round(bx)},${Math.round(by)},${Math.round(bw)}x${Math.round(bh)}`);
    }
    return;
  }

  // CSS linear-gradient 각도(0deg=위, 시계방향) → canvas gradient 라인 두 끝점. 방향 (sinθ, -cosθ),
  // 라인 길이 |W·sinθ|+|H·cosθ|(박스를 완전히 덮는 투영), 중심 기준 대칭. 미리보기 CSS와 같은 기하.
  const t = (recipe.angle * Math.PI) / 180;
  const dirX = Math.sin(t);
  const dirY = -Math.cos(t);
  const len = Math.abs(bw * Math.sin(t)) + Math.abs(bh * Math.cos(t));
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  const grad = ctx.createLinearGradient(
    cx - (dirX * len) / 2,
    cy - (dirY * len) / 2,
    cx + (dirX * len) / 2,
    cy + (dirY * len) / 2,
  );
  for (const s of recipe.stops) {
    grad.addColorStop(s.at / 100, `rgba(${s.rgb[0]}, ${s.rgb[1]}, ${s.rgb[2]}, ${s.alpha * intensity})`);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  ctx.globalCompositeOperation = recipe.blend;
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, bw, bh);
  ctx.restore();

  if (debug) {
    console.log(`[capture:overlay] texture=${texture} intensity=${intensity} blend=${recipe.blend} box=${Math.round(bx)},${Math.round(by)},${Math.round(bw)}x${Math.round(bh)}`);
  }
}

export async function captureNodeToJpeg(
  node: HTMLElement,
  options: CaptureOptions
): Promise<string> {
  const { width, height, quality = 0.95, pixelRatio = 2 } = options;

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }
  const images = Array.from(node.querySelectorAll('img'));
  // #439 진단 로그(DebugConsole, ?debug=1) — decodeImage 자체의 throw 여부·타이밍을 이미지별로
  // 남긴다. isCaptureDebugEnabled()로 게이트해 일반 사용자 콘솔·캡처 경로엔 영향 없다(claude-review
  // PR #458 P1).
  const debug = isCaptureDebugEnabled();
  await Promise.all(images.map(async (img) => {
    try {
      await decodeImage(img);
      if (debug) console.log(`[capture:decode] ok role=${img.dataset.role ?? '(none)'} natural=${img.naturalWidth}x${img.naturalHeight} src=${img.src.slice(0, 24)}…`);
    } catch (err) {
      if (debug) console.error(`[capture:decode] FAILED role=${img.dataset.role ?? '(none)'} src=${img.src.slice(0, 24)}…`, err);
      throw err;
    }
  }));

  // raster <img>(blob:)는 html-to-image의 foreignObject 경로에서 iOS Safari가 조용히 떨어뜨린다
  // (#439 — blob/data/canvas 치환을 세 라운드 시도했으나 clone-node.ts cloneCanvasElement가 canvas
  // 조차 data:URL <img>로 되돌려 셋 다 같은 함정으로 수렴, 실기기에서 매번 동일 실패). 그래서
  // html-to-image엔 포스터 서브트리(data-poster-root)와 로고 <img>를 '제외'하고 나머지(텍스트·
  // 그라데이션·바코드 = 전부 CSS라 안전)만 투명 배경 PNG로 뽑은 뒤, 이미지는 canvas 2D drawImage로
  // 직접 합성한다(compositeRaster). z-order: 포스터(뒤) → CSS 레이어(base) → 로고 스탬프(앞).
  const rasters = images.filter((img) => img.src.startsWith('blob:'));
  const posters = rasters.filter((img) => img.dataset.role === 'poster');
  const stamps = rasters.filter((img) => img.dataset.role !== 'poster');

  // base(CSS 레이어)는 여백 없이 티켓 자연 크기로 뽑는다 — 여백(흰 프레임)은 아래에서 최종 캔버스에
  // 직접 소유한다. html-to-image의 margin+backgroundColor 프레임에 기대면(#382 방식) base를 투명으로
  // 뽑을 때 여백이 조용히 사라져(실기기 확인), 티켓을 여백 안쪽에 배치하고 여백은 흰 fill로 채운다.
  const { toPng } = await import('html-to-image');
  const basePngUrl = await toPng(node, {
    quality,
    pixelRatio,
    width,
    height,
    canvasWidth: width * pixelRatio,
    canvasHeight: height * pixelRatio,
    // 포스터/로고 자리를 투명 구멍으로 남겨야 합성한 raster가 비쳐 보인다.
    backgroundColor: undefined,
    cacheBust: false,
    skipFonts: false,
    style: { transform: 'none', transformOrigin: '0 0' },
    filter: (n: unknown) => {
      if (n instanceof Element && n.hasAttribute('data-hide-on-export')) return false; // 대시 placeholder
      if (n instanceof Element && n.hasAttribute('data-poster-root')) return false; // 포스터 서브트리(배경색 포함)
      if (n instanceof HTMLImageElement && n.src.startsWith('blob:')) return false; // 로고 스탬프 — 직접 합성
      return true;
    },
  });

  const marginDev = EXPORT_MARGIN_PX * pixelRatio;
  const canvas = document.createElement('canvas');
  canvas.width = (width + EXPORT_MARGIN_PX * 2) * pixelRatio;
  canvas.height = (height + EXPORT_MARGIN_PX * 2) * pixelRatio;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  // JPEG는 알파가 없으니 전체를 흰색으로 채운다 — 이게 곧 export 여백(#382·#449) 흰 프레임이 된다.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 티켓 내용 영역(여백 안쪽) — 모든 raster·base를 여기 맞춰 그린다.
  const ticketRect: DeviceRect = { x: marginDev, y: marginDev, w: width * pixelRatio, h: height * pixelRatio };
  const nodeRect = node.getBoundingClientRect();
  // z-order: 포스터(뒤) → CSS 레이어(base) → 로고 스탬프(앞).
  for (const img of posters) compositeRaster(ctx, img, nodeRect, width, height, pixelRatio, ticketRect, debug);
  if (debug) {
    // base를 덮기 전, 레터박스 밴드(티켓 상단 안쪽) 픽셀을 찍어 blur 배경이 실제로 그려졌는지 확인한다
    // — 흰색(255,255,255)에 가까우면 배경 미렌더, 포스터 색이면 정상. #439 레터박스 진단.
    try {
      const p = ctx.getImageData(Math.round(canvas.width / 2), marginDev + 6, 1, 1).data;
      console.log(`[capture:band] topBand rgba=${p[0]},${p[1]},${p[2]},${p[3]}`);
    } catch (err) {
      console.warn('[capture:band] getImageData failed', err);
    }
    // 색 divergence 자가보정(#490/#495 후속) — 저장 포스터가 프리뷰보다 밝은 원인을 iOS 플랫폼 3후보로
    // 가른다: (a) ctx.filter 드롭 (b) blend가 CSS보다 밝게 태움 (c) 색공간. 육안으론 안 갈려 숫자로 찍는다.
    // 같은 포스터 픽셀을 filter 유무로 그려 비교 → brightness(0.5)가 절반이 아니면 iOS가 ctx.filter를 무시.
    // soft-light white/128이 255면 blend no-op. 둘 다 정상이면 색공간(P3) 쪽. #439 blur 우회와 동형 진단.
    try {
      const probe = posters[0];
      if (probe) {
        const sample = (f: string): Uint8ClampedArray | null => {
          const c = document.createElement('canvas');
          c.width = 8;
          c.height = 8;
          const cx = c.getContext('2d');
          if (!cx) return null;
          cx.filter = f;
          cx.drawImage(probe, 0, 0, 8, 8);
          cx.filter = 'none';
          return cx.getImageData(4, 4, 1, 1).data;
        };
        const plain = sample('none');
        const dark = sample('brightness(0.5)');
        if (plain && dark) {
          console.log(`[capture:probe] ctxFilter drawImage none=(${plain[0]},${plain[1]},${plain[2]}) brightness0.5=(${dark[0]},${dark[1]},${dark[2]}) → honored if ~half`);
        }
      }
      const bc = document.createElement('canvas');
      bc.width = 8;
      bc.height = 8;
      const bx = bc.getContext('2d');
      if (bx) {
        bx.fillStyle = 'rgb(128,128,128)';
        bx.fillRect(0, 0, 8, 8);
        bx.globalCompositeOperation = 'soft-light';
        bx.fillStyle = 'rgb(255,255,255)';
        bx.fillRect(0, 0, 8, 8);
        bx.globalCompositeOperation = 'source-over';
        const b = bx.getImageData(4, 4, 1, 1).data;
        console.log(`[capture:probe] soft-light white/128 = ${b[0]} (honored ~180, no-op = 255)`);
      }
    } catch (err) {
      console.warn('[capture:probe] failed', err);
    }
  }
  // 후가공 sheen 오버레이(#434 c1, #475 c2) — 포스터 위·base 텍스트 아래, 재질→코팅 순 2회 합성.
  // poster-root 서브트리는 위 toPng filter에서 제외됐으므로(그 안의 CSS 오버레이도 저장물에서
  // 통째로 빠진다), 여기서 poster-root 박스에 canvas blend로 같은 레시피를 다시 얹어 미리보기=
  // 저장물을 맞춘다. material/coating·강도는 Poster가 data 속성으로 실어보낸다(캡처가 컴포넌트
  // 상태 없이 DOM만으로 재현). 재질을 먼저 그려야 코팅이 그 위(z-order상 위)에 얹힌다(#475 c3).
  const posterRoots = Array.from(node.querySelectorAll('[data-poster-root]')) as HTMLElement[];
  for (const root of posterRoots) {
    const material = root.dataset.material;
    if (material) {
      const rawIntensity = root.dataset.materialIntensity;
      const intensity = rawIntensity != null ? parseFloat(rawIntensity) : 1;
      await compositeOverlay(ctx, root, material, intensity, nodeRect, width, height, pixelRatio, debug);
    }
    const coating = root.dataset.coating;
    if (coating) {
      const rawIntensity = root.dataset.coatingIntensity;
      const intensity = rawIntensity != null ? parseFloat(rawIntensity) : 1;
      await compositeOverlay(ctx, root, coating, intensity, nodeRect, width, height, pixelRatio, debug);
    }
  }
  const baseImg = await loadImage(basePngUrl);
  ctx.drawImage(baseImg, ticketRect.x, ticketRect.y, ticketRect.w, ticketRect.h);
  for (const img of stamps) compositeRaster(ctx, img, nodeRect, width, height, pixelRatio, ticketRect, debug);

  const result = canvas.toDataURL('image/jpeg', quality);
  if (debug) {
    console.log(`[capture:main] posters=${posters.length} stamps=${stamps.length} base=${basePngUrl.length} out=${result.length}`);
    window.dispatchEvent(new CustomEvent('capture-debug-result', { detail: result }));
  }
  return result;
}

// CSP-safe: decode base64 directly without fetch() — Vercel CSP `connect-src` blocks fetch(data:).
export function dataUrlToJpegBlob(dataUrl: string): Blob {
  if (!dataUrl.startsWith('data:image/')) {
    throw new Error('Capture returned empty data URL');
  }
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/jpeg' });
}

/** Web Share API Level 2(파일 공유) 지원 여부. SSR에서는 항상 false. */
export function canShareTicketFile(): boolean {
  if (typeof navigator === 'undefined' || typeof File === 'undefined') return false;
  if (typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') {
    return false;
  }
  try {
    const probe = new File([new Uint8Array(1)], 'phototicket.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * 티켓 노드를 캡처해 OS 공유 시트로 보낸다.
 * 사용자가 공유 시트를 닫으면(AbortError) 에러가 아니라 'cancelled'로 돌려준다.
 */
export async function shareTicketAsJpeg(
  node: HTMLElement,
  options: CaptureOptions & { shareTitle?: string }
): Promise<'shared' | 'cancelled'> {
  const dataUrl = await captureNodeToJpeg(node, options);
  const blob = dataUrlToJpegBlob(dataUrl);
  const file = new File([blob], options.filename, { type: 'image/jpeg' });
  try {
    await navigator.share({ files: [file], title: options.shareTitle ?? options.filename });
    return 'shared';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

export async function downloadTicketAsJpeg(
  node: HTMLElement,
  options: CaptureOptions
): Promise<void> {
  const dataUrl = await captureNodeToJpeg(node, options);
  // Go through Blob + ObjectURL: Chrome rejects very large `data:` hrefs on <a download>
  // and Safari sometimes ignores the download attribute on data URLs.
  const blob = dataUrlToJpegBlob(dataUrl);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = options.filename;
  link.href = objectUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
