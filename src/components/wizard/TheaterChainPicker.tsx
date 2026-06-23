import { useRef } from 'react';

interface TheaterChainPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** 텍스트 라벨(이미지 없을 때 티켓에 표시) — OCR 자동 채움 + 수동 편집(#141 (7)). */
  label: string;
  onLabelChange: (value: string) => void;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}

export default function TheaterChainPicker({
  value,
  onChange,
  label,
  onLabelChange,
  visible,
  onVisibilityChange,
}: TheaterChainPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      // Use Object URL and revoke old one
      if (value && value.startsWith('blob:')) {
        URL.revokeObjectURL(value);
      }
      const objectUrl = URL.createObjectURL(file);
      onChange(objectUrl);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <span className="text-mono w-14 shrink-0 text-[10px] uppercase tracking-widest text-fg-muted">
          Theater
        </span>
        <button
          type="button"
          onClick={() => onVisibilityChange(!visible)}
          className={`text-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-chip border transition-colors ${
            visible ? 'border-accent text-accent' : 'border-line text-fg-muted hover:text-fg'
          }`}
        >
          {visible ? 'ON' : 'OFF'}
        </button>
      </div>

      {visible && (value ? (
        <div className="flex items-center gap-2 bg-paper border border-line rounded-chip px-3 py-1.5 h-9 w-fit">
          <img src={value} alt="Uploaded" className="h-5 w-auto object-contain" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] text-fg-muted hover:text-fg underline ml-1"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {/* 이미지 없을 때 텍스트 라벨로 출력 — OCR이 채우거나 직접 입력(#141 (7)) */}
          <input
            type="text"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="CGV"
            maxLength={24}
            aria-label="극장 텍스트 라벨"
            className="text-mono w-24 rounded-field border border-line bg-surface-elevated px-3 py-2 text-[12px] uppercase tracking-widest text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-mono inline-flex min-h-touch items-center justify-center gap-2 rounded-chip border border-dashed border-line bg-surface-elevated px-4 text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:border-accent hover:text-accent"
          >
            Upload Logo
          </button>
        </div>
      ))}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        className="sr-only"
      />
    </div>
  );
}
