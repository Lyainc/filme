import { TARGET_WIDTH, TARGET_HEIGHT, TARGET_RATIO } from './constants';

export interface Area {
  width: number;
  height: number;
  x: number;
  y: number;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

export interface CropOutputOptions {
  /** 출력 MIME. 기본 'image/jpeg'(포스터). 로고는 'image/png'로 알파 보존. */
  mimeType?: string;
  /** JPEG 품질(0~1). PNG에선 무시. 기본 0.95. */
  quality?: number;
  /**
   * 지정 시 출력 캔버스가 크롭의 종횡비를 그대로 보존하고(자유 크롭 로고용), 긴 변을
   * 이 값(px) 이하로 축소만 한다(확대 안 함). 미지정 시 포스터 고정 해상도(960×1477).
   */
  maxSide?: number;
}

/**
 * 선택된 픽셀 영역을 기반으로 이미지를 크롭하여 Object URL로 반환
 * Memory Optimized: Object URL 사용 (사용 후 revokeObjectURL 필요)
 *
 * 기본(opts 없음)은 포스터 경로 — 960×1477 고정, image/jpeg 0.95(기존 동작 그대로).
 * 로고는 `{ mimeType: 'image/png', maxSide: 640 }`로 종횡비 보존 + 알파 유지.
 *
 * @param imageSrc - 원본 이미지의 Object URL
 * @param pixelCrop - ImageCropModal(react-image-crop)에서 원본 픽셀 좌표로 환산해 반환한 크롭 영역
 * @param opts - 출력 포맷/크기 옵션 (기본값 = 포스터)
 * @returns Promise<string> - 크롭된 이미지의 Object URL
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  opts: CropOutputOptions = {}
): Promise<string> {
  const { mimeType = 'image/jpeg', quality = 0.95, maxSide } = opts;
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  let outW: number;
  let outH: number;
  if (maxSide == null) {
    // 포스터: 항상 고정된 출력 해상도 (960x1477)
    outW = TARGET_WIDTH;
    outH = TARGET_HEIGHT;
  } else {
    // 로고(자유 크롭): 크롭 종횡비 보존, 긴 변만 maxSide로 캡(확대는 안 함)
    const scale = Math.min(1, maxSide / Math.max(pixelCrop.width, pixelCrop.height));
    outW = Math.max(1, Math.round(pixelCrop.width * scale));
    outH = Math.max(1, Math.round(pixelCrop.height * scale));
  }
  canvas.width = outW;
  canvas.height = outH;

  // 원본 이미지에서 pixelCrop 영역만큼 가져와서 canvas 해상도에 맞게 그림.
  // PNG 경로는 배경을 안 칠해 투명도(alpha)를 그대로 보존한다.
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error('Canvas is empty'));
      }
    }, mimeType, quality);
  });
}
