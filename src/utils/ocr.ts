import type { Worker } from 'tesseract.js';

// Worker init is deduped via a single in-flight promise so a warm-up call and a
// real runOcr call share one download (the ~15MB kor model loads exactly once).
let workerPromise: Promise<Worker> | null = null;

// Progress callback is module-level (not bound at createWorker time) so that
// warm-up — which starts the download with no callback — doesn't prevent a later
// runOcr from receiving 'recognizing text' progress on the same worker.
let onProgressCb: ((p: number) => void) | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      // All assets are self-hosted from /public/tesseract (vendored by
      // scripts/vendor-tesseract.ts) so the cold-start loads from our own Edge CDN
      // instead of third-party CDNs — removing the slow projectnaptha model fetch.
      // The kor model is 4.0.0_fast (1.0MB vs 6.6MB standard, byte-identical OCR on
      // Korean tickets). OEM 1 = LSTM-only; Tesseract.js picks the matching core.
      return createWorker('kor', 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract',
        langPath: '/tesseract',
        logger: (m: { status: string; progress: number }) => {
          if (onProgressCb && typeof m.progress === 'number') onProgressCb(m.progress);
        },
      });
    })().catch((err) => {
      // Reset so a later call can retry instead of being stuck on a rejected promise.
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Start downloading/initializing the OCR worker ahead of time.
 *
 * The first OCR pays a one-time ~15MB model download (20–40s on a cold cache).
 * Calling this on an intent signal — OCR card hover/focus, or the moment the file
 * picker opens — overlaps that download with the user choosing an image, so the
 * actual recognition (~0.3–1s) feels instant. Safe to call repeatedly; no-op after
 * the first. SSR-safe.
 */
export function warmUpOcr(): void {
  if (typeof window === 'undefined') return;
  void getWorker().catch(() => {
    /* warm-up failures surface on the real runOcr call */
  });
}

/**
 * Preprocess a File/Blob into a canvas, applying EXIF rotation only.
/**
 * Run Tesseract OCR on a File or Blob.
 *
 * The file is fed to Tesseract DIRECTLY (no canvas/greyscale preprocessing).
 * These tickets are app screenshots — colored text on colored backgrounds —
 * and Tesseract reads the original encoded image far better than a canvas:
 * routing pixels through a <canvas> shifts them (color-profile/gamma) and breaks
 * Korean title glyphs (e.g. '콜럼버스' → noise), whereas the raw image decode
 * path preserves titles (maximizing KOBIS auto-lookup) and avoids fabricating
 * wrong times. Greyscale/contrast-stretch made it worse on every sample.
 * Trade-off: EXIF-rotated camera photos aren't auto-rotated, which is fine for a
 * screenshot-oriented feature. See scripts/test-ocr.ts for the comparison.
 *
 * Returns raw Korean text, or '' on failure.
 * Never throws — all errors are caught and logged to console.error.
 * SSR-safe: returns '' immediately when called outside a browser context.
 *
 * @param file      Image file (PNG / JPEG / WebP recommended)
 * @param onProgress  Optional progress callback (0–1)
 */
export async function runOcr(
  file: File | Blob,
  onProgress?: (p: number) => void
): Promise<string> {
  if (typeof window === 'undefined') return '';

  try {
    onProgressCb = onProgress ?? null;
    const worker = await getWorker();
    const { data } = await worker.recognize(file);
    return data.text ?? '';
  } catch (err) {
    console.error('[ocr] runOcr failed:', err);
    return '';
  } finally {
    onProgressCb = null;
  }
}
