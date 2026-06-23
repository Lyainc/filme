interface CaptureOptions {
  width: number;
  height: number;
  filename: string;
  quality?: number;
  pixelRatio?: number;
}

export function buildJpegOptions(
  width: number,
  height: number,
  quality = 0.95,
  pixelRatio = 2
) {
  return {
    quality,
    pixelRatio,
    width,
    height,
    canvasWidth: width * pixelRatio,
    canvasHeight: height * pixelRatio,
    backgroundColor: '#000000',
    cacheBust: false,
    skipFonts: false,
    style: { transform: 'none', transformOrigin: '0 0' },
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

async function waitForImagesLoaded(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(images.map((img) => decodeImage(img)));
}

export async function captureNodeToJpeg(
  node: HTMLElement,
  options: CaptureOptions
): Promise<string> {
  const { width, height, quality = 0.95, pixelRatio = 2 } = options;

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }
  await waitForImagesLoaded(node);

  const { toJpeg } = await import('html-to-image');
  return toJpeg(node, buildJpegOptions(width, height, quality, pixelRatio));
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
