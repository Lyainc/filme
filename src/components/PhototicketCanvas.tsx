'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { TARGET_WIDTH, TARGET_HEIGHT, DESIGN_LAYOUT, DESIGN_EFFECTS, THEATER_CHAINS, SCREENING_FORMATS } from '@/utils/constants';

interface PhototicketCanvasProps {
  croppedImageUrl: string | null;
  movieTitle: string;
  watchDate: string;
  theater: string;
  chain: string;
  format: string;
  texture: string;
  screen?: string;
  seat?: string;
}

/**
 * 이미지 하단부 평균 밝기를 분석하여 텍스트 색상을 결정합니다.
 */
function getContrastColor(ctx: CanvasRenderingContext2D): 'white' | 'black' {
  const checkAreaHeight = 400; 
  const imageData = ctx.getImageData(0, TARGET_HEIGHT - checkAreaHeight, TARGET_WIDTH, checkAreaHeight);
  const data = imageData.data;
  let r, g, b, avg;
  let colorSum = 0;

  for (let x = 0, len = data.length; x < len; x += 4) {
    r = data[x];
    g = data[x + 1];
    b = data[x + 2];

    avg = Math.floor((r + g + b) / 3);
    colorSum += avg;
  }

  const brightness = colorSum / (data.length / 4);
  return brightness > 190 ? 'black' : 'white';
}

/**
 * 포토티켓 Canvas 렌더링 컴포넌트
 */
const PhototicketCanvas = forwardRef<HTMLCanvasElement, PhototicketCanvasProps>(({
  croppedImageUrl,
  movieTitle,
  watchDate,
  theater,
  chain,
  format,
  texture,
  screen,
  seat
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => canvasRef.current!);

  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !croppedImageUrl) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

    const posterImg = new Image();
    
    if (!croppedImageUrl.startsWith('blob:')) {
      posterImg.crossOrigin = 'anonymous';
    }

    posterImg.onload = async () => {
      if (isCancelled) return;

      // 0. 초기 필터 (빈티지, 흑백 신문 등)
      ctx.filter = 'none';
      if (texture === 'vintage') {
        ctx.filter = 'sepia(60%) contrast(1.1) brightness(0.9)';
      } else if (texture === 'newspaper') {
        ctx.filter = 'grayscale(100%) contrast(1.5) brightness(1.2)';
      }

      // 1. 포스터 렌더링
      ctx.drawImage(posterImg, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      ctx.filter = 'none'; // 필터 초기화

      // 2. 밝기 분석 및 색상 결정
      const contrastMode = getContrastColor(ctx);
      const isDark = contrastMode === 'white';

      // 3. 시네마틱 그라디언트 오버레이
      const gradient = ctx.createLinearGradient(0, 0, 0, TARGET_HEIGHT);
      const stops = isDark ? DESIGN_EFFECTS.gradients.topDark.stops : DESIGN_EFFECTS.gradients.topLight.stops;
      stops.forEach(stop => {
        gradient.addColorStop(stop.offset, stop.color);
      });
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // 4. 로고 렌더링 (체인)
      if (chain) {
        const chainData = THEATER_CHAINS.find(c => c.value === chain);
        if (chainData && chainData.file) {
          await drawLogo(ctx, `/assets/chains/${chainData.file}`, DESIGN_LAYOUT.chainLogo.x, DESIGN_LAYOUT.chainLogo.y, DESIGN_LAYOUT.chainLogo.maxWidth, DESIGN_LAYOUT.chainLogo.maxHeight);
          if (isCancelled) return;
        }
      }

      // 5. 상영 포맷 배지
      if (format) {
        const formatData = SCREENING_FORMATS.find(f => f.value === format);
        if (formatData && formatData.file) {
          const { x, y, padding, borderRadius, maxWidth, maxHeight } = DESIGN_LAYOUT.formatBadge;
          const badgeWidth = maxWidth + padding * 2;
          const badgeHeight = maxHeight + padding * 2;

          ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)';
          roundRect(ctx, x, y, badgeWidth, badgeHeight, borderRadius);
          ctx.fill();

          await drawLogo(ctx, `/assets/formats/${formatData.file}`, x + padding, y + padding, maxWidth, maxHeight);
          if (isCancelled) return;
        }
      }

      // === 하단 프리미엄 정보 패널 ===
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      const textColor = isDark ? '#FFFFFF' : '#111111';
      const shadowColor = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.5)';
      const dividerColor = isDark ? `rgba(255, 255, 255, ${DESIGN_LAYOUT.divider.opacity})` : `rgba(0, 0, 0, ${DESIGN_LAYOUT.divider.opacity})`;
      
      // 6. 넘버링 & 별점 (수집용 티켓 감성)
      ctx.font = `${DESIGN_LAYOUT.numbering.fontWeight} ${DESIGN_LAYOUT.numbering.fontSize}px "Pretendard", system-ui, sans-serif`;
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
      fillTextWithSpacing(ctx, `${DESIGN_LAYOUT.numbering.prefix} 001`, DESIGN_LAYOUT.numbering.x, DESIGN_LAYOUT.numbering.y, DESIGN_LAYOUT.numbering.letterSpacing);
      
      drawStars(ctx, DESIGN_LAYOUT.rating.x, DESIGN_LAYOUT.rating.y + (DESIGN_LAYOUT.rating.size / 2), DESIGN_LAYOUT.rating.size, DESIGN_LAYOUT.rating.gap, isDark);

      // 7. 영화 제목
      if (movieTitle) {
        ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 6; ctx.shadowColor = shadowColor;
        ctx.font = `${DESIGN_LAYOUT.movieTitle.fontWeight} ${DESIGN_LAYOUT.movieTitle.fontSize}px "Pretendard", system-ui, sans-serif`;
        ctx.fillStyle = textColor;
        wrapText(ctx, movieTitle, DESIGN_LAYOUT.movieTitle.x, DESIGN_LAYOUT.movieTitle.y, DESIGN_LAYOUT.movieTitle.maxWidth, DESIGN_LAYOUT.movieTitle.fontSize * DESIGN_LAYOUT.movieTitle.lineHeight);
      }

      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0; 

      // 8. 구분선 (Divider)
      ctx.fillStyle = dividerColor;
      ctx.fillRect(DESIGN_LAYOUT.divider.x, DESIGN_LAYOUT.divider.y, DESIGN_LAYOUT.divider.width, DESIGN_LAYOUT.divider.thickness);

      // 9. 메타데이터 (날짜, 극장, 상영관, 좌석)
      const metaY = DESIGN_LAYOUT.metadata.y;
      const lh = DESIGN_LAYOUT.metadata.lineHeight;

      let primaryText = [];
      if (watchDate) primaryText.push(watchDate);
      if (theater) primaryText.push(theater);
      
      if (primaryText.length > 0) {
        ctx.font = `${DESIGN_LAYOUT.metadata.primary.fontWeight} ${DESIGN_LAYOUT.metadata.primary.fontSize}px "Pretendard", system-ui, sans-serif`;
        ctx.fillStyle = textColor;
        fillTextWithSpacing(ctx, primaryText.join('   |   '), DESIGN_LAYOUT.metadata.x, metaY, DESIGN_LAYOUT.metadata.primary.letterSpacing);
      }

      let secondaryText = [];
      if (screen) secondaryText.push(screen);
      if (seat) secondaryText.push(seat);

      if (secondaryText.length > 0) {
        ctx.font = `${DESIGN_LAYOUT.metadata.secondary.fontWeight} ${DESIGN_LAYOUT.metadata.secondary.fontSize}px "Pretendard", system-ui, sans-serif`;
        ctx.globalAlpha = DESIGN_LAYOUT.metadata.secondary.opacity;
        fillTextWithSpacing(ctx, secondaryText.join('   |   '), DESIGN_LAYOUT.metadata.x, metaY + lh, DESIGN_LAYOUT.metadata.secondary.letterSpacing);
        ctx.globalAlpha = 1.0; 
      }

      // 10. 장식용 바코드
      drawBarcode(ctx, DESIGN_LAYOUT.barcode.x, DESIGN_LAYOUT.barcode.y, DESIGN_LAYOUT.barcode.width, DESIGN_LAYOUT.barcode.height, isDark);

      // 11. TCG 프레임 (Inner Border)
      drawTCGBorder(ctx, isDark);

      // 12. 텍스처 (후가공) 오버레이 적용
      applyTextureOverlay(ctx, texture, TARGET_WIDTH, TARGET_HEIGHT);
    };

    posterImg.src = croppedImageUrl;

    return () => {
      isCancelled = true;
    };
  }, [croppedImageUrl, movieTitle, watchDate, theater, chain, format, texture, screen, seat]);

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        className="border border-gray-300 max-w-full h-auto"
        style={{ maxHeight: '600px' }}
      />
    </div>
  );
});

PhototicketCanvas.displayName = 'PhototicketCanvas';

export default PhototicketCanvas;

/* =========================================================================
 * Helper Functions
 * ========================================================================= */

async function drawLogo(ctx: CanvasRenderingContext2D, src: string, x: number, y: number, maxWidth: number, maxHeight: number): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      resolve();
    };
    img.onerror = () => {
      console.warn(`Failed to load logo: ${src}`);
      resolve();
    };
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 텍스트 줄바꿈 처리 (한국어/영어 복합 지원 알고리즘)
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const word = words[n];
    
    if (ctx.measureText(word).width > maxWidth) {
      if (line.trim() !== '') {
        ctx.fillText(line.trim(), x, currentY);
        line = '';
        currentY += lineHeight;
      }
      
      let subLine = '';
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        if (ctx.measureText(subLine + char).width > maxWidth) {
          ctx.fillText(subLine, x, currentY);
          subLine = char;
          currentY += lineHeight;
        } else {
          subLine += char;
        }
      }
      line = subLine + ' ';
    } else {
      const testLine = line + word + (n < words.length - 1 ? ' ' : '');
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = word + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
  }
  
  if (line.trim().length > 0) {
    ctx.fillText(line.trim(), x, currentY);
  }
}

/**
 * 자간(Letter Spacing)을 지원하는 텍스트 렌더링
 */
function fillTextWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number
) {
  let currentX = x;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    ctx.fillText(char, currentX, y);
    currentX += ctx.measureText(char).width + spacing;
  }
}

/**
 * 장식용 바코드 그리기 (티켓 미학)
 */
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  isDark: boolean
) {
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
  const bars = [2, 1, 3, 1, 1, 4, 2, 1, 1, 2, 3, 1, 2, 2, 1, 3, 1, 2];
  let currentX = x;
  
  for (let i = 0; i < bars.length; i++) {
    const barWidth = bars[i] * 2.5; 
    const gap = (i % 2 === 0) ? 4 : 8; 
    
    if (currentX + barWidth > x + width) break;
    
    ctx.fillRect(currentX, y, barWidth, height);
    currentX += barWidth + gap;
  }
}

/**
 * TCG 스타일의 이너 프레임 라인 (고급스러움 강조)
 */
function drawTCGBorder(ctx: CanvasRenderingContext2D, isDark: boolean) {
  const { margin, thickness, radius } = DESIGN_LAYOUT.border;
  const width = TARGET_WIDTH - margin * 2;
  const height = TARGET_HEIGHT - margin * 2;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(margin + radius, margin);
  ctx.lineTo(margin + width - radius, margin);
  ctx.quadraticCurveTo(margin + width, margin, margin + width, margin + radius);
  ctx.lineTo(margin + width, margin + height - radius);
  ctx.quadraticCurveTo(margin + width, margin + height, margin + width - radius, margin + height);
  ctx.lineTo(margin + radius, margin + height);
  ctx.quadraticCurveTo(margin, margin + height, margin, margin + height - radius);
  ctx.lineTo(margin, margin + radius);
  ctx.quadraticCurveTo(margin, margin, margin + radius, margin);
  ctx.closePath();

  ctx.lineWidth = thickness;
  // 다크 모드일 땐 금/은박 느낌의 선명한 흰색, 라이트 모드일 땐 부드러운 검은색
  ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)';
  
  // Scodix나 박(Foil) 효과를 위한 글로우 효과
  ctx.shadowColor = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 8;
  
  ctx.stroke();
  ctx.restore();
}

/**
 * 특수 후가공 텍스처 오버레이 (Hologram, Metal, Artpaper, Scodix 등)
 */
function applyTextureOverlay(ctx: CanvasRenderingContext2D, texture: string, width: number, height: number) {
  if (!texture || texture === 'none' || texture === 'vintage' || texture === 'newspaper') return;

  ctx.save();
  
  if (texture === 'hologram') {
    // 홀로그램 무지개빛 그라디언트
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0.15)');
    gradient.addColorStop(0.2, 'rgba(255, 165, 0, 0.15)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 0, 0.15)');
    gradient.addColorStop(0.6, 'rgba(0, 128, 0, 0.15)');
    gradient.addColorStop(0.8, 'rgba(0, 0, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(238, 130, 238, 0.15)');
    
    ctx.globalCompositeOperation = 'color-dodge';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } 
  else if (texture === 'metal') {
    // 메탈릭한 대각선 빛 반사
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(0.4, 'rgba(200, 200, 200, 0.1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.6, 'rgba(150, 150, 150, 0.1)');
    gradient.addColorStop(1, 'rgba(50, 50, 50, 0.3)');
    
    ctx.globalCompositeOperation = 'hard-light';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  else if (texture === 'artpaper') {
    // 수채화/캔버스 질감을 위한 가상 노이즈 패턴 시뮬레이션
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(230, 225, 215, 0.3)'; // 종이 질감 베이스
    ctx.fillRect(0, 0, width, height);
    // (Note: 브라우저 환경에서 실제 픽셀 조작 노이즈는 성능 이슈가 있어 단색 곱하기로 질감 톤만 조절)
  }
  else if (texture === 'scodix') {
    // 부분 코팅 엠보싱 효과 (전체적으로 채도를 살짝 낮추고 광택을 줌)
    const gradient = ctx.createLinearGradient(0, height/2, width, height/2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

/**
 * 별점 빈 칸 그리기 (메가박스 오리지널 티켓 스타일 리뷰란)
 */
function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, gap: number, isDark: boolean) {
  ctx.save();
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  
  let currentX = x;
  const outerRadius = size / 2;
  const innerRadius = size / 4;
  
  for(let i=0; i<5; i++) {
    let rot = Math.PI / 2 * 3;
    let cx = currentX + outerRadius;
    let cy = y;
    let step = Math.PI / 5;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let j = 0; j < 5; j++) {
      let px = cx + Math.cos(rot) * outerRadius;
      let py = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(px, py);
      rot += step;

      px = cx + Math.cos(rot) * innerRadius;
      py = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(px, py);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.stroke();
    
    currentX += size + gap;
  }
  ctx.restore();
}
