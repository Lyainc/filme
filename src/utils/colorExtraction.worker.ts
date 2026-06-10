/**
 * K-means 클러스터링 전용 Web Worker 엔트리.
 *
 * Turbopack이 `new Worker(new URL('./colorExtraction.worker.ts', import.meta.url))` 패턴을
 * 별도 lazy 청크로 번들한다(초기 페이지 청크에 포함되지 않음).
 * 메인스레드(colorExtraction.ts)에서 transferable ArrayBuffer로 픽셀만 넘겨받고,
 * 클러스터링은 동기 fallback과 동일한 `clusterPixels`를 그대로 실행한다.
 */
import { clusterPixels } from './colorCluster';

interface ClusterRequest {
  id: number;
  buffer: ArrayBuffer;
  k: number;
}

// tsconfig lib가 "dom"이라 `self`가 Window로 타입되므로 worker scope 형태로 좁혀 사용.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ClusterRequest>) => void) | null;
  postMessage: (message: { id: number; colors: string[] }) => void;
};

scope.onmessage = (event) => {
  const { id, buffer, k } = event.data;
  // clusterPixels가 throw하면 Worker 'error' 이벤트로 전파 → 메인스레드가 동기 경로로 fallback.
  const colors = clusterPixels(new Uint8ClampedArray(buffer), k);
  scope.postMessage({ id, colors });
};
