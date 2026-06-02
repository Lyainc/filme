import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { parseTicket } from '../src/utils/parseTicket';
import { detectChain } from '../src/utils/detectChain';

// 전처리 비교: COLOR=1 컬러 패스스루 / GREY_ONLY=1 greyscale만 / 기본 greyscale+normalize
const preprocess = (buf: Buffer) =>
  process.env.COLOR
    ? sharp(buf).rotate().toBuffer()
    : process.env.GREY_ONLY
      ? sharp(buf).greyscale().toBuffer()
      : sharp(buf).greyscale().normalize().toBuffer();

const SAMPLE_DIR = resolve(__dirname, '../public/sample/moblieticket');
const CACHE = resolve(__dirname, '.ocr-cache.json');

// 캐시된 raw OCR 텍스트가 있으면 재사용. `--fresh` 플래그로 강제 재인식.
async function getRawTexts(fresh: boolean): Promise<Record<string, string>> {
  if (!fresh && existsSync(CACHE)) {
    return JSON.parse(readFileSync(CACHE, 'utf-8'));
  }

  console.log('🔍 OCR Worker 초기화 (kor)... raw 텍스트 캐싱\n');
  const worker = await createWorker('kor', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') {
        process.stdout.write(`\r  인식 중... ${Math.round(m.progress * 100)}%   `);
      }
    },
  });

  const files = readdirSync(SAMPLE_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  const out: Record<string, string> = {};
  for (const file of files) {
    process.stdout.write(`\r  ${file} ...                 `);
    const pre = await preprocess(readFileSync(join(SAMPLE_DIR, file)));
    const { data } = await worker.recognize(pre);
    out[file] = data.text ?? '';
  }
  await worker.terminate();
  writeFileSync(CACHE, JSON.stringify(out, null, 2));
  process.stdout.write('\r캐시 완료                          \n');
  return out;
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const showRaw = process.argv.includes('--raw');
  const texts = await getRawTexts(fresh);

  for (const [file, raw] of Object.entries(texts)) {
    console.log(`─────────────────────────────────────`);
    console.log(`📄 ${file}  →  [chain: ${detectChain(raw) ?? 'none'}]`);
    if (showRaw) {
      console.log(`\n[RAW]\n${raw.trim()}\n`);
    }
    console.log(JSON.stringify(parseTicket(raw), null, 2));
  }
  console.log('완료');
}

main().catch(console.error);
