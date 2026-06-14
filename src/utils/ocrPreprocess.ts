/**
 * OCR 전처리 유틸 — 티켓 스크린샷을 GPT Vision에 넘기기 전에
 * 크기와 노이즈를 줄여 인식 정확도를 높이고 이미지 토큰 비용을 절감한다.
 *
 * 처리 파이프라인 (순서 고정):
 *   1. 하단 18% 크롭  — 앱 UI 버튼·고지 영역 제거
 *   2. width 512 캡   — GPT Vision 이미지 토큰 절감 (width가 이미 ≤512 이면 스킵)
 *   3. JPEG 92% 재인코딩
 *
 * 폭 캡이 512인 이유(#111): api/ocr.ts가 detail=high로 호출하므로 gpt-4o-mini는
 * 이미지를 512px 타일로 쪼개 과금한다. 폭 768(≈768×1363)은 6타일 ~37k 토큰이지만
 * 폭 512(≈512×909)는 2타일 ~14.7k 토큰으로 ~2.5배 절감되며, 작은 글씨(예매번호·
 * 좌석) 정확도는 폭768 high와 동등하게 유지된다(실측 검증). detail=low(통짜 ~2.8k)는
 * 11배 더 싸지만 작은 숫자를 자릿수 단위로 오인식해 기각했다.
 */

/**
 * 티켓 스크린샷을 OCR에 최적화된 Blob으로 전처리한다.
 *
 * SSR-safe: 서버 사이드에서는 Canvas/createImageBitmap을 사용할 수 없으므로
 * window가 없으면 원본 file을 그대로 반환한다.
 * 모든 실패 경로에서 throw 하지 않고 원본 file을 fallback으로 반환한다 —
 * 전처리 실패가 OCR 흐름 자체를 끊어선 안 된다.
 *
 * 크롭 계산 예시 (1170×2532 입력):
 *   cropH  = round(2532 × 0.82) = 2076
 *   scale  = 512 / 1170
 *   outW   = 512, outH = round(2076 × 512 / 1170) = 909
 *
 * @param file  원본 이미지 File (PNG / JPEG / WebP)
 * @returns     전처리된 JPEG Blob, 또는 전처리 불가 시 원본 file
 */
export async function preprocessForOcr(file: File): Promise<Blob> {
  // 1. SSR 가드 — Canvas는 브라우저 전용 API
  if (typeof window === 'undefined') return file;

  let bitmap: ImageBitmap | null = null;

  try {
    // 2. 이미지 디코드 — URL.createObjectURL 없이 바로 디코드
    bitmap = await createImageBitmap(file);
  } catch {
    // 디코드 실패(지원 안 되는 포맷 등) → 원본 그대로 반환
    return file;
  }

  try {
    const W = bitmap.width;
    const H = bitmap.height;

    // 3. 하단 18% 크롭 — 티켓 앱 하단의 버튼·고지 영역 제거
    //    상단 82%만 남긴다
    const cropH = Math.round(H * 0.82);

    // 4. width 512 캡 — detail=high에서 512px 타일 수가 비용을 지배하므로
    //    512 이하로 맞춰 타일을 6→2로 줄인다(#111). 이미 작으면 스케일 1(그대로).
    const scale = W > 512 ? 512 / W : 1;
    const outW = Math.round(W * scale);
    const outH = Math.round(cropH * scale);

    // 5. Canvas에 크롭 + 리사이즈 동시 적용
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // source: 원본 이미지의 상단 cropH 픽셀만
    // dest:   canvas 전체(outW × outH)
    ctx.drawImage(bitmap, 0, 0, W, cropH, 0, 0, outW, outH);

    // 6. JPEG 재인코딩 — quality 0.92는 시각 품질과 파일 크기의 균형점
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

    return blob ?? file;
  } finally {
    // 7. ImageBitmap 메모리 해제 — GC에 맡기지 않고 명시적 해제
    bitmap.close();
  }
}
