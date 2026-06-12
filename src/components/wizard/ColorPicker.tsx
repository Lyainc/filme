interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  recommended: string[];
}

const PRESETS = [
  { label: 'White', value: '#FFFFFF' },
  { label: 'Black', value: '#000000' },
  { label: 'Gold', value: '#E5B469' },
];

export default function ColorPicker({ value, onChange, recommended }: ColorPickerProps) {
  // 추천색이 프리셋과(또는 서로) 같은 hex일 수 있어 — 순백/순흑 단색 포스터 등 — value가
  // 곧 React key인 이상 중복이면 key 충돌 경고가 난다. 첫 항목(프리셋 우선)을 남기고
  // hex(대소문자 무시)로 dedupe한다(#105). 추출 단계 dedupe와 별개로 프리셋 충돌까지 막는다.
  const seen = new Set<string>();
  const swatches = [
    ...PRESETS,
    ...(recommended[0] ? [{ label: 'Pick 1', value: recommended[0] }] : []),
    ...(recommended[1] ? [{ label: 'Pick 2', value: recommended[1] }] : []),
  ].filter((s) => {
    const key = s.value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const lowerValue = value.toLowerCase();
  const isCustom = !swatches.some((s) => s.value.toLowerCase() === lowerValue);
  const displayHex = value.toUpperCase();

  return (
    <div className="space-y-2.5">
      <span className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted">
        Ink · logo & type color
      </span>
      <div className="flex flex-wrap items-center gap-2.5">
        {swatches.map((s) => {
          const active = s.value.toLowerCase() === lowerValue;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange(s.value)}
              title={s.label}
              aria-label={s.label}
              data-touch="44"
              className={`relative inline-flex min-h-touch min-w-touch items-center justify-center rounded-chip border-2 transition-transform ${
                active
                  ? 'border-accent scale-105'
                  : 'border-line hover:border-accent/40'
              }`}
              style={{
                width: 44,
                height: 44,
                // 이중 링: 내부 bg-gap + accent 링으로 44px 원에서도 활성 상태 또렷
                boxShadow: active ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' : undefined,
              }}
            >
              <span
                className="block h-7 w-7 rounded-chip"
                style={{
                  backgroundColor: s.value,
                  boxShadow: 'inset 0 0 0 1px rgba(44,38,34,0.08)',
                }}
              />
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center text-[10px] mix-blend-difference text-white"
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}

        <label className="relative inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center">
          <input
            type="color"
            aria-label="Custom color"
            value={isCustom ? value : '#FFFFFF'}
            onChange={(e) => onChange(e.target.value)}
            className="sr-only"
          />
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-chip border-2 transition-transform ${
              isCustom ? 'border-accent scale-105' : 'border-line hover:border-accent/40'
            }`}
            style={{
              background:
                'conic-gradient(from 0deg, #C08079, #D4B483, #8FA99E, #7E93A8, #9A8BA3, #C08079)',
              boxShadow: isCustom ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' : undefined,
            }}
            aria-hidden
          />
        </label>
        <span className="text-mono ml-1 text-[10px] uppercase tracking-widest text-fg-faint">
          custom
        </span>
      </div>

      <div className="flex items-stretch gap-2 pt-1">
        <span
          aria-hidden
          className="inline-flex shrink-0 items-center justify-center rounded-field border border-line px-3 text-[15px] text-fg-muted"
          style={{ minWidth: 44 }}
        >
          #
        </span>
        <input
          type="text"
          value={displayHex.replace('#', '')}
          onChange={(e) => {
            const sanitized = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
            onChange(`#${sanitized}`);
          }}
          maxLength={6}
          aria-label="Hex color"
          placeholder="FFFFFF"
          className="text-mono w-full rounded-field border border-line bg-paper px-3.5 py-2.5 text-[14px] uppercase tracking-widest text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </div>
    </div>
  );
}
