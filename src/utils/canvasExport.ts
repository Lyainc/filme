import { JPEG_QUALITY } from './constants';

/**
 * Canvas를 JPEG 파일로 다운로드
 *
 * @param canvas - 다운로드할 Canvas 엘리먼트
 * @param filename - 저장할 파일명 (기본값: 'phototicket.jpg')
 */
export function downloadCanvasAsJPEG(
  canvas: HTMLCanvasElement,
  filename: string = 'phototicket.jpg'
): void {
  canvas.toBlob((blob) => {
    if (!blob) {
      console.error('Failed to create blob from canvas');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    
    // Revoke the Object URL after a slight delay to ensure download starts
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }, 'image/jpeg', JPEG_QUALITY);
}
