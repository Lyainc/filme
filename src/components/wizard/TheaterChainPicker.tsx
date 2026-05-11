import { THEATER_CHAINS } from '@/utils/constants';

interface TheaterChainPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TheaterChainPicker({ value, onChange }: TheaterChainPickerProps) {
  return (
    <div className="space-y-2.5">
      <span className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted">
        Theater chain
      </span>
      <div className="flex flex-wrap gap-2">
        {THEATER_CHAINS.map((chain) => {
          const active = value === chain.value;
          return (
            <button
              key={chain.value || 'none'}
              type="button"
              onClick={() => onChange(chain.value)}
              data-touch="44"
              aria-pressed={active}
              className={`text-mono inline-flex min-h-touch items-center gap-2 rounded-chip border px-4 text-[11px] uppercase tracking-widest transition-colors
                ${
                  active
                    ? 'border-accent bg-accent text-white'
                    : 'hairline bg-paper text-fg hover:bg-accent-soft'
                }`}
            >
              {chain.file && (
                <img
                  src={`/assets/chains_transparent/${chain.file}`}
                  alt=""
                  className="h-4 w-auto"
                  style={{
                    filter: active ? 'brightness(0) invert(1)' : 'none',
                    opacity: active ? 0.95 : 0.85,
                  }}
                />
              )}
              <span>{chain.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
