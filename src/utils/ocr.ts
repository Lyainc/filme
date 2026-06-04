import type { MovieInfo } from '@/types';
import { preprocessForOcr } from './ocrPreprocess';

/**
 * runOcr 반환 — 폼에 직접 적용할 필드 + KOBIS 조회용 title + 자동선택용 chain.
 * (title은 폼에 바로 쓰지 않고 OcrUploadCard에서 KOBIS 검색어로 흐른다.)
 */
export type OcrResult = Partial<MovieInfo> & { chain?: string; preprocessedImage?: string };

/** Blob → 순수 base64 문자열(data URL prefix 제거). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.replace(/^data:[^;]+;base64,/, ''));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 파일 전처리 및 Base64 페이로드 준비 */
async function prepareImagePayload(file: File) {
  const blob = await preprocessForOcr(file);
  const base64 = await blobToBase64(blob);
  const mimeType = blob.type || 'image/jpeg';
  const preprocessedImage = `data:${mimeType};base64,${base64}`;
  return { base64, mimeType, preprocessedImage };
}

/**
 * 티켓 스크린샷 → 전처리(하단 크롭·768px·JPEG) → `/api/ocr`(GPT-4o mini vision)
 * → 구조화 필드. 서버가 채워진 필드만 주므로 반환 객체엔 인식된 값만 담긴다.
 *
 * SSR-safe: window가 없으면 빈 객체. 절대 throw하지 않는다 — 전처리/네트워크/파싱
 * 실패는 모두 빈 객체로 흡수해 OCR 흐름이 끊기지 않게 한다.
 *
 * @param file  티켓 이미지 File (PNG / JPEG / WebP)
 */
export async function runOcr(file: File): Promise<OcrResult> {
  if (typeof window === 'undefined') return {};

  try {
    const { base64, mimeType, preprocessedImage } = await prepareImagePayload(file);

    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mimeType }),
    });

    if (!res.ok) return { preprocessedImage };

    const data = (await res.json()) as OcrResult;
    return data ? { ...data, preprocessedImage } : { preprocessedImage };
  } catch (err) {
    console.error('[ocr] runOcr failed:', err);
    return {};
  }
}

export type OcrBoxItem = {
  text: string;
  field: 'theater' | 'screen' | 'watchDate' | 'watchTime' | 'seat' | 'bookingNumber' | 'title' | null;
  box: { x: number; y: number; w: number; h: number } | null;
};

export type OcrBoxesResult = {
  items: OcrBoxItem[];
  preprocessedImage?: string;
};

/**
 * 티켓 스크린샷 → 전처리 → `/api/ocr-boxes` → 박스와 텍스트 칩 추출.
 * SSR-safe, 예외를 던지지 않는다.
 */
export async function runOcrBoxes(file: File): Promise<OcrBoxesResult> {
  if (typeof window === 'undefined') return { items: [] };

  try {
    const { base64, mimeType, preprocessedImage } = await prepareImagePayload(file);

    const res = await fetch('/api/ocr-boxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mimeType }),
    });

    if (!res.ok) return { items: [], preprocessedImage };

    const data = await res.json();
    return {
      items: data.items ?? [],
      preprocessedImage,
    };
  } catch (err) {
    console.error('[ocr] runOcrBoxes failed:', err);
    return { items: [] };
  }
}
