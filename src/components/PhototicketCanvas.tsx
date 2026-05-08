'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { TARGET_WIDTH, TARGET_HEIGHT, DESIGN_LAYOUT, DESIGN_EFFECTS, THEATER_CHAINS, SCREENING_FORMATS } from '@/utils/constants';
import { drawLogo, roundRect, wrapText, fillTextWithSpacing, drawTCGBorder, applyTextureOverlay, drawStars, getContrastColor } from '@/utils/canvasRendering';

interface PhototicketCanvasProps {
  croppedImageUrl: string | null;
  movieTitle: string;
  watchDate: string;
  theater: string;
  chain: string;
  format: string;
  texture: string;
  rating: number;
  posterOpacity: number;
  themeColor: string;
  screen?: string;
  seat?: string;
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
  rating,
  posterOpacity,
  themeColor,
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

    // 0. 배경 초기화 (기본 블랙)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

    const posterImg = new Image();
    
    if (!croppedImageUrl.startsWith('blob:')) {
      posterImg.crossOrigin = 'anonymous';
    }

    posterImg.onload = async () => {
      if (isCancelled) return;

      // 1. 포스터 렌더링 (질감 필터 포함)
      ctx.filter = 'none';
      if (texture === 'vintage') {
        ctx.filter = 'sepia(60%) contrast(1.1) brightness(0.9)';
      } else if (texture === 'newspaper') {
        ctx.filter = 'grayscale(100%) contrast(1.5) brightness(1.2)';
      }

      ctx.drawImage(posterImg, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      ctx.filter = 'none'; 

      if (texture !== 'original') {
        // 2. 포스터 시인성 확보를 위한 오버레이 (사용자 지정 불투명도)
        // 검은색 레이어를 덮어서 이미지를 어둡게 만듦 (opacity가 1에 가까울수록 원본, 0에 가까울수록 블랙)
        ctx.globalAlpha = 1 - posterOpacity;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        ctx.globalAlpha = 1.0;

        // 3. 시네마틱 그라디언트 오버레이 (상단/하단 부드러운 감성)
        const gradient = ctx.createLinearGradient(0, 0, 0, TARGET_HEIGHT);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(0.2, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      }

      // 4. 로고 렌더링 (체인) - 배경 제거 및 테마 색상 적용
      if (chain) {
        const chainData = THEATER_CHAINS.find(c => c.value === chain);
        if (chainData && chainData.file) {
          // 극장 로고는 사용자가 선택한 테마 색상 그대로 사용
          await drawLogo(
            ctx, 
            `/assets/chains_transparent/${chainData.file}`, 
            DESIGN_LAYOUT.chainLogo.x, 
            DESIGN_LAYOUT.chainLogo.y, 
            DESIGN_LAYOUT.chainLogo.maxWidth, 
            DESIGN_LAYOUT.chainLogo.maxHeight, 
            themeColor,
            true // 중앙 정렬
          );
          if (isCancelled) return;
        }
      }

      // 5. 상영 포맷 로고 - 투명 배경 & 테마 색상 적용
      if (format) {
        const formatData = SCREENING_FORMATS.find(f => f.value === format);
        if (formatData && formatData.file) {
          const { x, y, badgeWidth, badgeHeight, padding } = DESIGN_LAYOUT.formatBadge;
          const maxWidth = badgeWidth - (padding * 2);
          const maxHeight = badgeHeight - (padding * 2);
          
          // 배경 없이 로고만 렌더링 (사용자 요청: 배경색 무조건 투명)
          // 색상은 왼쪽 극장 로고와 동일하게 themeColor 적용
          await drawLogo(
            ctx, 
            `/assets/formats_transparent/${formatData.file}`, 
            x + padding, 
            y + padding, 
            maxWidth, 
            maxHeight, 
            themeColor,
            true // 중앙 정렬
          );
          if (isCancelled) return;
        }
      }


      // === 정보 렌더링 ===
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillStyle = themeColor;
      
      // 6. 별점 (사용자 입력값 반영)
      drawStars(ctx, DESIGN_LAYOUT.rating.x, DESIGN_LAYOUT.rating.y + (DESIGN_LAYOUT.rating.size / 2), DESIGN_LAYOUT.rating.size, DESIGN_LAYOUT.rating.gap, rating, themeColor);

      // 7. 영화 제목
      if (movieTitle) {
        let titleFontSize = DESIGN_LAYOUT.movieTitle.fontSize;
        if (movieTitle.length > 15) {
          titleFontSize = titleFontSize * 0.85; // 긴 제목은 15% 축소
        } else if (movieTitle.length > 10) {
          titleFontSize = titleFontSize * 0.95; // 약간 긴 제목은 5% 축소
        }
        
        ctx.font = `${DESIGN_LAYOUT.movieTitle.fontWeight} ${titleFontSize}px "Pretendard", system-ui, sans-serif`;
        wrapText(ctx, movieTitle, DESIGN_LAYOUT.movieTitle.x, DESIGN_LAYOUT.movieTitle.y, DESIGN_LAYOUT.movieTitle.maxWidth, titleFontSize * DESIGN_LAYOUT.movieTitle.lineHeight);
      }

      // 8. 구분선 (Divider)
      ctx.globalAlpha = 0.3;
      ctx.fillRect(DESIGN_LAYOUT.divider.x, DESIGN_LAYOUT.divider.y, DESIGN_LAYOUT.divider.width, DESIGN_LAYOUT.divider.thickness);
      ctx.globalAlpha = 1.0;

      // 9. 메타데이터 (날짜, 극장, 상영관, 좌석)
      const metaY = DESIGN_LAYOUT.metadata.y;
      const lh = DESIGN_LAYOUT.metadata.lineHeight;

      let primaryText = [];
      if (watchDate) primaryText.push(watchDate);
      if (theater) primaryText.push(theater);
      
      if (primaryText.length > 0) {
        ctx.font = `${DESIGN_LAYOUT.metadata.primary.fontWeight} ${DESIGN_LAYOUT.metadata.primary.fontSize}px "Pretendard", system-ui, sans-serif`;
        fillTextWithSpacing(ctx, primaryText.join('   |   '), DESIGN_LAYOUT.metadata.x, metaY, DESIGN_LAYOUT.metadata.primary.letterSpacing);
      }

      let secondaryText = [];
      if (screen) secondaryText.push(screen);
      if (seat) secondaryText.push(seat);

      if (secondaryText.length > 0) {
        ctx.font = `${DESIGN_LAYOUT.metadata.secondary.fontWeight} ${DESIGN_LAYOUT.metadata.secondary.fontSize}px "Pretendard", system-ui, sans-serif`;
        ctx.globalAlpha = 0.7;
        fillTextWithSpacing(ctx, secondaryText.join('   |   '), DESIGN_LAYOUT.metadata.x, metaY + lh, DESIGN_LAYOUT.metadata.secondary.letterSpacing);
        ctx.globalAlpha = 1.0; 
      }

      // 10. TCG 프레임 (Inner Border) - 테두리 색상 적용
      drawTCGBorder(ctx, themeColor);

      // 11. 텍스처 (후가공) 오버레이 적용 - 드라마틱 효과
      applyTextureOverlay(ctx, texture, TARGET_WIDTH, TARGET_HEIGHT);
    };

    posterImg.src = croppedImageUrl;

    return () => {
      isCancelled = true;
    };
  }, [croppedImageUrl, movieTitle, watchDate, theater, chain, format, texture, rating, posterOpacity, themeColor, screen, seat]);

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
