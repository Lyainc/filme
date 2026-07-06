import type { OcrDirectField } from './OcrUploadCard';
import type { MovieInfo } from '@/types';

interface OcrUndoBannerProps {
  /** non-null이면 배너를 노출한다 — useOcrUndo.snapshot을 그대로 넘긴다. */
  snapshot: Partial<MovieInfo> | null;
  filledFields: Set<OcrDirectField>;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * OCR 낙관적 주입 되돌리기 배너 + sr-only 라이브리전 — EditorCanvas(모바일)와
 * DesktopStudioShell(데스크톱)이 공유하는 표현 계층(#141-class drift 방지). 로직은 useOcrUndo.
 * 화면 하단 중앙 고정(fixed bottom-6). 라이브리전은 콘텐츠 변경 *전부터* DOM에 있어야 SR이 mutation을
 * 잡으므로(배너와 동시 삽입되면 무시됨, #199 리뷰 P1) 항상 마운트하고 텍스트만 바꾼다.
 */
export function OcrUndoBanner({ snapshot, filledFields, onCancel, onConfirm }: OcrUndoBannerProps) {
  const message =
    filledFields.size > 0
      ? `${filledFields.size}개 항목이 자동 입력되었어요.`
      : '영화 정보를 자동으로 불러왔어요.';

  return (
    <>
      {snapshot && (
        <div className="fixed bottom-6 left-1/2 z-50 flex w-[90%] max-w-sm -translate-x-1/2 animate-slide-up items-center gap-4 rounded-card border border-accent bg-surface-elevated p-3 shadow-lg">
          <p className="flex-1 text-[13px] text-fg">{message}</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-[12px] font-medium text-fg-muted transition-colors hover:text-fg"
            >
              되돌리기
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-chip bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-hover"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* OCR announce — 라이브리전은 항상 마운트하고 텍스트만 바꾼다(#199). */}
      <div role="status" aria-live="polite" className="sr-only">
        {snapshot ? message : ''}
      </div>
    </>
  );
}
