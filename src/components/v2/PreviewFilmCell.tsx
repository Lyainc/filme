import { ReactNode, useEffect, useRef, useState } from 'react';

type PreviewState = 'empty' | 'updating' | 'ready' | 'saving' | 'saved';

interface PreviewFilmCellProps {
  state?: PreviewState;
  children?: ReactNode;
  mountSlot?: HTMLElement;
  className?: string;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PerforationStrip() {
  return (
    <div className="flex items-center gap-1.5 py-2 px-1 bg-black w-full">
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="w-3 h-3 rounded-full border border-white/20 bg-white/10 shrink-0"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

export function PreviewFilmCell({
  state = 'empty',
  children,
  className = '',
}: PreviewFilmCellProps) {
  const [savedDone, setSavedDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state === 'saved') {
      setSavedDone(false);
      timerRef.current = setTimeout(() => setSavedDone(true), 2000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setSavedDone(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state]);

  const displayState = state === 'saved' && savedDone ? 'ready' : state;

  const showOverlay = displayState === 'updating' || displayState === 'saving' || displayState === 'saved';
  const overlayLabel =
    displayState === 'updating' ? '업데이트 중...' :
    displayState === 'saving' ? '저장 중...' :
    displayState === 'saved' ? '저장됨' : '';

  return (
    <div
      className={`flex flex-col bg-black rounded-card overflow-hidden ${className}`}
      style={{ position: 'relative', isolation: 'isolate' }}
    >
      <PerforationStrip />

      <div className="relative flex-1 flex items-center justify-center bg-black">
        {children}

        {showOverlay && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm z-10">
            {(displayState === 'updating' || displayState === 'saving') && (
              <span className="text-white"><Spinner /></span>
            )}
            {displayState === 'saved' && (
              <svg width="20" height="20" viewBox="0 0 12 12" fill="white" aria-hidden="true">
                <path d="M10.28 2.28 4.75 7.81 1.72 4.78.28 6.22l4.47 4.47 7-7-1.47-1.41z" />
              </svg>
            )}
            <span className="text-white text-sm font-medium">{overlayLabel}</span>
          </div>
        )}
      </div>

      <PerforationStrip />
    </div>
  );
}
