import { ReactNode } from 'react';

interface FieldV2Props {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  ok?: boolean;
  children: ReactNode;
  className?: string;
}

export function FieldV2({ label, required, hint, error, ok, children, className = '' }: FieldV2Props) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-fg-muted">{label}</span>
        {required !== undefined && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              required
                ? 'bg-accent-soft text-accent'
                : 'bg-surface-elevated text-fg-muted border border-line'
            }`}
          >
            {required ? '필수' : '선택'}
          </span>
        )}
      </div>

      {children}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-danger">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zm-.5 2.5h1v3.5h-1V3.5zm0 4.5h1v1h-1V8z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {!error && ok && (
        <div className="flex items-center gap-1.5 text-xs text-success">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M10.28 2.28 4.75 7.81 1.72 4.78.28 6.22l4.47 4.47 7-7-1.47-1.41z" />
          </svg>
          <span>확인됨</span>
        </div>
      )}

      {!error && !ok && hint && (
        <p className="text-xs text-fg-muted">{hint}</p>
      )}
    </div>
  );
}
