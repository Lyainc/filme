import { useRef, useState } from 'react';
import type { MovieInfo, TicketComponents } from '@/types';
import { runOcr, runOcrBoxes, type OcrBoxItem } from '@/utils/ocr';
import { triggerKobisLookup } from '@/utils/kobisLookup';
import OcrReviewModal from './OcrReviewModal';

export type OcrDirectField = 'theater' | 'screen' | 'watchDate' | 'watchTime' | 'seat' | 'bookingNumber';
export const OCR_DIRECT_FIELDS: OcrDirectField[] = [
  'theater',
  'screen',
  'watchDate',
  'watchTime',
  'seat',
  'bookingNumber',
];

export interface OcrUploadCardProps {
  setInfo: (info: Partial<MovieInfo>) => void;
  /** Current form values — used to detect user edits before OCR re-run. */
  currentInfo: Partial<MovieInfo>;
  /** Called after OCR values are applied so the parent can track which fields are OCR-sourced. */
  onOcrFill: (keys: Set<OcrDirectField>) => void;
  /** Optional — when provided, a detected chain auto-selects the ticket chain logo. */
  setComponents?: (components: Partial<TicketComponents>) => void;
  className?: string;
}

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function ScanIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.75h.75v.75h-.75v-.75zM16.75 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75H13.5V13.5zM13.5 19.5h.75v.75H13.5V19.5zM19.5 13.5h.75v.75h-.75V13.5zM19.5 19.5h.75v.75h-.75V19.5zM16.5 16.5h.75v.75h-.75V16.5z" />
    </svg>
  );
}

export function OcrUploadCard({
  setInfo,
  currentInfo,
  onOcrFill,
  setComponents,
  className = '',
}: OcrUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Tracks values that were last written by OCR. Used to detect user edits on re-run.
  const lastOcrRef = useRef<Partial<MovieInfo>>({});

  // Pending OCR result waiting for user confirmation (conflict case)
  const [pendingOcr, setPendingOcr] = useState<{
    direct: Partial<MovieInfo>;
    title?: string;
    conflictCount: number;
  } | null>(null);

  const boxesInputRef = useRef<HTMLInputElement>(null);
  const [reviewItems, setReviewItems] = useState<OcrBoxItem[] | null>(null);

  function showToast(msg: string, durationMs = 3000) {
    setToast(msg);
    setTimeout(() => setToast(null), durationMs);
  }

  function validateFile(file: File): string | null {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'heic' || file.type === 'image/heic' || file.type === 'image/heif') {
      return 'HEIC 파일은 지원하지 않아요. PNG/JPG로 저장해 주세요.';
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return 'PNG, JPG, WebP 파일만 인식할 수 있어요.';
    }
    if (file.size > MAX_BYTES) {
      return '파일 크기가 10MB를 초과해요.';
    }
    return null;
  }

  /** Apply direct OCR fields to the form, then trigger KOBIS lookup for title. */
  function applyOcr(direct: Partial<MovieInfo>, title?: string) {
    const filled = new Set<OcrDirectField>();
    const toApply: Partial<MovieInfo> = {};

    for (const key of OCR_DIRECT_FIELDS) {
      if (direct[key] !== undefined) {
        (toApply as Record<string, unknown>)[key] = direct[key];
        filled.add(key);
      }
    }

    if (filled.size > 0) {
      setInfo(toApply);
      onOcrFill(filled);
      lastOcrRef.current = toApply;
    }

    if (title) {
      triggerKobisLookup(title).then((kobisInfo) => {
        setInfo(kobisInfo);
        if (!kobisInfo.titleOg && !kobisInfo.actors) {
          showToast('영화 제목을 확인 후 검색해 주세요.');
        }
      });
    }

    if (filled.size > 0) {
      showToast(`${filled.size}개 필드를 인식했어요. 확인해 주세요.`);
    } else if (!title) {
      showToast('인식된 정보가 없어요. 직접 입력해 주세요.');
    }
  }

  function confirmPending() {
    if (!pendingOcr) return;
    applyOcr(pendingOcr.direct, pendingOcr.title);
    setPendingOcr(null);
  }

  function cancelPending() {
    setPendingOcr(null);
  }

  function checkAndApplyOcr(direct: Partial<MovieInfo>, title?: string) {
    const lastOcr = lastOcrRef.current;
    const conflictKeys = OCR_DIRECT_FIELDS.filter((k) => {
      return (
        lastOcr[k] !== undefined &&
        currentInfo[k] !== lastOcr[k] &&
        direct[k] !== undefined
      );
    });

    if (conflictKeys.length > 0) {
      setPendingOcr({
        direct,
        title,
        conflictCount: conflictKeys.length,
      });
    } else {
      applyOcr(direct, title);
    }
  }

  async function processFile(file: File) {
    setIsProcessing(true);

    try {
      const result = await runOcr(file);

      if (result.chain && setComponents) setComponents({ chain: result.chain });

      const direct: Partial<MovieInfo> = {};
      for (const key of OCR_DIRECT_FIELDS) {
        if (result[key] !== undefined) {
          (direct as Record<string, unknown>)[key] = result[key];
        }
      }

      checkAndApplyOcr(direct, result.title);
    } catch {
      // Principle 5: silent fallback
    } finally {
      setIsProcessing(false);
    }
  }

  async function processFileBoxes(file: File) {
    setIsProcessing(true);
    try {
      const result = await runOcrBoxes(file);
      if (result.items.length > 0) {
        setReviewItems(result.items);
      } else {
        showToast('인식된 정보가 없어요.');
      }
    } catch {
      // silent fallback
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBoxesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const err = validateFile(file);
    if (err) {
      showToast(err);
      return;
    }

    await processFileBoxes(file);
  }

  function handleBoxesClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isProcessing && !pendingOcr && !reviewItems) {
      boxesInputRef.current?.click();
    }
  }

  function handleReviewConfirm(mappedData: Record<string, string>) {
    setReviewItems(null);
    const direct: Partial<MovieInfo> = {};
    for (const key of OCR_DIRECT_FIELDS) {
      if (mappedData[key] !== undefined) {
        (direct as Record<string, unknown>)[key] = mappedData[key];
      }
    }
    checkAndApplyOcr(direct, mappedData.title);
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const err = validateFile(file);
    if (err) {
      showToast(err);
      return;
    }

    await processFile(file);
  }

  function handleClick() {
    if (!isProcessing && !pendingOcr) {
      inputRef.current?.click();
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        onChange={handleChange}
      />
      <input
        ref={boxesInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        onChange={handleBoxesChange}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="티켓 스크린샷으로 자동 인식"
        aria-busy={isProcessing}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        className={`relative w-full rounded-card border-2 border-dashed overflow-hidden transition-colors
          ${isProcessing || pendingOcr
            ? 'border-accent cursor-default'
            : 'border-line hover:border-accent cursor-pointer'
          }`}
        style={{ paddingBottom: '150%' }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-3">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-accent animate-pulse"><ScanIcon /></span>
              <p className="text-xs text-fg-muted">인식 중...</p>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <span className="text-fg-muted"><ScanIcon /></span>
              <p className="text-xs text-fg-muted">티켓 스크린샷으로 자동 인식</p>
              <p className="text-[10px] text-fg-faint">PNG · JPG · WebP</p>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 text-center relative z-10">
        <button
          type="button"
          onClick={handleBoxesClick}
          className="text-xs text-fg-muted underline hover:text-fg transition-colors"
        >
          (베타) 칩 검수 모달로 인식하기
        </button>
      </div>

      {reviewItems && (
        <OcrReviewModal
          items={reviewItems}
          onClose={() => setReviewItems(null)}
          onConfirm={handleReviewConfirm}
        />
      )}

      {/* Conflict confirmation overlay */}
      {pendingOcr && (
        <div className="absolute inset-x-2 bottom-2 bg-surface-elevated border border-accent rounded-card shadow-lg p-3 z-20 space-y-2">
          <p className="text-xs text-fg leading-snug">
            수정한 {pendingOcr.conflictCount}개 필드를 새로 인식한 값으로 덮어쓸까요?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmPending}
              className="flex-1 rounded-chip bg-accent py-1 text-[11px] font-medium text-white"
            >
              덮어쓰기
            </button>
            <button
              type="button"
              onClick={cancelPending}
              className="flex-1 rounded-chip border border-line py-1 text-[11px] font-medium text-fg"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Info toast */}
      {toast && !pendingOcr && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-fg text-surface-elevated text-xs font-medium px-3 py-1.5 rounded-chip whitespace-nowrap shadow-lg animate-fade-in z-10">
          {toast}
        </div>
      )}
    </div>
  );
}
