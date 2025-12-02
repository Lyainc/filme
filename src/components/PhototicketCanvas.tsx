'use client';

import { useEffect, useRef } from 'react';
import { TARGET_WIDTH, TARGET_HEIGHT, DESIGN_LAYOUT, DESIGN_EFFECTS, THEATER_CHAINS, SCREENING_FORMATS } from '@/utils/constants';

interface PhototicketCanvasProps {
  croppedImageUrl: string | null;
  movieTitle: string;
  watchDate: string;
  theater: string;
  chain: string;
  format: string;
}

/**
 * 포토티켓 Canvas 렌더링 컴포넌트 (신규 디자인 시스템)
 *
 * 포스터 위에 조화롭게 어울리는 요소들을 레이어로 쌓아 렌더링합니다.
 */
export default function PhototicketCanvas({
  croppedImageUrl,
  movieTitle,
  watchDate,
  theater,
  chain,
  format
}: PhototicketCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !croppedImageUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas 크기 설정
    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    // 배경 검은색
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

    // 배경 이미지 로드 및 렌더링
    const posterImg = new Image();
    posterImg.crossOrigin = 'anonymous';

    posterImg.onload = async () => {
      // Layer 1: 배경 포스터 이미지
      ctx.drawImage(posterImg, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // Layer 2: 그라디언트 오버레이 (상단/하단 어둡게)
      const gradient = ctx.createLinearGradient(0, 0, 0, TARGET_HEIGHT);
      const stops = DESIGN_EFFECTS.gradients.topDark.stops;
      stops.forEach(stop => {
        gradient.addColorStop(stop.offset, stop.color);
      });
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // Layer 3: 극장 체인 로고 (상단 좌측)
      if (chain) {
        const chainData = THEATER_CHAINS.find(c => c.value === chain);
        if (chainData && chainData.file) {
          await drawLogo(
            ctx,
            `/assets/chains/${chainData.file}`,
            DESIGN_LAYOUT.chainLogo.x,
            DESIGN_LAYOUT.chainLogo.y,
            DESIGN_LAYOUT.chainLogo.maxWidth,
            DESIGN_LAYOUT.chainLogo.maxHeight
          );
        }
      }

      // Layer 4: 상영 포맷 배지 (중단 좌측)
      if (format) {
        const formatData = SCREENING_FORMATS.find(f => f.value === format);
        if (formatData && formatData.file) {
          // 배지 배경 (둥근 사각형)
          const badgeX = DESIGN_LAYOUT.formatBadge.x;
          const badgeY = DESIGN_LAYOUT.formatBadge.y;
          const badgePadding = DESIGN_LAYOUT.formatBadge.padding;
          const badgeRadius = DESIGN_LAYOUT.formatBadge.borderRadius;

          // 배지 크기는 로고 크기 + 패딩
          const logoWidth = DESIGN_LAYOUT.formatBadge.maxWidth;
          const logoHeight = DESIGN_LAYOUT.formatBadge.maxHeight;
          const badgeWidth = logoWidth + badgePadding * 2;
          const badgeHeight = logoHeight + badgePadding * 2;

          // 둥근 사각형 배지 배경
          ctx.fillStyle = DESIGN_LAYOUT.formatBadge.backgroundColor;
          roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, badgeRadius);
          ctx.fill();

          // 포맷 로고 렌더링 (배지 안쪽)
          await drawLogo(
            ctx,
            `/assets/formats/${formatData.file}`,
            badgeX + badgePadding,
            badgeY + badgePadding,
            logoWidth,
            logoHeight
          );
        }
      }

      // 텍스트 렌더링 설정
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      // 텍스트 그림자 설정 (시인성)
      const shadow = DESIGN_EFFECTS.textShadow;
      ctx.shadowOffsetX = shadow.offsetX;
      ctx.shadowOffsetY = shadow.offsetY;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowColor = shadow.color;

      // Layer 5: 영화 제목 (하단)
      if (movieTitle) {
        ctx.font = `${DESIGN_LAYOUT.movieTitle.fontWeight} ${DESIGN_LAYOUT.movieTitle.fontSize}px Arial, sans-serif`;
        ctx.fillStyle = DESIGN_EFFECTS.colors.textPrimary;

        // 긴 제목 처리 (줄바꿈)
        const maxWidth = DESIGN_LAYOUT.movieTitle.maxWidth;
        wrapText(
          ctx,
          movieTitle,
          DESIGN_LAYOUT.movieTitle.x,
          DESIGN_LAYOUT.movieTitle.y,
          maxWidth,
          DESIGN_LAYOUT.movieTitle.fontSize * DESIGN_LAYOUT.movieTitle.lineHeight
        );
      }

      // Layer 6: 관람일 (하단)
      if (watchDate) {
        ctx.font = `${DESIGN_LAYOUT.watchDate.fontWeight} ${DESIGN_LAYOUT.watchDate.fontSize}px Arial, sans-serif`;
        ctx.fillStyle = DESIGN_EFFECTS.colors.textSecondary;
        ctx.fillText(watchDate, DESIGN_LAYOUT.watchDate.x, DESIGN_LAYOUT.watchDate.y);
      }

      // Layer 7: 극장 위치 (하단)
      if (theater) {
        ctx.font = `${DESIGN_LAYOUT.theater.fontWeight} ${DESIGN_LAYOUT.theater.fontSize}px Arial, sans-serif`;
        ctx.fillStyle = DESIGN_EFFECTS.colors.textTertiary;
        ctx.fillText(theater, DESIGN_LAYOUT.theater.x, DESIGN_LAYOUT.theater.y);
      }

      // Canvas를 window에 노출 (다운로드용)
      window.phototicketCanvas = canvas;
    };

    posterImg.src = croppedImageUrl;

    // Cleanup
    return () => {
      delete window.phototicketCanvas;
    };
  }, [croppedImageUrl, movieTitle, watchDate, theater, chain, format]);

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        className="border border-gray-300 max-w-full h-auto"
        style={{ maxHeight: '600px' }}
      />
    </div>
  );
}

/**
 * 로고 이미지 로드 및 렌더링
 */
async function drawLogo(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // 비율 유지하며 크기 조정
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      const width = img.width * scale;
      const height = img.height * scale;

      // 이미지 렌더링
      ctx.drawImage(img, x, y, width, height);
      resolve();
    };

    img.onerror = () => {
      console.warn(`Failed to load logo: ${src}`);
      resolve(); // 에러여도 계속 진행
    };

    img.src = src;
  });
}

/**
 * 둥근 사각형 그리기
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
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
 * 텍스트 줄바꿈 처리
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split('');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}
