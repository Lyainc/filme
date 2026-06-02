/**
 * Vendors Tesseract.js assets into public/tesseract/ so the browser loads them
 * from our own origin (Vercel Edge CDN) instead of third-party CDNs:
 *   - worker.min.js + core wasm  ← copied from node_modules (version-pinned deps)
 *   - kor.traineddata.gz (fast)  ← downloaded once, then committed to the repo
 *
 * This removes the slow/unreliable projectnaptha model fetch from the cold-start
 * path. OCR still runs 100% client-side; only the static assets move origin.
 * Runs in predev/prebuild (idempotent: copies are cheap, the model is skipped
 * when already present). Output is gitignored except the committed model.
 */
import { mkdirSync, copyFileSync, existsSync, readdirSync, writeFileSync, statSync, rmSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dir, '..');
const OUT = resolve(ROOT, 'public/tesseract');
const CORE_DIR = resolve(ROOT, 'node_modules/tesseract.js-core');
const WORKER = resolve(ROOT, 'node_modules/tesseract.js/dist/worker.min.js');

// 4.0.0_fast: 1.0MB vs 6.6MB standard, byte-identical OCR on Korean tickets.
const MODEL_URL = 'https://tessdata.projectnaptha.com/4.0.0_fast/kor.traineddata.gz';
const MODEL_OUT = resolve(OUT, 'kor.traineddata.gz');

mkdirSync(OUT, { recursive: true });

// Clean stale vendored core/worker copies (keep the committed model).
for (const f of readdirSync(OUT)) {
  if (f.startsWith('tesseract-core') || f === 'worker.min.js') rmSync(resolve(OUT, f));
}

copyFileSync(WORKER, resolve(OUT, 'worker.min.js'));

// OEM 1 = LSTM only, so vendor just the *lstm* core variants (Tesseract.js auto-
// selects simd / relaxedsimd / plain by browser support). Skips the ~25MB of
// non-LSTM cores we never load.
let coreCount = 0;
for (const f of readdirSync(CORE_DIR)) {
  if (f.includes('lstm') && /^tesseract-core.*\.(wasm|js)$/.test(f)) {
    copyFileSync(resolve(CORE_DIR, f), resolve(OUT, f));
    coreCount++;
  }
}

if (!existsSync(MODEL_OUT)) {
  console.log('[vendor-tesseract] downloading kor.traineddata.gz (fast)…');
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed: HTTP ${res.status}`);
  writeFileSync(MODEL_OUT, Buffer.from(await res.arrayBuffer()));
}

const modelMB = (statSync(MODEL_OUT).size / 1048576).toFixed(1);
console.log(
  `[vendor-tesseract] worker + ${coreCount} core files + kor model (${modelMB}MB) → public/tesseract/`
);
