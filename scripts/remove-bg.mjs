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
  
  try {
    const isSvg = fileName.toLowerCase().endsWith('.svg');
    const isWebp = fileName.toLowerCase().endsWith('.webp');
    
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
      // 흰색 배경인 경우: 흰색 배경으로 병합한 뒤 반전시켜서 검정 배경의 흰색 로고로 만든 후 처리
      finalPipeline = finalPipeline.flatten({ background: '#ffffff' }).ensureAlpha().negate({ alpha: false });
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
