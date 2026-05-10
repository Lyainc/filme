import { TEXTURE_OPTIONS } from '@/utils/constants';

interface TexturePickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TexturePicker({ value, onChange }: TexturePickerProps) {
  return (
    <div className="space-y-2.5">
      <span className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted">
        Surface treatment
      </span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Texture">
        {TEXTURE_OPTIONS.map((tex) => {
          const active = value === tex.value;
          // Show only short label (first parenthesis-free portion) on chip
          const short = tex.label.split('(')[0].trim();
          return (
            <button
              key={tex.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(tex.value)}
              data-touch="44"
              title={tex.label}
              className={`text-mono inline-flex min-h-touch items-center rounded-chip border px-4 text-[11px] uppercase tracking-widest transition-colors
                ${
                  active
                    ? 'border-accent bg-accent text-paper'
                    : 'hairline bg-paper text-fg hover:bg-accent-soft'
                }`}
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
