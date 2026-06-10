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

async function waitForImagesLoaded(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      // Already settled (loaded OR errored) — naturalWidth==0 with complete=true means error.
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    })
  );
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
