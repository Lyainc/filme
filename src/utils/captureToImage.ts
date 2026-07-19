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

// iOS Safari는 캔버스 크기가 일정 한계를 넘으면 인코딩이 throw 없이 빈/손상 이미지를 조용히
// 돌려줄 수 있다(#439 후보④) — try/catch로는 못 잡는 실패라 애초에 큰 캔버스를 안 만드는 쪽이
// 방어다. "원본 비율 보존" 포스터(getCroppedImg maxSide: TARGET_HEIGHT*2 = 3068px, stub 무드는
// 항상 이 경로)가 위험권이고, 최종 티켓 출력도 이 해상도로 그릴 일이 없어(캡처 pixelRatio 2
// 기준 최대 변이 약 3100px) 다운스케일에 따른 실질 화질 손실도 없다.
const MAX_BLOB_CANVAS_DIM = 2048;

// blob:→data:/blob: src 치환(두 라운드) 모두 캡처 파이프라인 자체(decode·인코딩·toJpeg)는
// 매번 "성공"으로 보고했는데도 실기기 결과물엔 특정 이미지가 여전히 빠졌다(#439, ?debug=1
// 화면 콘솔로 확인) — 원인은 html-to-image가 자기 내부에서 <img>를 clone·임베드하는 경로
// (embed-images.ts) 자체에 있다: 여러 <img>를 하나의 SVG `<foreignObject>`로 직렬화한 뒤
// `<img>`(SVG data URL)로 다시 불러들여 캔버스에 그리는데, 이 "SVG-as-img" 로드가 완료돼도
// WebKit이 foreignObject 안에 중첩된 개별 <img>들의 디코드·페인트까지 보장하진 않는다 —
// 이미지별로 완료 타이밍이 갈려 일부만 빠지는 게 관찰과 정확히 일치한다.
// html-to-image의 canvas 처리 경로(clone-node.ts cloneCanvasElement → util.ts createImage)는
// 이 문제가 없다: canvas.toDataURL()이 "현재 이미 그려진 픽셀"을 동기로 즉시 반환하고, 그
// 결과로 만든 새 <img> 하나만 개별적으로 onload+decode+requestAnimationFrame까지 기다린 뒤
// 클론 트리에 들어간다 — 여러 이미지가 뒤섞인 foreignObject 중첩 렌더 자체가 없다.
// 그래서 이번엔 후보④를 이슈가 원래 제안한 그대로 구현한다 — src만 바꾸는 게 아니라 blob:
// <img> DOM 노드 자체를 미리 그려둔 <canvas>로 치환하고, 캡처가 끝나면 원래 <img>로 되돌린다.
function blobImgToCanvas(img: HTMLImageElement, debug: boolean): HTMLCanvasElement | null {
  try {
    const scale = Math.min(1, MAX_BLOB_CANVAS_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (debug) console.warn(`[capture:img→canvas] role=${img.dataset.role ?? '(none)'} — getContext('2d') null`);
      return null;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // 레이아웃(위치·크기·object-fit·filter 등)은 원본 <img>의 인라인 style을 그대로 복사한다 —
    // canvas도 img/video와 같은 교체 요소라 object-fit/object-position이 동일하게 먹는다.
    canvas.style.cssText = img.style.cssText;
    if (debug) console.log(`[capture:img→canvas] role=${img.dataset.role ?? '(none)'} natural=${img.naturalWidth}x${img.naturalHeight} canvas=${canvas.width}x${canvas.height}`);
    return canvas;
  } catch (err) {
    if (debug) console.error(`[capture:img→canvas] role=${img.dataset.role ?? '(none)'} — threw`, err); // 극히 드문 캔버스 오염 등 — 원래 src(blob:)로 진행
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

  // blob: 소스 <img>를 캡처 직전 미리 그린 <canvas>로 DOM에서 바꿔치기하고(위 blobImgToCanvas
  // 주석 — html-to-image의 foreignObject 중첩 이미지 렌더 레이스를 canvas 경로로 우회), 캡처가
  // 끝나면(성공/실패 무관) 원래 <img> 노드로 되돌린다. Poster의 contain fit은 블러 배경+전경 두
  // <img>가 같은 blob src를 공유하지만, DOM 노드 자체가 둘이라 각자 독립적으로 자기 <img>에서
  // 그려 자기 자리에 들어간다(캔버스는 두 곳에 동시에 존재할 수 없다).
  const swaps: Array<{ original: HTMLImageElement; replacement: HTMLCanvasElement }> = [];
  for (const img of images) {
    if (!img.src.startsWith('blob:')) continue;
    const canvas = blobImgToCanvas(img, debug);
    if (!canvas) continue;
    img.replaceWith(canvas);
    swaps.push({ original: img, replacement: canvas });
  }
  if (debug) console.log(`[capture:main] images=${images.length} swapped=${swaps.length} — calling toJpeg`);
  try {
    const result = await toJpeg(node, jpegOptions);
    if (debug) {
      console.log(`[capture:main] toJpeg ok, dataUrl length=${result.length}`);
      // DebugConsole이 공유/저장 이전의 원본 캡처 결과를 화면에 바로 그리게.
      window.dispatchEvent(new CustomEvent('capture-debug-result', { detail: result }));
    }
    return result;
  } catch (err) {
    if (debug) console.error('[capture:main] toJpeg threw', err);
    throw err;
  } finally {
    swaps.forEach(({ original, replacement }) => replacement.replaceWith(original));
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
