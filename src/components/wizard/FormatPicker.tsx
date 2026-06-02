import { useEffect, useMemo } from 'react';
import { SCREENING_FORMATS } from '@/utils/constants';
import { allowedFormatsForChain } from '@/utils/chainFormatMap';

interface FormatPickerProps {
  value: string;
  onChange: (value: string) => void;
  chain: string;
}

export default function FormatPicker({ value, onChange, chain }: FormatPickerProps) {
  const visibleFormats = useMemo(() => {
    const allowed = allowedFormatsForChain(chain);
    if (!allowed) return SCREENING_FORMATS;
    return SCREENING_FORMATS.filter((f) => f.value === '' || allowed.includes(f.value));
  }, [chain]);

  // Self-correction: when chain changes and current value is incompatible, clear it.
  useEffect(() => {
    const allowed = allowedFormatsForChain(chain);
    if (allowed && value && !allowed.includes(value)) {
      onChange('');
    }
    // onChange는 useState setter로 stable — deps 포함 시 인라인 함수 참조 변경마다 불필요 재실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain, value]);

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
      <div
        className="-mx-1 flex flex-wrap gap-2 px-1 pb-1"
        role="radiogroup"
        aria-label="Screening format"
      >
        {visibleFormats.map((fmt) => {
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
                    : 'border-line bg-paper text-fg hover:bg-accent-soft'
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
