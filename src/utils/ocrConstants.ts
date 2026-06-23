/**
 * OCR 업로드 허용 타입/크기 — 클라이언트(OcrUploadCard)와 서버 라우트(api/ocr)가
 * 공유한다. 한 곳에서만 관리해 클라·서버 drift를 막는다.
 *
 * `.has()`로 조회하므로 Set으로 둔다.
 */
export const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

/** base64 디코드 기준 상한. 전처리를 거치면 보통 수백 KB지만 원본 직업로드에 대비한 상한. */
export const MAX_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * OCR `chain` enum(api/ocr.ts TicketSchema) → 티켓 텍스트 스탬프용 브랜드 라벨(#141 (7)).
 * 사용자가 로고 이미지를 안 올려도 OCR이 인식한 체인이 텍스트로 바로 표시된다.
 * 키는 enum 슬러그(cgv/lotte/megabox/cineq)와 1:1.
 */
export const CHAIN_LABELS: Record<string, string> = {
  cgv: 'CGV',
  lotte: 'LOTTE CINEMA',
  megabox: 'MEGABOX',
  cineq: 'CINE Q',
};

/** chain 슬러그 → 표시 라벨. 미상이면 대문자 fallback(자체 enum 밖 값 대비). */
export function chainLabelFor(chain: string): string {
  return CHAIN_LABELS[chain] ?? chain.toUpperCase();
}
