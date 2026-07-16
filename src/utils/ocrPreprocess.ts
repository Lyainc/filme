/**
 * OCR 전처리 유틸 — 티켓 스크린샷/사진을 vision 모델에 넘기기 전에
 * 업로드 페이로드를 줄여 인식 정확도를 유지하면서 전송 시간을 절감한다.
 *
 * 처리 파이프라인 (순서 고정):
 *   1. width 512 캡     — 업로드 페이로드 절감 (width가 이미 ≤512 이면 스킵)
 *   2. JPEG 92% 재인코딩
 *
 * 하단 18% 크롭은 #404에서 제거했다 — 실물 영수증형 티켓(가로 사진, EXIF
 * orientation으로 세로 표시)에서 바코드·예매번호가 몰린 하단을 잘라먹어
 * 순손해였다(실측: 크롭 시 예매번호 오인식, 제거 시 정상). 스크린샷 STRICT
 * 정확도는 크롭 유무와 무관하게 동일(Gemini가 앱 UI를 알아서 무시).
 *
 * 폭 캡 512는 gpt-4o-mini(detail=high, 512px 타일 과금) 시절에 정해졌지만(#111),
 * 모델이 gemini-3.1-flash-lite로 바뀐 뒤에도 유지한다 — Gemini는 이미지 토큰을
 * 타일 단위 고정 과금해 폭과 무관하지만, 512 다운스케일이 업로드 페이로드를
 * 최대 17배 줄여(약전계 네트워크에서 100s→4s) 실사용 지연을 줄인다. 512는
 * 영수증형 사진의 예매번호 인식 하한선이라(384부터 소실) 더 내릴 수 없다(#404).
 */

/**
 * 티켓 이미지를 OCR에 최적화된 Blob으로 전처리한다.
 *
 * SSR-safe: 서버 사이드에서는 Canvas/createImageBitmap을 사용할 수 없으므로
 * window가 없으면 원본 file을 그대로 반환한다.
 * 모든 실패 경로에서 throw 하지 않고 원본 file을 fallback으로 반환한다 —
 * 전처리 실패가 OCR 흐름 자체를 끊어선 안 된다.
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

    // 3. width 512 캡 — 업로드 페이로드를 줄인다. 이미 작으면 스케일 1(그대로).
    //    자세한 근거는 파일 상단 헤더 참고(#111에서 정하고 #125·#404에서 재확인).
    const scale = W > 512 ? 512 / W : 1;
    const outW = Math.round(W * scale);
    const outH = Math.round(H * scale);

    // 4. Canvas에 리사이즈 적용
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, W, H, 0, 0, outW, outH);

    // 5. JPEG 재인코딩 — quality 0.92는 시각 품질과 파일 크기의 균형점
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });

    return blob ?? file;
  } finally {
    // 6. ImageBitmap 메모리 해제 — GC에 맡기지 않고 명시적 해제
    bitmap.close();
  }
}
