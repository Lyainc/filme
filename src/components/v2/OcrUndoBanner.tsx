import type { OcrDirectField } from './OcrUploadCard';
import type { MovieInfo } from '@/types';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';

interface OcrUndoBannerProps {
  /** non-null이면 배너를 노출한다 — useOcrUndo.snapshot을 그대로 넘긴다. */
  snapshot: Partial<MovieInfo> | null;
  filledFields: Set<OcrDirectField>;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * OCR 낙관적 주입 되돌리기 배너 + sr-only 라이브리전 — MobileEditorShell(모바일)과
 * 셸이 쓰는 표현 계층(#141-class drift 방지). 로직은 useOcrUndo.
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
        <div
          data-testid="ocr-undo-banner"
          className="fixed bottom-6 left-1/2 z-50 flex w-[90%] max-w-sm -translate-x-1/2 animate-slide-up items-center gap-4 rounded-card border border-accent bg-surface-elevated p-3 shadow-lg"
        >
          <p className="flex-1 text-body text-fg">{message}</p>
          {/* WCAG 2.5.8(AA) 최소 24×24 미달 → min-h-touch(44px)로 채운다(#646). cancel()은 확인 없이
              바로 스냅샷으로 되돌려 방금 채운 값을 지우는 쪽이라(useOcrUndo.ts) 되돌리기가 더 작으면
              안 된다 — 두 버튼을 동일 높이로 맞춘다. */}
          <div className="flex shrink-0 items-stretch gap-2">
            <button
              type="button"
              onClick={onCancel}
              className={cn(pressableVariants(), 'min-h-touch inline-flex items-center px-2 text-caption font-medium text-fg-muted transition-colors hover:text-fg')}
            >
              되돌리기
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={cn(pressableVariants(), 'min-h-touch inline-flex items-center rounded-chip bg-accent px-3 text-caption font-medium text-accent-ink transition-colors hover:bg-accent-hover')}
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
