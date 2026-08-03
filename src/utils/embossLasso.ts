/**
 * 자석 올가미(#509 2단계, c10 soft) — 클라 순수 엣지-스냅. 모델·벤더 호출 없이(c4) 포스터
 * 자연 이미지 픽셀에서 Sobel 그라디언트 크기 맵을 한 번 굽고, 드래그 중 커서 주변 작은 창에서
 * 그라디언트가 가장 강한 픽셀로 스냅한다 — Photoshop 자석 올가미의 단순화판(livewire류 경로
 * 최적화 대신 로컬 최댓값 탐색)이라 intelligent scissors 자체는 아니지만, 같은 "엣지에 붙는다"
 * 성질을 클라 계산만으로 낸다.
 *
 * 순수 함수(computeGradientMagnitude/snapToEdge)는 RGBA 버퍼만 받아 DOM 없이 테스트 가능하다.
 * 브라우저 전용 진입점(buildLassoGradientMap)만 canvas/img에 의존한다.
 */

export interface GradientMap {
  data: Float32Array;
  width: number;
  height: number;
}

/** 그레이스케일 Sobel 그라디언트 크기. 가장자리 1px 테두리는 창 밖(0)으로 남긴다(단순화 — 스냅 탐색이 경계를 넘지 않게 snapToEdge가 어차피 클램프한다). */
export function computeGradientMagnitude(rgba: Uint8ClampedArray, width: number, height: number): GradientMap {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    gray[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        gray[i - width - 1] - gray[i - width + 1] + 2 * gray[i - 1] - 2 * gray[i + 1] + gray[i + width - 1] - gray[i + width + 1];
      const gy =
        gray[i - width - 1] + 2 * gray[i - width] + gray[i - width + 1] - gray[i + width - 1] - 2 * gray[i + width] - gray[i + width + 1];
      mag[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return { data: mag, width, height };
}

/**
 * (x,y) 주변 ±radius 창에서 그라디언트가 가장 강한 픽셀로 스냅한다. 창이 전부 맵 경계 밖이면
 * (가장자리 근처) 원래 좌표를 그대로 돌려준다 — 스냅 실패를 "안 붙음"으로 처리해 좌표가
 * 튀지 않게 한다.
 */
export function snapToEdge(map: GradientMap, x: number, y: number, radius: number): { x: number; y: number } {
  const cx = Math.round(x);
  const cy = Math.round(y);
  let bestX = cx;
  let bestY = cy;
  let bestMag = -Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    const ny = cy + dy;
    if (ny < 1 || ny >= map.height - 1) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = cx + dx;
      if (nx < 1 || nx >= map.width - 1) continue;
      const m = map.data[ny * map.width + nx];
      if (m > bestMag) {
        bestMag = m;
        bestX = nx;
        bestY = ny;
      }
    }
  }
  return bestMag > -Infinity ? { x: bestX, y: bestY } : { x, y };
}

/** embossBitmapSvg(EMBOSS_BAKE_PX=512)보다 작게 잡는다 — 그라디언트 계산은 O(px), 트레이스 중 매 포인터move마다 재사용할 정적 맵이라 512는 과함. */
export const LASSO_GRAD_MAP_PX = 200;
/** 스냅 탐색 반경(맵 픽셀 기준). 200px 맵 기준 화면 체감 스냅 반경 ~4%. */
export const LASSO_SNAP_RADIUS_PX = 8;

/**
 * 포스터 `<img>`(자연 픽셀)에서 그라디언트 맵을 굽는다. blob: URL(크롭 결과, c7)이라 same-origin —
 * 교차 출처로 캔버스가 오염되면(CORS) getImageData가 던지는데, 그때는 null을 돌려줘 호출부가
 * 스냅 없이 원좌표 그대로 트레이스하게 한다(엣지-스냅은 향상 기능이지 필수 경로가 아니다).
 */
export function buildLassoGradientMap(img: HTMLImageElement): GradientMap | null {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;
  const aspect = natH / natW;
  const w = aspect >= 1 ? Math.round(LASSO_GRAD_MAP_PX / aspect) : LASSO_GRAD_MAP_PX;
  const h = aspect >= 1 ? LASSO_GRAD_MAP_PX : Math.round(LASSO_GRAD_MAP_PX * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  try {
    const imageData = ctx.getImageData(0, 0, w, h);
    return computeGradientMagnitude(imageData.data, w, h);
  } catch {
    return null;
  }
}
