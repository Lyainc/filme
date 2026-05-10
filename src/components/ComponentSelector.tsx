import { TicketComponents, LayoutId } from '@/types';
import { THEATER_CHAINS, SCREENING_FORMATS, TEXTURE_OPTIONS } from '@/utils/constants';
import SectionHeader from './ui/SectionHeader';
import LayoutPicker from './LayoutPicker';

interface ComponentSelectorProps {
  components: TicketComponents;
  recommendedColors: string[];
  onChange: (components: Partial<TicketComponents>) => void;
}

export default function ComponentSelector({
  components,
  recommendedColors,
  onChange,
}: ComponentSelectorProps) {
  const colorOptions = [
    { label: 'White', value: '#FFFFFF' },
    { label: 'Black', value: '#000000' },
    { label: 'Gold', value: '#E5B469' },
    ...(recommendedColors[0] ? [{ label: 'Pick 1', value: recommendedColors[0] }] : []),
    ...(recommendedColors[1] ? [{ label: 'Pick 2', value: recommendedColors[1] }] : []),
  ];

  const isCustomColor = !colorOptions.some((opt) => opt.value === components.themeColor);

  return (
    <section className="space-y-12">
      <div>
        <SectionHeader index="03" title="Mood" caption="Layout · 4 designs" />
        <LayoutPicker
          value={components.layout}
          onChange={(id: LayoutId) => onChange({ layout: id })}
        />
      </div>

      <div>
        <SectionHeader index="04" title="Finish" caption="Color · texture · format" />

        <div className="space-y-8">
        {/* Opacity slider */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="posterOpacity"
              className="text-mono text-[10px] uppercase tracking-widest text-bone-400"
            >
              Poster brightness
            </label>
            <span className="text-mono text-[10px] uppercase tracking-widest text-gold">
              {Math.round(components.posterOpacity * 100)}%
            </span>
          </div>
          <input
            id="posterOpacity"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={components.posterOpacity}
            onChange={(e) => onChange({ posterOpacity: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* Theme color */}
        <div className="space-y-3">
          <span className="block text-mono text-[10px] uppercase tracking-widest text-bone-400">
            Ink · logo & type color
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {colorOptions.map((opt) => {
              const active = components.themeColor === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ themeColor: opt.value })}
                  title={opt.label}
                  className={`group relative h-9 w-9 rounded-full border transition-all ${
                    active
                      ? 'border-gold scale-110 shadow-[0_0_0_3px_rgba(229,180,105,0.15)]'
                      : 'border-white/15 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: opt.value }}
                >
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs mix-blend-difference text-white">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}

            <div className="relative">
              <input
                type="color"
                aria-label="Custom color"
                value={isCustomColor ? components.themeColor : '#FFFFFF'}
                onChange={(e) => onChange({ themeColor: e.target.value })}
                className={`h-9 w-9 cursor-pointer rounded-full border transition-all ${
                  isCustomColor
                    ? 'border-gold scale-110 shadow-[0_0_0_3px_rgba(229,180,105,0.15)]'
                    : 'border-white/15 hover:border-white/40'
                }`}
              />
            </div>
            <span className="text-mono ml-1 text-[10px] uppercase tracking-widest text-bone-500">
              custom
            </span>
          </div>
        </div>

        {/* Texture */}
        <SelectField
          id="texture"
          label="Surface treatment"
          value={components.texture}
          onChange={(value) => onChange({ texture: value })}
          options={TEXTURE_OPTIONS}
        />

        {/* Chain & format */}
        <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
          <SelectField
            id="chain"
            label="Theater chain"
            value={components.chain}
            onChange={(value) => onChange({ chain: value })}
            options={THEATER_CHAINS}
          />
          <SelectField
            id="format"
            label="Screening format"
            value={components.format}
            onChange={(value) => onChange({ format: value })}
            options={SCREENING_FORMATS}
          />
        </div>
        </div>
      </div>
    </section>
  );
}

interface SelectOption {
  readonly value: string;
  readonly label: string;
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly SelectOption[];
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-mono text-[10px] uppercase tracking-widest text-bone-400"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none border-0 border-b border-white/[0.12] bg-transparent px-0 py-2.5 pr-8 text-[15px] text-paper outline-none transition-colors focus:border-gold"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-ink-100 text-paper">
              {opt.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className="text-mono pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-xs text-bone-400"
        >
          ▾
        </span>
      </div>
    </div>
  );
}
