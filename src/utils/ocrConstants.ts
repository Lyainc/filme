/**
 * OCR 업로드 허용 타입/크기 — 클라이언트(OcrUploadCard)와 서버 라우트(ocr, ocr-boxes)가
 * 공유한다. 한 곳에서만 관리해 클라·서버 drift를 막는다.
 *
 * `.has()`로 조회하므로 Set으로 둔다(세 호출부 모두 동일).
 */
export const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** base64 디코드 기준 상한. 전처리를 거치면 보통 수백 KB지만 원본 직업로드에 대비한 상한. */
export const MAX_BYTES = 10 * 1024 * 1024; // 10MB
