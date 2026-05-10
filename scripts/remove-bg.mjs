import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const ASSETS_ROOT = path.join(ROOT_DIR, 'public', 'assets');

/**
 * Phototicket Asset Preprocessor (V17 - Smart Silhouette Edition)
 * 각 이미지의 특성을 분석하여 최적의 투명도 마스크를 생성합니다.
 */
async function processLogo(inputPath, outputPath, category) {
  const fileName = path.basename(inputPath);
  const lowerFileName = fileName.toLowerCase();
  
  try {
    // --- SPECIAL CASES ---
    if (
      lowerFileName === 'stresslesscinema.png' ||
      lowerFileName === 'stresslesscinema.jpg' ||
      lowerFileName === 'stresslesscinema.jpeg'
    ) {
      // 갈색 목재 배경에 검은색 로고 텍스트.
      // 밝기를 반전시켜 알파로 변환 (어두울수록 불투명).
      // 사전 블러로 나뭇결 미세 노이즈를 흐려 마스크 가독성 확보.
      const { data, info } = await sharp(inputPath)
        .blur(0.8)
        .raw()
        .toBuffer({ resolveWithObject: true });
      const channels = info.channels;
      const newData = Buffer.alloc(info.width * info.height * 4);

      for (let i = 0, j = 0; i < data.length; i += channels, j += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const brightness = (r + g + b) / 3;
        // 40 미만: 완전 불투명 / 40–70: 선형 페이드(텍스트 안티앨리어싱) / 70 이상: 투명
        let alpha;
        if (brightness < 40) alpha = 255;
        else if (brightness < 70) alpha = Math.round((70 - brightness) * (255 / 30));
        else alpha = 0;
        newData[j] = 0;
        newData[j + 1] = 0;
        newData[j + 2] = 0;
        newData[j + 3] = alpha;
      }

      const mask = sharp(newData, { raw: { width: info.width, height: info.height, channels: 4 } });
      const trimmedBuffer = await mask.trim({ threshold: 120 }).png().toBuffer();
      const trimmedMetadata = await sharp(trimmedBuffer).metadata();

      let TARGET_HEIGHT = 176;
      let scale = TARGET_HEIGHT / trimmedMetadata.height;
      if (scale > 5.0) scale = 5.0;

      const finalWidth = Math.round(trimmedMetadata.width * scale);
      const finalHeight = Math.round(trimmedMetadata.height * scale);

      await sharp(trimmedBuffer)
        .resize(finalWidth, finalHeight, { fit: 'fill' })
        .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        // R/G/B는 이미 0 — modulate 불필요
        .png({ compressionLevel: 9, palette: true })
        .toFile(outputPath);

      console.log(`   ✅ ${fileName} [Special-Stressless]: Processed (Dark-on-Wood)`);
      return;
    }
    
    if (lowerFileName === 'tempurcinema.jpg' || lowerFileName === 'tempurcinema.jpeg') {
      // 검은색 배경에 흰색 텍스트
      // 밝기를 알파 채널로 변환하여 텍스트만 추출
      const original = sharp(inputPath);
      const { data, info } = await original.raw().toBuffer({ resolveWithObject: true });
      const newData = Buffer.alloc(info.width * info.height * 4);
      const channels = info.channels;
      
      for (let i = 0, j = 0; i < data.length; i += channels, j += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const brightness = (r + g + b) / 3;
        newData[j] = 0;     // R
        newData[j+1] = 0;   // G
        newData[j+2] = 0;   // B
        newData[j+3] = brightness; // Alpha
      }
      
      const mask = sharp(newData, { raw: { width: info.width, height: info.height, channels: 4 } });
      const trimmedBuffer = await mask.trim({ threshold: 10 }).png().toBuffer();
      const trimmedMetadata = await sharp(trimmedBuffer).metadata();
      
      let TARGET_HEIGHT = 176;
      let scale = TARGET_HEIGHT / trimmedMetadata.height;
      if (scale > 5.0) scale = 5.0;
      
      const finalWidth = Math.round(trimmedMetadata.width * scale);
      const finalHeight = Math.round(trimmedMetadata.height * scale);
      
      await sharp(trimmedBuffer)
        .resize(finalWidth, finalHeight, { fit: 'fill' })
        .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        // 이미 RGB가 0이므로 실루엣화 불필요
        .png({ compressionLevel: 9, palette: true })
        .toFile(outputPath);
        
      console.log(`   ✅ ${fileName} [Special-Tempur]: Processed & Silhouette created`);
      return;
    }
    
    const isSvg = lowerFileName.endsWith('.svg');
    const isWebp = lowerFileName.endsWith('.webp');
    
    // 1. 이미지 로드 및 기본 메타데이터 획득
    // SVG는 고해상도 렌더링을 위해 density를 높게 설정
    let pipeline = sharp(inputPath, isSvg ? { density: 1200 } : {});
    
    // WebP 같은 경우 투명/흰색 배경 처리가 불안정할 수 있으므로, 
    // 비트맵인 경우 먼저 흰색 배경으로 플래튼 처리한 버퍼를 생성하여 검사합니다.
    let inspectionPipeline = pipeline.clone();
    if (!isSvg) {
      inspectionPipeline = inspectionPipeline.flatten({ background: '#ffffff' });
    }
    
    const metadata = await pipeline.metadata();
    
    // 2. 배경 분석을 위한 샘플링 (비트맵인 경우만)
    let isWhiteBG = false;
    let isBlackBG = false;
    let hasAlpha = metadata.hasAlpha && !isSvg && !isWebp; // SVG는 항상 투명, WebP는 일단 흰 배경으로 강제 취급

    if (!isSvg) {
      // 플래튼 처리된 이미지로 4개 모서리 픽셀 샘플링
      const { data, info } = await inspectionPipeline
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const channels = info.channels || 3; // flatten 했으므로 보통 3(RGB)
      const corners = [
        0, // Top-left
        (info.width - 1) * channels, // Top-right
        (info.width * (info.height - 1)) * channels, // Bottom-left
        (data.length - channels) // Bottom-right
      ];

      let whiteScore = 0;
      let blackScore = 0;

      for (const idx of corners) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        if (r > 240 && g > 240 && b > 240) whiteScore++;
        if (r < 15 && g < 15 && b < 15) blackScore++;
      }

      if (hasAlpha) {
         // keep true
      } else if (whiteScore >= 2 || isWebp) { // WebP는 흰배경으로 간주 (flatten 했으므로)
        isWhiteBG = true;
      } else if (blackScore >= 2) {
        isBlackBG = true;
      }
    }

    // 3. 최적의 처리 파이프라인 구성
    let finalPipeline = sharp(inputPath, isSvg ? { density: 1200 } : {});

    if (isSvg) {
      // SVG는 투명 배경으로 렌더링 후 실루엣화
      finalPipeline = finalPipeline.png().ensureAlpha();
    } else if (hasAlpha && !isWebp) {
      // 이미 투명도가 있는 경우: 알파 채널 유지
      finalPipeline = finalPipeline.ensureAlpha();
    } else if (isWhiteBG) {
      // 흰색 배경 + 어두운 로고: 밝기를 반전시켜 알파로 인코딩.
      // (단순 negate는 RGB만 뒤집고 알파를 만들지 않아서 modulate 단계에서 검정 박스가 됨.)
      const flat = await sharp(inputPath, isSvg ? { density: 1200 } : {})
        .flatten({ background: '#ffffff' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const { data: srcData, info: srcInfo } = flat;
      const srcCh = srcInfo.channels;
      const buf = Buffer.alloc(srcInfo.width * srcInfo.height * 4);
      for (let i = 0, j = 0; i < srcData.length; i += srcCh, j += 4) {
        const r = srcData[i], g = srcData[i + 1], b = srcData[i + 2];
        const brightness = (r + g + b) / 3;
        // 80 미만: 완전 불투명 / 80–200: 선형 페이드 (안티앨리어싱) / 200 이상: 투명
        let alpha;
        if (brightness < 80) alpha = 255;
        else if (brightness < 200) alpha = Math.round((200 - brightness) * (255 / 120));
        else alpha = 0;
        buf[j] = 0;
        buf[j + 1] = 0;
        buf[j + 2] = 0;
        buf[j + 3] = alpha;
      }
      // raw → PNG로 한 번 인코딩해야 후속 trim().toBuffer() 결과를 sharp이 다시 디코드 가능.
      const pngBuf = await sharp(buf, {
        raw: { width: srcInfo.width, height: srcInfo.height, channels: 4 },
      }).png().toBuffer();
      finalPipeline = sharp(pngBuf);
    } else if (isBlackBG) {
      // 검정색 배경인 경우: 그대로 유지 (trim이 배경을 날려줄 것임)
      finalPipeline = finalPipeline.ensureAlpha();
    } else {
      finalPipeline = finalPipeline.ensureAlpha();
    }

    // 4. 공통 후처리: Trim + Height Normalization + Padding + Silhouette(Black)
    // trim()은 상단 좌측 픽셀을 기준으로 배경을 자동으로 감지하여 제거합니다.
    const trimmedBuffer = await finalPipeline
      .trim({ threshold: 10 }) // 약간의 오차 허용
      .toBuffer();

    // trim 후의 실제 이미지 크기를 구합니다.
    const trimmedMetadata = await sharp(trimmedBuffer).metadata();
    
    // 시각적 무게(높이) 정규화
    let TARGET_HEIGHT = category === 'formats' ? 160 : 100;
    if (category === 'formats') {
      if (fileName.toLowerCase().includes('imax')) {
        TARGET_HEIGHT = 140; // 아이맥스는 너무 크니 10% 축소된 느낌
      } else {
        TARGET_HEIGHT = 176; // 나머지 포맷들은 10% 확대된 느낌
      }
    }
    
    let scale = TARGET_HEIGHT / trimmedMetadata.height;
    
    // 너무 심한 해상도 저하 방지를 위해 최대 스케일 제한 (5배)
    if (scale > 5.0 && !isSvg) {
      scale = 5.0;
    }

    const finalWidth = Math.round(trimmedMetadata.width * scale);
    const finalHeight = Math.round(trimmedMetadata.height * scale);

    // 다시 로드하여 최종 크기 조정, 패딩 및 색상 고정 (검정색 실루엣)
    await sharp(trimmedBuffer)
      .resize(finalWidth, finalHeight, { fit: 'fill' })
      .extend({
        top: 20, bottom: 20, left: 20, right: 20,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      // 모든 비-투명 픽셀을 검정색으로 강제 (실루엣화)
      .modulate({ brightness: 0 }) 
      .png({ compressionLevel: 9, palette: true }) // 용량 최적화
      .toFile(outputPath);

    let status = isSvg ? 'SVG' : (hasAlpha ? 'Alpha' : (isWhiteBG ? 'WhiteBG' : (isBlackBG ? 'BlackBG' : 'Unknown')));
    console.log(`   ✅ ${fileName} [${status}]: Processed & Silhouette created`);
  } catch (err) {
    console.error(`   ❌ ${fileName}: ${err.message}`);
  }
}

async function run() {
  console.log('🚀 Starting V17 Smart-Silhouette Preprocessing...');
  const dirs = [
    { in: 'chains', out: 'chains_transparent' },
    { in: 'formats', out: 'formats_transparent' }
  ];

  for (const dir of dirs) {
    const inputDir = path.join(ASSETS_ROOT, dir.in);
    const outputDir = path.join(ASSETS_ROOT, dir.out);
    
    await fs.mkdir(outputDir, { recursive: true });
    
    const allFiles = await fs.readdir(inputDir);
    const files = allFiles.filter(f => /\.(png|jpg|jpeg|webp|svg)$/i.test(f));
    
    console.log(`\n📂 Processing ${dir.in} -> ${dir.out} (${files.length} files)`);
    
    for (const file of files) {
      const inputPath = path.join(inputDir, file);
      const outputFileName = path.parse(file).name + '.png';
      const outputPath = path.join(outputDir, outputFileName);
      
      await processLogo(inputPath, outputPath, dir.in);
    }
  }
  
  console.log('\n✨ All assets have been optimized for Phototicket Canvas!');
}

run();
