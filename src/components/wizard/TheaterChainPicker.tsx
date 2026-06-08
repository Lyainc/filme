import { useRef } from 'react';

interface TheaterChainPickerProps {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}

export default function TheaterChainPicker({ value, onChange, visible, onVisibilityChange }: TheaterChainPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted">
          Theater chain
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

      {visible && (
        <div className="flex items-center gap-3">
          {value ? (
            <div className="flex items-center gap-2 bg-paper border border-line rounded-chip px-3 py-1.5 h-11">
              <img src={value} alt="Uploaded" className="h-6 w-auto object-contain" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-fg-muted hover:text-fg underline ml-2"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-mono inline-flex items-center justify-center min-h-touch gap-2 rounded-chip border border-dashed border-line bg-surface-elevated px-4 text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:border-accent hover:text-accent"
            >
              Upload Logo
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileChange}
            className="sr-only"
          />
        </div>
      )}
    </div>
  );
}
