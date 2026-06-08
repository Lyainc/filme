import { useEffect, useRef, useState } from 'react';
import type { MovieInfo, TicketComponents } from '@/types';
import { runOcr } from '@/utils/ocr';
import { triggerKobisLookup } from '@/utils/kobisLookup';

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
  currentInfo: Partial<MovieInfo>;
  onOcrApply: (params: { keys: Set<OcrDirectField>; prevValues: Partial<MovieInfo> }) => void;
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
  onOcrApply,
  setComponents,
  className = '',
}: OcrUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // KOBIS async race guard
  const runIdRef = useRef(0);
  // 언마운트 후 비동기 콜백의 setState 누수 가드
  const mountedRef = useRef(true);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true; // Strict Mode 재마운트 시 true 복구
    return () => {
      mountedRef.current = false;
      clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(msg: string, durationMs = 3000) {
    if (!mountedRef.current) return;
    setToast(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), durationMs);
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

  function applyOcr(direct: Partial<MovieInfo>, title?: string) {
    const filled = new Set<OcrDirectField>();
    const toApply: Partial<MovieInfo> = {};
    const prevValues: Partial<MovieInfo> = {};

    for (const key of OCR_DIRECT_FIELDS) {
      if (direct[key] !== undefined) {
        (toApply as Record<string, unknown>)[key] = direct[key];
        (prevValues as Record<string, unknown>)[key] = currentInfo[key];
        filled.add(key);
      }
    }

    if (filled.size > 0) {
      setInfo(toApply);
      onOcrApply({ keys: filled, prevValues });
    }

    if (title) {
      const currentRunId = ++runIdRef.current;
      triggerKobisLookup(title).then((kobisInfo) => {
        if (!mountedRef.current || currentRunId !== runIdRef.current) return;
        setInfo(kobisInfo);
        if (!kobisInfo.titleOg && !kobisInfo.actors) {
          showToast('영화 제목을 확인 후 검색해 주세요.');
        }
      });
    }

    if (filled.size === 0 && !title) {
      showToast('인식된 정보가 없어요. 직접 입력해 주세요.');
    } else if (filled.size === 0 && title) {
      showToast('인식된 정보가 없어요. 제목으로 영화 정보만 검색할게요.');
    }
  }

  async function processFile(file: File) {
    setIsProcessing(true);

    try {
      const result = await runOcr(file);

      if (result.chain && setComponents) {
        setComponents({ chainVisible: true });
        showToast(`${result.chain.toUpperCase()} 체인을 인식했어요. 로고는 다음 단계에서 올려 주세요.`);
      }

      const direct: Partial<MovieInfo> = {};
      for (const key of OCR_DIRECT_FIELDS) {
        if (result[key] !== undefined) {
          (direct as Record<string, unknown>)[key] = result[key];
        }
      }

      applyOcr(direct, result.title);
    } catch {
      // silent fallback
    } finally {
      if (mountedRef.current) setIsProcessing(false);
    }
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
    if (!isProcessing) {
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

      <div
        role="button"
        tabIndex={0}
        aria-label="티켓 스크린샷으로 자동 인식"
        aria-busy={isProcessing}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        className={`relative w-full rounded-card border-2 border-dashed overflow-hidden transition-colors
          ${isProcessing
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

      {toast && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-fg text-surface-elevated text-xs font-medium px-3 py-1.5 rounded-chip whitespace-nowrap shadow-lg animate-fade-in z-10">
          {toast}
        </div>
      )}
    </div>
  );
}
