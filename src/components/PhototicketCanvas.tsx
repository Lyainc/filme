'use client';

import { useEffect, useRef } from 'react';
import { TARGET_WIDTH, TARGET_HEIGHT } from '@/utils/imageCrop';

interface PhototicketCanvasProps {
  croppedImageUrl: string | null;
  movieTitle: string;
  watchDate: string;
  theater: string;
  chain: string;
  format: string;
}

export default function PhototicketCanvas({
  croppedImageUrl,
  movieTitle,
  watchDate,
  theater,
  chain,
  format
}: PhototicketCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 이미지/텍스트 렌더링 (Phase 0 로직 재사용)
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

    // 배경 이미지 로드
    const img = new Image();
    img.onload = () => {
      // 이미지 그리기
      ctx.drawImage(img, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

      // 하단 오버레이 (반투명 검은색)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, TARGET_HEIGHT - 200, TARGET_WIDTH, 200);

      // 극장 체인 (상단, 빨간색)
      if (chain) {
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#ff0000';
        ctx.fillText(chain, 40, 70);
      }

      // 상영 포맷 (상단, 흰색 + 배경)
      if (format) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(35, 95, ctx.measureText(format).width + 10, 35);
        ctx.font = '24px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(format, 40, 120);
      }

      // 영화 제목 (하단)
      if (movieTitle) {
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(movieTitle, 40, TARGET_HEIGHT - 140);
      }

      // 관람일 (하단)
      if (watchDate) {
        ctx.font = '24px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(watchDate, 40, TARGET_HEIGHT - 90);
      }

      // 극장 위치 (하단)
      if (theater) {
        ctx.font = '20px Arial';
        ctx.fillStyle = '#cccccc';
        ctx.fillText(theater, 40, TARGET_HEIGHT - 45);
      }

      // Canvas를 window에 노출 (다운로드용)
      (window as any).phototicketCanvas = canvas;
    };

    img.src = croppedImageUrl;
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
