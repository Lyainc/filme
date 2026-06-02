import type { Worker } from 'tesseract.js';

// Worker singleton — lazy-initialized on first runOcr call, reused thereafter
let workerSingleton: Worker | null = null;

async function getWorker(onProgress?: (p: number) => void): Promise<Worker> {
  if (workerSingleton) return workerSingleton;

  const { createWorker } = await import('tesseract.js');
  workerSingleton = await createWorker('kor', 1, {
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: (m: { status: string; progress: number }) => {
      if (onProgress && typeof m.progress === 'number') {
        onProgress(m.progress);
      }
    },
  });
  return workerSingleton;
}

/**
 * Preprocess a File/Blob into a canvas:
 * - Uses createImageBitmap with imageOrientation 'from-image' to apply EXIF rotation
 * - Converts to greyscale to improve Tesseract accuracy
 */
async function preprocessImage(file: File | Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to get 2D canvas context');
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // Greyscale conversion via pixel manipulation
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Luminance formula (BT.601)
    const grey = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = grey;
    data[i + 1] = grey;
    data[i + 2] = grey;
    // alpha unchanged
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

/**
 * Run Tesseract OCR on a File or Blob.
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
    const canvas = await preprocessImage(file);
    const worker = await getWorker(onProgress);
    const { data } = await worker.recognize(canvas);
    return data.text ?? '';
  } catch (err) {
    console.error('[ocr] runOcr failed:', err);
    return '';
  }
}
