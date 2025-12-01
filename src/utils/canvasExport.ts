/**
 * Canvas를 JPEG로 다운로드
 * Phase 0에서 검증된 로직
 */
export function downloadCanvasAsJPEG(
  canvas: HTMLCanvasElement,
  filename: string = 'phototicket.jpg'
) {
  const dataURL = canvas.toDataURL('image/jpeg', 0.95);

  fetch(dataURL)
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
}
