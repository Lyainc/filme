import { useRef } from 'react';

interface FormatPickerProps {
  value: string;
  onChange: (value: string) => void;
  chain: string;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}

export default function FormatPicker({ value, onChange, visible, onVisibilityChange }: FormatPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (value && value.startsWith('blob:')) {
        URL.revokeObjectURL(value);
      }
      const objectUrl = URL.createObjectURL(file);
      onChange(objectUrl);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-mono w-14 shrink-0 text-[10px] uppercase tracking-widest text-fg-muted">
        Format
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

      {visible && (value ? (
        <div className="flex items-center gap-2 bg-paper border border-line rounded-chip px-3 py-1.5 h-9">
          <img src={value} alt="Uploaded Format" className="h-5 w-auto object-contain" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] text-fg-muted hover:text-fg underline ml-1"
          >
            Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-mono inline-flex min-h-touch items-center justify-center gap-2 rounded-chip border border-dashed border-line bg-surface-elevated px-4 text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:border-accent hover:text-accent"
        >
          Upload Format
        </button>
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
