/**
 * K-means 클러스터링을 이용한 이미지 대표 색상 추출 유틸리티
 */

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * HEX 색상을 RGB 객체로 변환
 */
function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
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
  return (
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * 이미지 URL에서 대표 색상 2개를 추출합니다.
 * @param imageUrl 이미지 소스 (Blob URL 또는 일반 URL)
 * @param k 추출할 색상 개수 (기본값 2)
 */
export async function extractColors(imageUrl: string, k: number = 2): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(['#FFFFFF', '#000000']);
          return;
        }

        // 성능 최적화: 40x40으로 축소 (1600개 샘플)
        const size = 40; 
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imageData = ctx.getImageData(0, 0, size, size).data;
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
          resolve(['#FFFFFF', '#000000']);
          return;
        }

        // K-means++ 스타일 초기화 (최대한 멀리 떨어진 색상 선택)
        let centroids: RGB[] = [];
        centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);

        for (let i = 1; i < k; i++) {
          let maxDist = -1;
          let nextCentroid = pixels[0];
          
          // 각 픽셀에 대해 가장 가까운 중심점과의 거리를 계산하고, 그 중 가장 먼 픽셀 선택
          for (const pixel of pixels) {
            let minDistToAnyCentroid = centroids.reduce(
              (min, c) => Math.min(min, getDistanceSq(pixel, c)), 
              Infinity
            );
            
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
        resolve(centroids.map(rgbToHex));
      } catch (err) {
        console.error('Color extraction error:', err);
        resolve(['#FFFFFF', '#000000']);
      }
    };

    img.onerror = () => {
      resolve(['#FFFFFF', '#000000']);
    };

    img.src = imageUrl;
  });
}
