import { TARGET_WIDTH, TARGET_HEIGHT, TARGET_RATIO } from './constants';

/**
 * 이미지를 CGV 포토플레이 비율(0.65:1)로 자동 크롭
 * Memory Optimized: base64 대신 Object URL 사용
 *
 * @param file - 업로드된 이미지 파일 (JPG, PNG, WebP)
 * @returns Promise<string> - 크롭된 이미지의 Object URL (사용 후 revokeObjectURL 필요)
 */
export async function cropImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // 원본 이미지 비율
      const imgRatio = img.width / img.height;

      // 크롭 영역 계산 (중앙 정렬)
      let cropX, cropY, cropWidth, cropHeight;

      if (imgRatio > TARGET_RATIO) {
        // 이미지가 더 넓음 → 좌우 크롭
        cropHeight = img.height;
        cropWidth = img.height * TARGET_RATIO;
        cropX = (img.width - cropWidth) / 2;
        cropY = 0;
      } else {
        // 이미지가 더 좁음 → 상하 크롭
        cropWidth = img.width;
        cropHeight = img.width / TARGET_RATIO;
        cropX = 0;
        cropY = (img.height - cropHeight) / 2;
      }

      // Canvas에 크롭된 이미지 그리기
      const canvas = document.createElement('canvas');
      canvas.width = TARGET_WIDTH;
      canvas.height = TARGET_HEIGHT;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, TARGET_WIDTH, TARGET_HEIGHT
      );

      // Blob으로 변환하여 메모리 효율성 확보
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl); // 원본 이미지 메모리 해제
        if (blob) {
          const resultUrl = URL.createObjectURL(blob);
          resolve(resultUrl);
        } else {
          reject(new Error('Blob creation failed'));
        }
      }, 'image/jpeg', 0.95);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image load failed'));
    };

    img.src = objectUrl;
  });
}
