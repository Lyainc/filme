import { useRef } from 'react';

type UploadCardState = 'empty' | 'processing' | 'uploaded';

interface UploadCardProps {
  state?: UploadCardState;
  imageUrl?: string;
  label?: string;
  accept?: string;
  onFileSelect?: (file: File) => void;
  aspectRatio?: number;
  className?: string;
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function UploadCard({
  state = 'empty',
  imageUrl,
  label = '포스터 업로드',
  accept = 'image/*',
  onFileSelect,
  aspectRatio = 2 / 3,
  className = '',
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    if (state === 'processing') return;
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
    e.target.value = '';
  }

  const paddingBottom = `${(1 / aspectRatio) * 100}%`;

  return (
    <div
      className={`relative w-full rounded-card overflow-hidden ${
        state === 'empty'
          ? 'border-2 border-dashed border-line hover:border-accent cursor-pointer transition-colors duration-150'
          : state === 'processing'
          ? 'bg-surface-elevated cursor-wait'
          : 'bg-surface-elevated cursor-pointer'
      } ${className}`}
      style={{ paddingBottom }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        {state === 'empty' && (
          <>
            <span className="text-fg-muted"><UploadIcon /></span>
            <span className="text-sm text-fg-muted font-medium">{label}</span>
          </>
        )}

        {state === 'processing' && (
          <span className="text-fg-muted"><Spinner /></span>
        )}

        {state === 'uploaded' && imageUrl && (
          <>
            <img
              src={imageUrl}
              alt="업로드된 이미지"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors duration-200 flex items-center justify-center group">
              <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm font-medium">
                다시 업로드
              </span>
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        tabIndex={-1}
      />
    </div>
  );
}
