interface CaptureOptions {
  width: number;
  height: number;
  filename: string;
  quality?: number;
  pixelRatio?: number;
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

// html-to-image의 첫 캡처는 콜드 상태에서 노드를 복제·임베드(이미지 인라인·폰트 해석)하는데,
// 그 임베드가 끝나기 전에 결과를 내면 포스터가 빠질 수 있다(#138 항목3 — 미재현이나 위험 경로).
// decodeImage가 원본 <img> 디코드는 보장하지만 복제본 렌더 콜드 미스까지는 못 막아, 버리는
// 워밍업 캡처를 한 번 돌려 경로를 덥힌다.
//
// 워밍업은 "노드의 현재 이미지 src 집합"별로 한 번 돈다 — 세션당 한 번이 아니다. html-to-image의
// 이미지 인라인 캐시는 URL 키 기반이라, 사용자가 포스터·로고를 바꾸면 새 blob URL은 캐시에 없어
// 그다음 캡처(다운로드든 공유든)가 콜드로 떨어진다. 세션 전역 플래그는 첫 포스터만 덥히고 교체
// 이후를 못 막아, 어느 액션을 먼저 누르냐에 따라 포스터가 빠진다(#175: 다운로드 정상·공유 누락,
// #138의 거울 케이스). src 시그니처별로 덥혀 이 순서 의존성을 콘텐츠가 바뀔 때마다 다시 깬다.
const warmedSignatures = new Set<string>();

// 테스트 전용 — 모듈 레벨 워밍업 캐시를 비워 테스트 간 격리를 명시한다(#175 리뷰). 프로덕션 경로엔
// 호출자가 없다.
export function __resetWarmupCacheForTest(): void {
  warmedSignatures.clear();
}

// html-to-image는 노드를 복제·임베드할 때 각 <img>의 src를 스스로 다시 fetch한다 —
// decodeImage()가 보장하는 라이브 비트맵 디코드와는 별개 경로다. 포스터는 blob: URL인데,
// 모바일 Safari는 탭이 백그라운드로 밀리거나 메모리 압박이 오면 앱 모르게 원본 업로드 blob: URL을
// 무효화할 수 있어 재fetch가 조용히 실패하고 포스터 자리만 배경색으로 빠진다(#378). 이미 디코드된
// 라이브 비트맵을 캔버스로 구워 캡처 수명 동안만 사는 새 blob: URL로 바꾸면(아래 blobSrcToObjectUrl)
// 원본 blob 수명과 무관해진다 — data: URL이 아니라 blob: URL로 바꾸는 이유는 그 함수 주석 참고.
// 포스터(data-role="poster")는 알파가 필요 없어 JPEG로 인코딩해 용량을 줄인다(#439 후보①).
// 로고/스탬프(ChainStamp·FormatStamp)는 마커가 없어 PNG로 남아 알파 투명도를 보존한다.
export function blobImageMimeType(img: HTMLImageElement): string {
  return img.dataset.role === 'poster' ? 'image/jpeg' : 'image/png';
}

// iOS Safari는 캔버스 크기가 일정 한계를 넘으면 인코딩이 throw 없이 빈/손상 이미지를 조용히
// 돌려줄 수 있다(#439 후보④) — try/catch로는 못 잡는 실패라 애초에 큰 캔버스를 안 만드는 쪽이
// 방어다. "원본 비율 보존" 포스터(getCroppedImg maxSide: TARGET_HEIGHT*2 = 3068px, stub 무드는
// 항상 이 경로)가 위험권이고, 최종 티켓 출력도 이 해상도로 그릴 일이 없어(캡처 pixelRatio 2
// 기준 최대 변이 약 3100px) 다운스케일에 따른 실질 화질 손실도 없다.
const MAX_BLOB_CANVAS_DIM = 2048;

// html-to-image의 embedImageNode(node_modules/html-to-image/src/embed-images.ts)는 clone된
// <img>의 src가 이미 data: URL이면 "이미 임베드됨"으로 보고 decode/load를 기다리지 않고 곧장
// 반환한다 — canvas.toDataURL()로 만든 data: URL을 캡처 직전 img.src에 심었던 기존 방식(#378)이
// 정확히 이 조건에 걸려, 노드 복제 시 새로 생성되는 clone <img>가 미처 디코드되기 전에
// 직렬화·래스터화가 진행될 수 있었다(#439 후보②의 진짜 정체 — data: 치환 자체가 만든 레이스).
// blob: URL은 이 단축 경로를 안 타 html-to-image가 자기 fetch+decode+requestAnimationFrame
// 대기 경로(embedImageNode의 Promise 블록)를 정상적으로 밟는다. 그래서 data:가 아니라 새
// blob: URL(canvas.toBlob)을 심는다 — 원본 업로드 blob(백그라운드 전환에 무효화될 수 있는,
// #378이 우회하려던 대상)이 아니라 이번 캡처 동안만 사는 새 blob이라 수명 문제도 없다.
// #439 진단 로그 — ?debug=1(DebugConsole)로 실기기 화면에서 바로 본다. 어느 이미지가 어느
// 단계(캔버스 컨텍스트 없음/toBlob 실패/예외)에서 떨어지는지가 반복된 "동일 증상" 재현으로도
// 안 좁혀져서, 원격 디버깅 없이도 실패 지점을 볼 수 있게 임시로 남긴다.
async function blobSrcToObjectUrl(img: HTMLImageElement, mimeType: string): Promise<string | null> {
  const tag = `[capture:blob→blob] role=${img.dataset.role ?? '(none)'} natural=${img.naturalWidth}x${img.naturalHeight}`;
  try {
    const scale = Math.min(1, MAX_BLOB_CANVAS_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn(`${tag} — getContext('2d') null`);
      return null;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType));
    if (!blob) {
      console.warn(`${tag} — toBlob returned null (canvas=${canvas.width}x${canvas.height})`);
      return null;
    }
    console.log(`${tag} — ok canvas=${canvas.width}x${canvas.height} blobBytes=${blob.size}`);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error(`${tag} — threw`, err); // 극히 드문 캔버스 오염 등 — 원래 src(blob:)로 진행
    return null;
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
  // #439 진단 로그(DebugConsole 참고) — decodeImage 자체의 throw 여부·타이밍을 이미지별로 남긴다.
  await Promise.all(images.map(async (img) => {
    try {
      await decodeImage(img);
      console.log(`[capture:decode] ok role=${img.dataset.role ?? '(none)'} natural=${img.naturalWidth}x${img.naturalHeight} src=${img.src.slice(0, 24)}…`);
    } catch (err) {
      console.error(`[capture:decode] FAILED role=${img.dataset.role ?? '(none)'} src=${img.src.slice(0, 24)}…`, err);
      throw err;
    }
  }));

  const { toJpeg } = await import('html-to-image');
  const jpegOptions = buildJpegOptions(width, height, quality, pixelRatio);

  // 현재 이미지 집합을 덥힌 적 없으면 워밍업한다(이미지 없는 노드는 덥힐 게 없어 건너뜀).
  // 결과는 버리고 캐시만 덥힌다. 워밍업은 pixelRatio:1로 돈다 — 임베드 캐시는 URL 키 기반이라
  // 캔버스 해상도와 무관하니 같은 경로를 덥히면서 pixelRatio:2의 ~1/4 메모리만 쓴다. (전체 해상도
  // 워밍업은 iOS Safari per-tab GPU 버젯에서 OOM날 수 있다.) 워밍업 실패는 시그니처에서 도로
  // 빼 다음 캡처가 재시도하게 하고, 본 캡처가 진짜 결과/에러를 내도록 삼킨다.
  // options.filename(무드별로 다름)도 시그니처에 섞는다 — src만 기준이면 같은 포스터로 무드만
  // 바꿔 내보낼 때 새 무드 DOM이 한 번도 안 덥혀진 채로 나간다(#378).
  const signature = images.map((img) => img.src).join('|') + '::' + options.filename;
  if (images.length > 0 && !warmedSignatures.has(signature)) {
    warmedSignatures.add(signature);
    try {
      await toJpeg(node, buildJpegOptions(width, height, quality, 1));
    } catch {
      warmedSignatures.delete(signature);
    }
  }

  // blob: 소스 <img>를 캡처 직전 "새 blob:" URL로 바꿔치기해(원본 업로드 blob의 무효화 위험을
  // 피하면서도 html-to-image의 정상 fetch+decode 대기 경로를 타게) 하고, 캡처가 끝나면
  // (성공/실패 무관) 원래 URL로 복원 + 새로 만든 object URL은 revoke한다.
  // Poster(_shared.tsx)의 contain fit은 블러 배경+전경 두 <img>가 같은 blob src를 공유한다 —
  // src별로 한 번만 캔버스에 그려 인코딩하고 결과를 재사용해, 안 그래도 큰 preserveRatio 포스터를
  // 두 번 굽는 iOS 메모리 압박을 줄인다(#439 후보④).
  const restores: Array<() => void> = [];
  const objectUrlsToRevoke: string[] = [];
  const objectUrlCache = new Map<string, string | null>();
  for (const img of images) {
    if (!img.src.startsWith('blob:')) continue;
    const mimeType = blobImageMimeType(img);
    const cacheKey = `${img.src}::${mimeType}`;
    let objectUrl = objectUrlCache.get(cacheKey);
    if (objectUrl === undefined) {
      // eslint-disable-next-line no-await-in-loop -- 순차 draw 하나뿐, 병렬화할 만큼 무겁지 않음
      objectUrl = await blobSrcToObjectUrl(img, mimeType);
      objectUrlCache.set(cacheKey, objectUrl);
      if (objectUrl) objectUrlsToRevoke.push(objectUrl);
    }
    if (!objectUrl) continue;
    const original = img.src;
    img.src = objectUrl;
    restores.push(() => { img.src = original; });
  }
  console.log(`[capture:main] images=${images.length} substituted=${restores.length} — calling toJpeg`);
  try {
    const result = await toJpeg(node, jpegOptions);
    console.log(`[capture:main] toJpeg ok, dataUrl length=${result.length}`);
    // #439 진단 — DebugConsole(?debug=1)이 공유/저장 이전의 원본 캡처 결과를 화면에 바로 그리게.
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1') {
      window.dispatchEvent(new CustomEvent('capture-debug-result', { detail: result }));
    }
    return result;
  } catch (err) {
    console.error('[capture:main] toJpeg threw', err);
    throw err;
  } finally {
    restores.forEach((restore) => restore());
    objectUrlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
  }
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
