/**
 * K-means 클러스터링 순수 코어 — DOM 의존성 없음.
 *
 * `colorExtraction.ts`(메인스레드 동기 fallback)와 `colorExtraction.worker.ts`(Web Worker)가
 * 이 함수 하나를 공유하므로 두 경로의 알고리즘이 구조적으로 동일하다(drift 불가).
 *
 * 결정성: K-means++ 초기화의 첫 중심점은 기존 동기 구현 그대로 `Math.random()` 픽 —
 * 알고리즘/시드 정책을 바꾸지 않고 원래의 비결정성을 그대로 보존한다(#80 수용 기준).
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * RGB를 HEX 색상으로 변환
 */
function rgbToHex(rgb: RGB): string {
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * 두 RGB 색상 간의 거리(유클리드 거리 제곱 - 성능 최적화) 계산
 */
function getDistanceSq(c1: RGB, c2: RGB): number {
  // 업로드당 ~25,600회 호출 — Math.pow(x,2) 대신 곱셈으로.
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * RGBA 픽셀 배열에서 대표 색상 k개를 K-means로 추출합니다.
 * @param imageData RGBA 순서의 픽셀 데이터 (canvas `getImageData().data` 형태)
 * @param k 추출할 색상 개수 (기본값 2)
 * @returns HEX 색상 배열. 불투명 픽셀이 없으면 ['#FFFFFF', '#000000']
 */
export function clusterPixels(imageData: Uint8ClampedArray | number[], k: number = 2): string[] {
  const pixels: RGB[] = [];

  // 픽셀 데이터 수집 (알파값이 128 이상인 불투명 픽셀만 샘플링)
  for (let i = 0; i < imageData.length; i += 4) {
    if (imageData[i + 3] > 128) {
      pixels.push({
        r: imageData[i],
        g: imageData[i + 1],
        b: imageData[i + 2],
      });
    }
  }

  if (pixels.length === 0) {
    return ['#FFFFFF', '#000000'];
  }

  // K-means++ 스타일 초기화 (최대한 멀리 떨어진 색상 선택)
  let centroids: RGB[] = [];
  centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);

  for (let i = 1; i < k; i++) {
    let maxDist = -1;
    let nextCentroid = pixels[0];

    // 각 픽셀에 대해 가장 가까운 중심점과의 거리를 계산하고, 그 중 가장 먼 픽셀 선택
    for (const pixel of pixels) {
      // reduce 클로저 대신 인라인 min 스캔 (픽셀 × 중심점 루프라 호출 빈도 높음)
      let minDistToAnyCentroid = Infinity;
      for (const c of centroids) {
        const dist = getDistanceSq(pixel, c);
        if (dist < minDistToAnyCentroid) minDistToAnyCentroid = dist;
      }

      if (minDistToAnyCentroid > maxDist) {
        maxDist = minDistToAnyCentroid;
        nextCentroid = pixel;
      }
    }
    centroids.push(nextCentroid);
  }

  const maxIterations = 8; // 반복 횟수 최적화
  for (let iter = 0; iter < maxIterations; iter++) {
    const clusters: RGB[][] = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let closestIndex = 0;

      for (let i = 0; i < k; i++) {
        const dist = getDistanceSq(pixel, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          closestIndex = i;
        }
      }
      clusters[closestIndex].push(pixel);
    }

    let changed = false;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue;

      const sum = clusters[i].reduce((acc, p) => ({
        r: acc.r + p.r,
        g: acc.g + p.g,
        b: acc.b + p.b
      }), { r: 0, g: 0, b: 0 });

      const newCentroid = {
        r: sum.r / clusters[i].length,
        g: sum.g / clusters[i].length,
        b: sum.b / clusters[i].length
      };

      if (getDistanceSq(centroids[i], newCentroid) > 4) { // 이동 거리 임계값
        centroids[i] = newCentroid;
        changed = true;
      }
    }

    if (!changed) break;
  }

  // 최종 색상들 간의 대비를 위해 정렬하거나 보정 가능 (여기서는 단순 반환)
  return centroids.map(rgbToHex);
}
