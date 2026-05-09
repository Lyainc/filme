import { TARGET_WIDTH, TARGET_HEIGHT, DESIGN_LAYOUT } from './constants';

// 로고 이미지 엘리먼트 캐시 (중복 로딩 방지)
const imageElementCache = new Map<string, Promise<HTMLImageElement>>();
// 최종 렌더링된 오프스크린 캔버스 캐시 (경로 + 색상 + 크기 키값)
const logoCanvasCache = new Map<string, HTMLCanvasElement>();

/**
 * 이미지를 로드하고 캐시하는 헬퍼
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  if (imageElementCache.has(src)) {
    return imageElementCache.get(src)!;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load image: ${src}`);
      reject(new Error(`Load failed: ${src}`));
    };
    img.src = src;
  });

  imageElementCache.set(src, promise);
  return promise;
}

/**
 * 로고를 캔버스에 그림 (배경 제거된 실루엣에 색상 입히기 및 중앙 정렬 지원)
 */
export async function drawLogo(
  ctx: CanvasRenderingContext2D,
  src: string,
  targetX: number,
  targetY: number,
  targetMaxWidth: number,
  targetMaxHeight: number,
  themeColor: string = '#FFFFFF',
  align: 'left' | 'center' | 'right' = 'center'
): Promise<void> {
  const cacheKey = `${src}_${themeColor}_${targetMaxWidth}_${targetMaxHeight}_${align}`;
  
  if (logoCanvasCache.has(cacheKey)) {
    const cachedCanvas = logoCanvasCache.get(cacheKey)!;
    let finalX = targetX;
    if (align === 'center') finalX = targetX + (targetMaxWidth - cachedCanvas.width) / 2;
    else if (align === 'right') finalX = targetX + targetMaxWidth - cachedCanvas.width;
    
    let finalY = targetY;
    if (align === 'center') finalY = targetY + (targetMaxHeight - cachedCanvas.height) / 2;
    else if (align === 'right') finalY = targetY + (targetMaxHeight - cachedCanvas.height) / 2; // Keep Y centered
    
    ctx.drawImage(cachedCanvas, Math.round(finalX), Math.round(finalY));
    return;
  }

  try {
    const img = await loadImage(src);
    
    // 비율 유지하며 크기 계산
    const ratio = img.width / img.height;
    
    // 시각적 균형(Visual Weight) 보정:
    // 가로로 긴 로고는 높이가 낮아도 넓어서 적당해 보이지만,
    // 정사각형에 가까운 로고는 지정된 상하폭(targetMaxHeight)에 갇히면 좌우가 너무 비어 휑해 보입니다.
    // 이를 방지하기 위해 가로세로 비율이 일정 수치 미만일 경우 최대 높이를 1.0~1.6배까지 유동적으로 늘려줍니다.
    let adjustedMaxHeight = targetMaxHeight;
    if (ratio < 3.0) {
      const multiplier = Math.min(1.6, 3.0 / ratio);
      adjustedMaxHeight = targetMaxHeight * multiplier;
    }

    const scale = Math.min(targetMaxWidth / img.width, adjustedMaxHeight / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    if (w <= 0 || h <= 0) return;

    // 오프스크린 캔버스 생성 (색상 변경 및 캐싱용)
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d');
    
    let finalX = targetX;
    if (align === 'center') finalX = targetX + (targetMaxWidth - w) / 2;
    else if (align === 'right') finalX = targetX + targetMaxWidth - w;

    let finalY = targetY;
    if (align === 'center' || align === 'right') finalY = targetY + (targetMaxHeight - h) / 2; // Y is always centered for 'right' and 'center'

    if (!offCtx) {
      ctx.drawImage(img, Math.round(finalX), Math.round(finalY), w, h);
      return;
    }

    // 1. 캔버스 초기화 (완전 투명)
    offCtx.clearRect(0, 0, w, h);
    
    // 2. 먼저 테마 색상으로 채움
    offCtx.fillStyle = themeColor;
    offCtx.fillRect(0, 0, w, h);
    
    // 3. 'destination-in' 모드 적용: 이미지의 불투명 영역만 남김 (마스킹)
    offCtx.globalCompositeOperation = 'destination-in';
    offCtx.drawImage(img, 0, 0, w, h);

    // 캐시에 저장
    logoCanvasCache.set(cacheKey, offCanvas);
    
    ctx.drawImage(offCanvas, Math.round(finalX), Math.round(finalY));
  } catch (err) {
    console.warn(`Failed to process logo: ${src}`, err);
  }
}

/**
 * 배경색에 따른 최적의 텍스트 색상(검정/흰색) 반환
 */
export function getContrastColor(hexColor: string): '#000000' | '#FFFFFF' {
  // HEX 코드 정규화 (#FFF -> #FFFFFF)
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  // 밝기 계산 (YIQ 가중치 적용)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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

export function wrapText(
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

export function fillTextWithSpacing(
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

export function drawTCGBorder(ctx: CanvasRenderingContext2D, color: string) {
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
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.4;
  
  ctx.stroke();
  ctx.restore();
}

export function applyTextureOverlay(ctx: CanvasRenderingContext2D, texture: string, width: number, height: number) {
  if (!texture || texture === 'original' || texture === 'vintage' || texture === 'newspaper') return;

  ctx.save();
  
  if (texture === 'none') {
    // 일반 인화지 (유광) 느낌을 위한 은은한 빛 반사
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.05)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)'); // 사선 하이라이트
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  else if (texture === 'hologram') {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(255, 182, 193, 0.25)'); // 파스텔 핑크
    gradient.addColorStop(0.2, 'rgba(255, 223, 186, 0.25)'); // 파스텔 오렌지
    gradient.addColorStop(0.4, 'rgba(255, 255, 186, 0.25)'); // 파스텔 옐로우
    gradient.addColorStop(0.6, 'rgba(186, 255, 201, 0.25)'); // 파스텔 그린
    gradient.addColorStop(0.8, 'rgba(186, 225, 255, 0.25)'); // 파스텔 블루
    gradient.addColorStop(1, 'rgba(216, 191, 216, 0.25)'); // 파스텔 퍼플
    
    ctx.globalCompositeOperation = 'color-dodge';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // 은은한 반짝임 효과
    const sparkle = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    sparkle.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    sparkle.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sparkle;
    ctx.fillRect(0, 0, width, height);
  } 
  else if (texture === 'metal') {
    // 브러시드 메탈 느낌의 미세한 선 패턴 생성 (오프스크린 캔버스)
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 4;
    patternCanvas.height = 4;
    const pCtx = patternCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = 'rgba(255, 255, 255, 0)';
      pCtx.fillRect(0, 0, 4, 4);
      pCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      pCtx.fillRect(0, 0, 4, 1);
      pCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      pCtx.fillRect(0, 2, 4, 1);
      const pattern = ctx.createPattern(patternCanvas, 'repeat');
      if (pattern) {
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
      }
    }

    // 차가운 금속 반사 그라디언트
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    gradient.addColorStop(0.3, 'rgba(180, 190, 200, 0.1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.7, 'rgba(100, 110, 120, 0.1)');
    gradient.addColorStop(1, 'rgba(30, 40, 50, 0.3)');
    
    ctx.globalCompositeOperation = 'hard-light';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  else if (texture === 'artpaper') {
    // 캔버스 직물 패턴 생성
    const patternCanvas = document.createElement('canvas');
    patternCanvas.width = 6;
    patternCanvas.height = 6;
    const pCtx = patternCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = 'rgba(220, 210, 190, 0.3)';
      pCtx.fillRect(0, 0, 6, 6);
      pCtx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      pCtx.fillRect(0, 0, 3, 3);
      pCtx.fillRect(3, 3, 3, 3);
      pCtx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      pCtx.fillRect(3, 0, 3, 3);
      pCtx.fillRect(0, 3, 3, 3);
      
      const pattern = ctx.createPattern(patternCanvas, 'repeat');
      if (pattern) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
      }
    }
  }
  else if (texture === 'scodix') {
    // 입체감을 위한 강한 하이라이트와 엠보싱 그림자
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.1)'); // 엠보싱 그림자
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)'); // 강한 하이라이트
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  gap: number,
  rating: number,
  themeColor: string
) {
  ctx.save();
  ctx.strokeStyle = themeColor;
  ctx.fillStyle = themeColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  
  let currentX = x;
  const outerRadius = size / 2;
  const innerRadius = size / 4;
  
  for(let i=0; i<5; i++) {
    const isFilled = i < rating;
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
    
    if (rating >= i + 1) {
      ctx.fill();
    } else if (rating > i) {
      // 반 개 채우기: 클리핑 활용
      ctx.save();
      // 별 모양 클리핑
      ctx.clip();
      
      // 왼쪽 반만 채우기
      ctx.fillRect(cx - outerRadius, cy - outerRadius, outerRadius, outerRadius * 2);
      
      ctx.restore();
      
      // 테두리는 전체 다시 그리기
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    } else {
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }
    
    currentX += size + gap;
  }
  ctx.restore();
}
