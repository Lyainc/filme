'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { TARGET_WIDTH, TARGET_HEIGHT, DESIGN_LAYOUT, DESIGN_EFFECTS, THEATER_CHAINS, SCREENING_FORMATS } from '@/utils/constants';
import { drawLogo, roundRect, wrapText, fillTextWithSpacing, drawTCGBorder, applyTextureOverlay, drawStars, getContrastColor } from '@/utils/canvasRendering';

interface PhototicketCanvasProps {
  croppedImageUrl: string | null;
  movieTitle: string;
  movieTitleOg?: string;
  actors?: string;
  releaseDate?: string;
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
  movieTitleOg,
  actors,
  releaseDate,
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

    // High-Res Canvas Scaling (2x)
    const scale = 2;
    canvas.width = TARGET_WIDTH * scale;
    canvas.height = TARGET_HEIGHT * scale;

    ctx.scale(scale, scale);

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
            'left' // 좌측 정렬 (빈 공간 방지)
          );
          if (isCancelled) return;
        }
      }

      // 5. 상영 포맷 로고 - 투명 배경 & 테마 색상 적용
      if (format) {
        const formatData = SCREENING_FORMATS.find(f => f.value === format);
        if (formatData && formatData.file) {
          const { x, y, badgeHeight } = DESIGN_LAYOUT.formatBadge;
          const maxWidth = 200; 
          const maxHeight = badgeHeight;
          
          // x is the right edge.
          const startX = x - maxWidth;
          
          await drawLogo(
            ctx, 
            `/assets/formats_transparent/${formatData.file}`, 
            startX, 
            y, 
            maxWidth, 
            maxHeight, 
            themeColor,
            'right' // 우측 정렬
          );
          if (isCancelled) return;
        }
      }


      // === 정보 렌더링 ===
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillStyle = themeColor;
      
      // 텍스트 가독성을 위한 그림자 효과 적용
      ctx.shadowColor = DESIGN_EFFECTS.textShadow.color;
      ctx.shadowOffsetX = DESIGN_EFFECTS.textShadow.offsetX;
      ctx.shadowOffsetY = DESIGN_EFFECTS.textShadow.offsetY;
      ctx.shadowBlur = DESIGN_EFFECTS.textShadow.blur;

      // 6. HEADER: 극장 메타데이터 (우측 정렬)
      const headerMetaText = [];
      if (watchDate) headerMetaText.push(watchDate);
      if (theater) headerMetaText.push(theater);
      if (screen) headerMetaText.push(screen);
      if (seat) headerMetaText.push(seat);

      if (headerMetaText.length > 0) {
        ctx.textAlign = 'right';
        ctx.font = `${DESIGN_LAYOUT.headerMetadata.fontWeight} ${DESIGN_LAYOUT.headerMetadata.fontSize}px "Pretendard", system-ui, sans-serif`;
        ctx.globalAlpha = DESIGN_LAYOUT.headerMetadata.opacity;
        ctx.fillText(headerMetaText.join('  |  '), DESIGN_LAYOUT.headerMetadata.x, DESIGN_LAYOUT.headerMetadata.y);
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'left'; // Reset
      }

      // 7. FOOTER: 원어 제목
      if (movieTitleOg) {
        ctx.font = `${DESIGN_LAYOUT.movieTitleOg.fontWeight} ${DESIGN_LAYOUT.movieTitleOg.fontSize}px "Pretendard", system-ui, sans-serif`;
        ctx.globalAlpha = DESIGN_LAYOUT.movieTitleOg.opacity;
        fillTextWithSpacing(ctx, movieTitleOg.toUpperCase(), DESIGN_LAYOUT.movieTitleOg.x, DESIGN_LAYOUT.movieTitleOg.y, DESIGN_LAYOUT.movieTitleOg.letterSpacing);
        ctx.globalAlpha = 1.0;
      }

      // 8. FOOTER: 메인 영화 제목
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

      // 9. FOOTER: 별점
      drawStars(ctx, DESIGN_LAYOUT.rating.x, DESIGN_LAYOUT.rating.y + (DESIGN_LAYOUT.rating.size / 2), DESIGN_LAYOUT.rating.size, DESIGN_LAYOUT.rating.gap, rating, themeColor);

      // 10. FOOTER: 주연 배우
      if (actors) {
        ctx.font = `${DESIGN_LAYOUT.actors.fontWeight} ${DESIGN_LAYOUT.actors.fontSize}px "Pretendard", system-ui, sans-serif`;
        ctx.globalAlpha = DESIGN_LAYOUT.actors.opacity;
        wrapText(ctx, actors, DESIGN_LAYOUT.actors.x, DESIGN_LAYOUT.actors.y, DESIGN_LAYOUT.actors.maxWidth, DESIGN_LAYOUT.actors.fontSize * 1.5);
        ctx.globalAlpha = 1.0;
      }

      // 11. FOOTER: 개봉일
      if (releaseDate) {
        ctx.font = `${DESIGN_LAYOUT.releaseDate.fontWeight} ${DESIGN_LAYOUT.releaseDate.fontSize}px "Pretendard", system-ui, sans-serif`;
        ctx.globalAlpha = DESIGN_LAYOUT.releaseDate.opacity;
        fillTextWithSpacing(ctx, `개봉 ${releaseDate}`, DESIGN_LAYOUT.releaseDate.x, DESIGN_LAYOUT.releaseDate.y, DESIGN_LAYOUT.releaseDate.letterSpacing);
        ctx.globalAlpha = 1.0;
      }

      // 그림자 제거 (도형/선에는 적용 안함)
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 12. 구분선 (Divider)
      ctx.globalAlpha = DESIGN_LAYOUT.divider.opacity;
      ctx.fillRect(DESIGN_LAYOUT.divider.x, DESIGN_LAYOUT.divider.y, DESIGN_LAYOUT.divider.width, DESIGN_LAYOUT.divider.thickness);
      ctx.globalAlpha = 1.0;

      // 10. TCG 프레임 (Inner Border) - 테두리 색상 적용
      drawTCGBorder(ctx, themeColor);

      // 11. 텍스처 (후가공) 오버레이 적용 - 드라마틱 효과
      applyTextureOverlay(ctx, texture, TARGET_WIDTH, TARGET_HEIGHT);
    };

    posterImg.src = croppedImageUrl;

    return () => {
      isCancelled = true;
    };
  }, [croppedImageUrl, movieTitle, movieTitleOg, actors, releaseDate, watchDate, theater, chain, format, texture, rating, posterOpacity, themeColor, screen, seat]);

  return (
    <div className="flex justify-center items-center w-full">
      <canvas
        ref={canvasRef}
        className="border border-gray-300 shadow-xl"
        style={{ 
          maxWidth: '100%', 
          maxHeight: '600px', 
          width: 'auto', 
          height: 'auto',
          objectFit: 'contain'
        }}
      />
    </div>
  );
});

PhototicketCanvas.displayName = 'PhototicketCanvas';

export default PhototicketCanvas;
