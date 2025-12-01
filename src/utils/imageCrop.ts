// CGV 포토플레이 사양
export const TARGET_WIDTH = 960;
export const TARGET_HEIGHT = 1477;
export const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT; // 0.65:1

/**
 * 이미지를 CGV 포토플레이 비율(0.65:1)로 자동 크롭
 * Phase 0에서 검증된 로직
 */
export async function cropImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
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
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(
          img,
          cropX, cropY, cropWidth, cropHeight,
          0, 0, TARGET_WIDTH, TARGET_HEIGHT
        );

        // Data URL로 변환
        const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.95);
        resolve(croppedImageUrl);
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}
