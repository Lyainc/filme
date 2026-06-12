/**
 * K-means 클러스터링을 이용한 이미지 대표 색상 추출 유틸리티
 *
 * 구조(#80): 이미지 디코드/캔버스 샘플링은 DOM API가 필요해 메인스레드에서 수행하고,
 * K-means 클러스터링(~10-40ms)만 Web Worker로 오프로드한다. 픽셀 배열은
 * transferable ArrayBuffer로 전달(복사본을 transfer — 원본은 동기 fallback용으로 보존).
 *
 * Worker 수명: 모듈 스코프 싱글턴. 첫 호출에 lazy 생성 후 재사용(크롭 반복 시
 * 생성/teardown 비용 없음, 태스크당 수십 ms라 상주 비용도 무시 가능). 에러/타임아웃 시
 * terminate 후 영구적으로 동기 경로로 전환 — 두 경로 모두 동일한 `clusterPixels`
 * (colorCluster.ts)를 실행하므로 결과 알고리즘은 항상 같다.
 */
import { clusterPixels } from './colorCluster';

/** Worker 응답 대기 한도. 초과 시 해당 worker를 폐기하고 동기 경로로 전환. */
const WORKER_TIMEOUT_MS = 3000;

let worker: Worker | null = null;
/** 생성 실패·런타임 에러·타임아웃 발생 시 true — 이후 호출은 즉시 동기 경로. */
let workerBroken = false;
let nextRequestId = 0;
/** 요청 id → settle 콜백. 응답/실패 시 제거되므로 pending promise가 누수되지 않는다. */
const pending = new Map<number, (colors: string[] | null) => void>();

/** 진행 중인 요청 전부 null로 settle하고 worker를 폐기한다(이후 영구 동기 fallback). */
function failAllPending() {
  workerBroken = true;
  if (worker) {
    worker.terminate();
    worker = null;
  }
  const settlers: Array<(colors: string[] | null) => void> = [];
  pending.forEach((settle) => settlers.push(settle));
  pending.clear();
  settlers.forEach((settle) => settle(null));
}

/** SSR-safe lazy 싱글턴. Worker 미지원/생성 실패 시 null. */
function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  try {
    // Turbopack(Next 16)이 지원하는 정적 분석 가능 Worker 패턴 — 별도 lazy 청크로 분리됨.
    worker = new Worker(new URL('./colorExtraction.worker.ts', import.meta.url));
    worker.onmessage = (event: MessageEvent<{ id: number; colors: string[] }>) => {
      const settle = pending.get(event.data.id);
      if (settle) {
        pending.delete(event.data.id);
        settle(event.data.colors);
      }
    };
    // 어느 요청에서 났는지 알 수 없으므로 전부 실패 처리 → 각 호출이 동기 경로로 fallback.
    worker.onerror = () => failAllPending();
    return worker;
  } catch {
    workerBroken = true;
    worker = null;
    return null;
  }
}

/**
 * 픽셀 데이터를 Worker로 보내 클러스터링. 실패 시 null(호출부가 동기 fallback).
 * 요청마다 고유 id를 부여하므로 빠른 연속 호출(재크롭)에서도 응답이 섞이지 않는다.
 */
function clusterInWorker(data: Uint8ClampedArray, k: number): Promise<string[] | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(null);

  return new Promise((resolve) => {
    const id = nextRequestId++;
    // 타임아웃 = worker가 멈춘 상태(청크 로드 실패 등) — 뒤 요청들도 막히므로 전부 폐기.
    const timer = setTimeout(() => {
      if (pending.has(id)) failAllPending();
    }, WORKER_TIMEOUT_MS);

    pending.set(id, (colors) => {
      clearTimeout(timer);
      resolve(colors);
    });

    // 복사본의 buffer를 transfer — 원본 data는 동기 fallback에서 그대로 재사용 가능.
    const copy = data.slice();
    try {
      w.postMessage({ id, buffer: copy.buffer, k }, [copy.buffer]);
    } catch {
      failAllPending();
    }
  });
}

/**
 * hex 중복 제거(대소문자 무시). 첫 등장 순서·원본 표기를 유지한다. 평면/단색 비중이
 * 큰 포스터에선 K-means가 같은 색을 두 번 뱉을 수 있는데, 동일 추천색은 사용자에게
 * 무의미할 뿐 아니라 ColorPicker에서 hex가 곧 React key라 중복 시 경고가 난다(#105).
 */
function dedupeHex(colors: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of colors) {
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
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
    img.onload = async () => {
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

        // Worker 우선, 실패(null) 시 동일 알고리즘의 동기 경로로 fallback.
        const workerColors = await clusterInWorker(imageData, k);
        resolve(dedupeHex(workerColors ?? clusterPixels(imageData, k)));
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
