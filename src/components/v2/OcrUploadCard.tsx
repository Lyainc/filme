import { useEffect, useRef, useState } from 'react';
import type { MovieInfo, TicketComponents } from '@/types';
import { runOcr } from '@/utils/ocr';
import { triggerKobisLookup } from '@/utils/kobisLookup';
import { ALLOWED_MIME, MAX_BYTES, chainLabelFor } from '@/utils/ocrConstants';

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
  onOcrApply: (params: {
    keys: Set<OcrDirectField>;
    prevValues: Partial<MovieInfo>;
    // OCR이 chain을 인식하면 chainVisible/chainLabel을 변경하는데, 이 라벨은
    // export에 포함되므로 undo가 반드시 되돌려야 한다(#141 리뷰 P1). 변경 직전 값.
    prevComponents?: Partial<TicketComponents>;
  }) => void;
  setComponents?: (components: Partial<TicketComponents>) => void;
  /** chain 변경 undo 스냅샷용 — 변경 전 컴포넌트 값을 읽는다. */
  currentComponents?: Partial<TicketComponents>;
  ocrEpochRef: { current: number };
  className?: string;
}

function ScanIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
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
  currentComponents,
  ocrEpochRef,
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

  function applyOcr(direct: Partial<MovieInfo>, title?: string, prevComponents?: Partial<TicketComponents>) {
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

    // Snapshot KOBIS-injectable fields so undo can revert them too.
    // KOBIS lookup only ever writes these 5 fields (see kobisLookup.ts);
    // store currentInfo[key] verbatim — preserving undefined — so undo
    // restores the exact pre-injection state instead of clobbering with ''.
    if (title) {
      const kobisKeys = ['title', 'titleOg', 'releaseDate', 'actors', 'runtime'] as const;
      for (const key of kobisKeys) {
        (prevValues as Record<string, unknown>)[key] = currentInfo[key];
      }
    }

    if (filled.size > 0) {
      setInfo(toApply);
    }

    // Surface the undo banner whenever OCR will mutate the form — direct fields
    // applied now, a title that schedules async KOBIS injection, or a chain that
    // set chainLabel/chainVisible on components. With zero direct fields the KOBIS
    // path still needs an undo affordance: keys is an empty Set, but prevValues
    // already carries the KOBIS snapshot (#100). chain-only도 라벨이 export에
    // 반영되므로 undo가 필요하다(#141 리뷰 P1).
    if (filled.size > 0 || title || prevComponents) {
      onOcrApply({ keys: filled, prevValues, prevComponents });
    }

    if (title) {
      const currentRunId = ++runIdRef.current;
      const epoch = ocrEpochRef.current;
      triggerKobisLookup(title).then((kobisInfo) => {
        if (!mountedRef.current || currentRunId !== runIdRef.current) return;
        if (epoch !== ocrEpochRef.current) return;
        setInfo(kobisInfo);
        if (!kobisInfo.titleOg && !kobisInfo.actors) {
          showToast('영화 제목을 확인 후 검색해 주세요.');
        }
      });
    }

    if (filled.size === 0 && !title && !prevComponents) {
      showToast('인식된 정보가 없어요. 직접 입력해 주세요.');
    } else if (filled.size === 0 && title) {
      showToast('제목으로 영화 정보를 검색할게요.');
    }
  }

  async function processFile(file: File) {
    setIsProcessing(true);

    try {
      const result = await runOcr(file);

      let prevComponents: Partial<TicketComponents> | undefined;
      if (result.chain && setComponents) {
        // 텍스트 라벨을 바로 채워 로고 없이도 체인이 표시되게 한다(#141 (7)). 이미지를 올리면
        // ChainStamp가 이미지를 우선하므로 라벨은 자동으로 가려진다.
        // 변경 전 값을 스냅샷해 undo가 라벨/노출을 정확히 되돌리게 한다(#141 리뷰 P1).
        prevComponents = {
          chainVisible: currentComponents?.chainVisible,
          chainLabel: currentComponents?.chainLabel,
        };
        const label = chainLabelFor(result.chain);
        setComponents({ chainVisible: true, chainLabel: label });
        showToast(`${label} 체인을 인식했어요. 로고 이미지는 아래 Theater에서 올릴 수 있어요.`);
      }

      const direct: Partial<MovieInfo> = {};
      for (const key of OCR_DIRECT_FIELDS) {
        if (result[key] !== undefined) {
          (direct as Record<string, unknown>)[key] = result[key];
        }
      }

      applyOcr(direct, result.title, prevComponents);
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

      {/* 포스터 드롭존이 주연, 자동 인식은 보조 액션으로 위계를 낮춘다(#142 (18)).
          큰 점선 카드 대신 한 줄짜리 텍스트 버튼 — 핵심 동작(파일 선택→runOcr→주입→undo)은 유지. */}
      <button
        type="button"
        onClick={handleClick}
        aria-disabled={isProcessing}
        aria-busy={isProcessing}
        aria-label="티켓 스크린샷으로 자동 인식"
        data-touch="44"
        className="group inline-flex min-h-touch items-center gap-1.5 rounded-chip text-[13px] text-fg-muted transition-colors hover:text-accent aria-disabled:cursor-default aria-disabled:opacity-70"
      >
        <span aria-hidden="true" className="text-fg-faint">⤷</span>
        <span className={isProcessing ? 'text-accent animate-pulse' : 'text-fg-faint group-hover:text-accent'}>
          <ScanIcon size={16} />
        </span>
        <span>{isProcessing ? '티켓 인식 중...' : '티켓 스크린샷으로 자동입력'}</span>
        {!isProcessing && (
          <span aria-hidden="true" className="text-fg-faint transition-transform group-hover:translate-x-0.5">›</span>
        )}
      </button>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-full left-0 mt-2 max-w-[260px] bg-fg text-surface-elevated text-xs font-medium px-3 py-1.5 rounded-chip shadow-lg animate-fade-in z-10"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
