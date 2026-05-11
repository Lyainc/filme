import { SCREENING_FORMATS } from '@/utils/constants';

interface FormatPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FormatPicker({ value, onChange }: FormatPickerProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted">
          Screening format
        </span>
        <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
          {value || 'none'}
        </span>
      </div>
      {/* Horizontal scroll on small screens; wrap on larger */}
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible md:pb-0"
        role="radiogroup"
        aria-label="Screening format"
      >
        {SCREENING_FORMATS.map((fmt) => {
          const active = value === fmt.value;
          return (
            <button
              key={fmt.value || 'none'}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(fmt.value)}
              data-touch="44"
              className={`text-mono inline-flex min-h-touch shrink-0 items-center gap-2 rounded-chip border px-4 text-[11px] uppercase tracking-widest transition-colors
                ${
                  active
                    ? 'border-accent bg-accent text-white'
                    : 'hairline bg-paper text-fg hover:bg-accent-soft'
                }`}
            >
              {fmt.file && (
                <img
                  src={`/assets/formats_transparent/${fmt.file}`}
                  alt=""
                  className="h-4 w-auto"
                  style={{
                    filter: active ? 'brightness(0) invert(1)' : 'none',
                    opacity: active ? 0.95 : 0.85,
                  }}
                />
              )}
              <span>{fmt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
