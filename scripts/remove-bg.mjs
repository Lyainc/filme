import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_ROOT = path.join(ROOT_DIR, 'public', 'assets');

/**
 * Phototicket Asset Preprocessor (V18 — Square Canvas + BG Subtraction)
 *
 * Strategy per logo:
 *   - Stressless (wood texture + dark text, low-res): 4x lanczos upscale
 *     → blur(σ=50) as background estimate → |orig − bg| as alpha mask.
 *   - Tempur (black bg + white text): brightness → alpha directly.
 *   - Generic: corner sampling decides hasAlpha / whiteBG / blackBG / fallback.
 *     Low-res inputs (longest side < 400) are 4x lanczos-upscaled in whiteBG branch.
 *
 * Output: 400×400 PNG, logo centered, normalized by sqrt(W·H) so visual weight
 * is consistent across wildly different aspect ratios (1.5:1 → 8.6:1 range).
 * Max inner extent clamped to 350 to keep canvas margin and prevent edge bleed.
 */

const CANVAS_SIZE = 400;
const INNER_MAX = 350;
const TARGET_SQRT_AREA = 240;
const UPSCALE_THRESHOLD = 400;
const UPSCALE_FACTOR = 4;
const SVG_DENSITY = 1200;

function getSlug(fileName) {
  return path.parse(fileName).name.toLowerCase().split('_')[0];
}

function needsUpscale(meta) {
  return Math.max(meta.width, meta.height) < UPSCALE_THRESHOLD;
}

function rawRgbaToPngBuffer(buf, width, height) {
  return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function maskStressless(inputPath) {
  const meta = await sharp(inputPath).metadata();
  const upW = meta.width * UPSCALE_FACTOR;

  const orig = await sharp(inputPath)
    .resize({ width: upW, kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bg = await sharp(orig.data, {
    raw: { width: orig.info.width, height: orig.info.height, channels: orig.info.channels },
  })
    .blur(50)
    .raw()
    .toBuffer();

  const { width: W, height: H, channels: ch } = orig.info;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0, j = 0; i < orig.data.length; i += ch, j += 4) {
    const dR = Math.abs(orig.data[i] - bg[i]);
    const dG = Math.abs(orig.data[i + 1] - bg[i + 1]);
    const dB = Math.abs(orig.data[i + 2] - bg[i + 2]);
    const diff = Math.max(dR, dG, dB);

    let alpha;
    if (diff < 25) alpha = 0;
    else if (diff < 75) alpha = Math.round((diff - 25) * (255 / 50));
    else alpha = 255;

    out[j] = 0;
    out[j + 1] = 0;
    out[j + 2] = 0;
    out[j + 3] = alpha;
  }
  return rawRgbaToPngBuffer(out, W, H);
}

async function maskTempur(inputPath) {
  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0, j = 0; i < data.length; i += ch, j += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    out[j] = 0;
    out[j + 1] = 0;
    out[j + 2] = 0;
    out[j + 3] = brightness;
  }
  return rawRgbaToPngBuffer(out, W, H);
}

async function blackSilhouetteFromAlpha(pipeline) {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = 0;
    out[i + 1] = 0;
    out[i + 2] = 0;
    out[i + 3] = data[i + 3];
  }
  return rawRgbaToPngBuffer(out, info.width, info.height);
}

async function maskWhiteBG(inputPath, meta) {
  const up = needsUpscale(meta);
  let p = sharp(inputPath);
  if (up) p = p.resize({ width: meta.width * UPSCALE_FACTOR, kernel: 'lanczos3' });

  const { data, info } = await p
    .flatten({ background: '#ffffff' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H, channels: ch } = info;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0, j = 0; i < data.length; i += ch, j += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    let alpha;
    if (brightness < 80) alpha = 255;
    else if (brightness < 200) alpha = Math.round((200 - brightness) * (255 / 120));
    else alpha = 0;
    out[j] = 0;
    out[j + 1] = 0;
    out[j + 2] = 0;
    out[j + 3] = alpha;
  }
  return rawRgbaToPngBuffer(out, W, H);
}

async function maskBlackBG(inputPath) {
  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: ch } = info;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0, j = 0; i < data.length; i += ch, j += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    out[j] = 0;
    out[j + 1] = 0;
    out[j + 2] = 0;
    out[j + 3] = brightness;
  }
  return rawRgbaToPngBuffer(out, W, H);
}

async function maskGeneric(inputPath, isSvg) {
  if (isSvg) {
    return blackSilhouetteFromAlpha(sharp(inputPath, { density: SVG_DENSITY }).png().ensureAlpha());
  }

  const meta = await sharp(inputPath).metadata();
  const isWebp = path.extname(inputPath).toLowerCase() === '.webp';
  const hasAlpha = meta.hasAlpha && !isWebp;

  if (hasAlpha) {
    return blackSilhouetteFromAlpha(sharp(inputPath).ensureAlpha());
  }

  const flat = await sharp(inputPath)
    .flatten({ background: '#ffffff' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = flat.info.channels;
  const corners = [
    0,
    (flat.info.width - 1) * ch,
    flat.info.width * (flat.info.height - 1) * ch,
    flat.data.length - ch,
  ];
  let whiteScore = 0;
  let blackScore = 0;
  for (const idx of corners) {
    const r = flat.data[idx];
    const g = flat.data[idx + 1];
    const b = flat.data[idx + 2];
    if (r > 240 && g > 240 && b > 240) whiteScore++;
    if (r < 15 && g < 15 && b < 15) blackScore++;
  }

  if (whiteScore >= 2 || isWebp) return maskWhiteBG(inputPath, meta);
  if (blackScore >= 2) return maskBlackBG(inputPath);
  return blackSilhouetteFromAlpha(sharp(inputPath).ensureAlpha());
}

async function finalizeSquare(maskBuffer, outputPath) {
  const trimmed = await sharp(maskBuffer)
    .trim({ threshold: 10 })
    .png()
    .toBuffer({ resolveWithObject: true });

  const { width: tw, height: th } = trimmed.info;

  // Mode C: sqrt-area normalization. Visual weight stays consistent across
  // 1.5:1 ~ 8.6:1 aspect ratios. Clamp to INNER_MAX so wide logos don't bleed.
  let scale = TARGET_SQRT_AREA / Math.sqrt(tw * th);
  if (tw * scale > INNER_MAX) scale = INNER_MAX / tw;
  if (th * scale > INNER_MAX) scale = Math.min(scale, INNER_MAX / th);

  const w = Math.max(1, Math.round(tw * scale));
  const h = Math.max(1, Math.round(th * scale));
  const top = Math.floor((CANVAS_SIZE - h) / 2);
  const left = Math.floor((CANVAS_SIZE - w) / 2);

  await sharp(trimmed.data)
    .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
    .extend({
      top,
      bottom: CANVAS_SIZE - h - top,
      left,
      right: CANVAS_SIZE - w - left,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, palette: true })
    .toFile(outputPath);
}

async function processLogo(inputPath, outputPath) {
  const fileName = path.basename(inputPath);
  const slug = getSlug(fileName);
  const isSvg = path.extname(fileName).toLowerCase() === '.svg';

  try {
    let maskBuffer;
    let label;
    if (slug === 'stresslesscinema') {
      maskBuffer = await maskStressless(inputPath);
      label = 'Stressless · bg-subtract+4x';
    } else if (slug === 'tempurcinema') {
      maskBuffer = await maskTempur(inputPath);
      label = 'Tempur · brightness→alpha';
    } else {
      maskBuffer = await maskGeneric(inputPath, isSvg);
      label = isSvg ? 'SVG' : 'Generic';
    }
    await finalizeSquare(maskBuffer, outputPath);
    console.log(`   ✅ ${fileName} [${label}]`);
  } catch (err) {
    console.error(`   ❌ ${fileName}: ${err.message}`);
  }
}

async function run() {
  console.log('🚀 V18 — Square Canvas + BG Subtraction');
  const dirs = [
    { in: 'chains', out: 'chains_transparent' },
    { in: 'formats', out: 'formats_transparent' },
  ];

  for (const dir of dirs) {
    const inputDir = path.join(ASSETS_ROOT, dir.in);
    const outputDir = path.join(ASSETS_ROOT, dir.out);
    await fs.mkdir(outputDir, { recursive: true });

    const allFiles = await fs.readdir(inputDir);
    const files = allFiles.filter((f) => /\.(png|jpg|jpeg|webp|svg)$/i.test(f));

    console.log(`\n📂 ${dir.in} → ${dir.out} (${files.length} files)`);
    for (const file of files) {
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, path.parse(file).name + '.png');
      await processLogo(inputPath, outputPath);
    }
  }
  console.log('\n✨ Done.');
}

run();
