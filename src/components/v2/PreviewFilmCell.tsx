import { ReactNode } from 'react';

interface PreviewFilmCellProps {
  /** 다운로드(저장) 진행 중이면 오버레이를 띄운다. */
  saving?: boolean;
  children?: ReactNode;
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

export function PreviewFilmCell({ saving = false, children, className = '' }: PreviewFilmCellProps) {
  return (
    <div
      className={`flex flex-col bg-black rounded-card overflow-hidden ${className}`}
      style={{ position: 'relative', isolation: 'isolate' }}
    >
      <div className="relative flex-1 flex items-center justify-center bg-black">
        {children}

        {saving && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm z-10">
            <span className="text-white"><Spinner /></span>
            <span className="text-white text-sm font-medium">저장 중...</span>
          </div>
        )}
      </div>
    </div>
  );
}
