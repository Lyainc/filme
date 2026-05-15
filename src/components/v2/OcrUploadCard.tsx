import { useState, useEffect } from 'react';

interface OcrUploadCardProps {
  className?: string;
}

function ScanIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.75h.75v.75h-.75v-.75zM16.75 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75H13.5V13.5zM13.5 19.5h.75v.75H13.5V19.5zM19.5 13.5h.75v.75h-.75V13.5zM19.5 19.5h.75v.75h-.75V19.5zM16.5 16.5h.75v.75h-.75V16.5z" />
    </svg>
  );
}

export function OcrUploadCard({ className = '' }: OcrUploadCardProps) {
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => setToastVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  function handleClick() {
    setToastVisible(true);
  }

  return (
    <div className={`relative ${className}`}>
      <div
        role="button"
        tabIndex={0}
        aria-disabled="true"
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
        className="relative w-full rounded-card border-2 border-dashed border-line opacity-60 cursor-default overflow-hidden"
        style={{ paddingBottom: '150%' }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="text-fg-muted"><ScanIcon /></span>
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xs font-semibold bg-accent-soft text-accent px-2 py-0.5 rounded-chip">
                OCR 예정
              </span>
            </div>
            <p className="text-xs text-fg-muted">포스터로 자동 인식</p>
          </div>
        </div>
      </div>

      {toastVisible && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-fg text-surface-elevated text-xs font-medium px-3 py-1.5 rounded-chip whitespace-nowrap shadow-lg animate-fade-in z-10">
          곧 추가될 기능이에요
        </div>
      )}
    </div>
  );
}
