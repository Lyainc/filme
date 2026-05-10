import { ReactNode, memo } from 'react';
import { LAYOUTS, type LayoutSpec } from '@/utils/layouts';
import type { LayoutId } from '@/types';

interface LayoutPickerProps {
  value: LayoutId;
  onChange: (id: LayoutId) => void;
}

function LayoutPicker({ value, onChange }: LayoutPickerProps) {
  return (
    <div className="space-y-3">
      <span className="block text-mono text-[10px] uppercase tracking-widest text-bone-400">
        Mood · 4 designs
      </span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {LAYOUTS.map((layout) => {
          const active = value === layout.id;
          return (
            <button
              key={layout.id}
              type="button"
              onClick={() => onChange(layout.id)}
              className={`group relative flex flex-col items-stretch gap-2 border bg-ink-100/40 p-3 text-left transition-all ${
                active
                  ? 'border-gold bg-gold/[0.06] shadow-[0_0_0_1px_rgba(229,180,105,0.3)]'
                  : 'border-white/[0.08] hover:border-white/30 hover:bg-ink-100/80'
              }`}
            >
              <Thumbnail layout={layout} active={active} />
              <div className="space-y-0.5">
                <div
                  className={`text-mono text-[10px] uppercase tracking-widest ${
                    active ? 'text-gold' : 'text-bone-400 group-hover:text-paper'
                  }`}
                >
                  {layout.label}
                </div>
                <div className="text-[11px] leading-tight text-bone-500/80">{layout.caption}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(LayoutPicker);

interface ThumbColors {
  stroke: string;
  dim: string;
}

const THUMBNAIL_RENDERERS: Record<LayoutId, (c: ThumbColors) => ReactNode> = {
  minimal: ({ stroke, dim }) => (
    <>
      <rect x="0" y="0" width="80" height="22" fill={dim} opacity="0.3" />
      <rect x="6" y="9" width="14" height="3" fill={stroke} />
      <rect x="56" y="9" width="18" height="3" fill={stroke} />
      <rect x="0" y="22" width="80" height="48" fill={dim} opacity="0.15" />
      <rect x="0" y="60" width="80" height="40" fill="rgba(0,0,0,0.6)" />
      <rect x="6" y="68" width="40" height="4" fill={stroke} />
      <rect x="6" y="76" width="50" height="6" fill={stroke} />
      <rect x="6" y="86" width="14" height="2" fill={dim} />
      <rect x="22" y="86" width="20" height="2" fill={dim} />
      <rect x="6" y="92" width="10" height="2" fill={dim} />
      <rect x="58" y="86" width="14" height="6" fill={dim} />
    </>
  ),
  criterion: ({ stroke, dim }) => (
    <>
      <rect x="0" y="0" width="80" height="100" fill={dim} opacity="0.2" />
      <rect x="0" y="0" width="9" height="100" fill="rgba(255,255,255,0.06)" />
      <line x1="9" y1="0" x2="9" y2="100" stroke={stroke} strokeWidth="0.5" />
      <text
        x="4.5"
        y="50"
        textAnchor="middle"
        fontSize="3"
        fill={stroke}
        transform="rotate(-90 4.5 50)"
      >
        PHOTOTICKET
      </text>
      <rect x="14" y="14" width="3" height="3" fill="none" stroke={stroke} strokeWidth="0.4" />
      <rect x="50" y="10" width="22" height="6" fill={stroke} opacity="0.7" />
      <line x1="14" y1="38" x2="74" y2="38" stroke={stroke} strokeWidth="0.4" />
      <rect x="14" y="42" width="40" height="6" fill={stroke} />
      <line x1="14" y1="58" x2="74" y2="58" stroke={stroke} strokeWidth="0.4" />
      <rect x="14" y="80" width="36" height="2" fill={dim} />
      <circle cx="64" cy="84" r="9" fill="none" stroke={stroke} strokeWidth="0.5" />
      <circle
        cx="64"
        cy="84"
        r="6"
        fill="none"
        stroke={stroke}
        strokeWidth="0.3"
        strokeDasharray="0.8 1.4"
      />
    </>
  ),
  '35mm': ({ stroke, dim }) => (
    <>
      <rect x="0" y="0" width="80" height="9" fill="#0a0a0a" />
      <rect x="0" y="91" width="80" height="9" fill="#0a0a0a" />
      {[6, 16, 26, 36, 46, 56, 66, 76].map((x) => (
        <rect key={`top-${x}`} x={x} y="3" width="4" height="3" rx="0.5" fill="#f6f1e4" />
      ))}
      {[6, 16, 26, 36, 46, 56, 66, 76].map((x) => (
        <rect key={`bot-${x}`} x={x} y="94" width="4" height="3" rx="0.5" fill="#f6f1e4" />
      ))}
      <rect x="0" y="9" width="80" height="82" fill={dim} opacity="0.18" />
      <rect x="0" y="64" width="80" height="27" fill="rgba(0,0,0,0.7)" />
      <rect x="6" y="68" width="22" height="2" fill={dim} />
      <rect x="6" y="74" width="48" height="4" fill={stroke} />
      <rect x="6" y="82" width="30" height="2" fill={dim} />
      <rect x="58" y="82" width="14" height="4" fill={dim} />
    </>
  ),
  editorial: ({ stroke, dim }) => (
    <>
      <rect x="0" y="0" width="32" height="100" fill={dim} opacity="0.5" />
      <line x1="33" y1="0" x2="33" y2="100" stroke={stroke} strokeWidth="0.4" strokeDasharray="0.6 1" />
      <rect x="34" y="0" width="46" height="100" fill="#f4ede0" />
      <rect x="34" y="0" width="0.8" height="100" fill="#A8312A" />
      <rect x="38" y="6" width="14" height="3" fill="#1a1612" />
      <rect x="56" y="6" width="20" height="2" fill="#8a7e63" />
      <line x1="38" y1="14" x2="78" y2="14" stroke="#1a1612" strokeWidth="0.3" />
      <rect x="38" y="20" width="36" height="6" fill="#1a1612" />
      <rect x="38" y="30" width="22" height="2" fill="#8a7e63" />
      <line x1="38" y1="38" x2="78" y2="38" stroke="#1a1612" strokeWidth="0.3" />
      <rect x="38" y="44" width="14" height="3" fill="#1a1612" />
      <rect x="58" y="44" width="14" height="3" fill="#1a1612" />
      <rect x="38" y="56" width="14" height="3" fill="#1a1612" />
      <rect x="58" y="56" width="14" height="3" fill="#1a1612" />
      <line x1="38" y1="74" x2="78" y2="74" stroke="#1a1612" strokeWidth="0.3" />
      <rect x="38" y="80" width="10" height="2" fill="#1a1612" />
      <rect x="62" y="80" width="14" height="6" fill="#1a1612" />
    </>
  ),
};

const Thumbnail = memo(function Thumbnail({
  layout,
  active,
}: {
  layout: LayoutSpec;
  active: boolean;
}) {
  const stroke = active ? '#E5B469' : 'rgba(216,210,194,0.45)';
  const dim = active ? 'rgba(229,180,105,0.7)' : 'rgba(216,210,194,0.25)';
  const inkBg = active ? 'rgba(229,180,105,0.12)' : 'rgba(255,255,255,0.04)';

  return (
    <div
      className="relative w-full overflow-hidden bg-ink-200"
      style={{ aspectRatio: layout.orientation === 'landscape' ? '4/3' : '0.78/1' }}
    >
      <svg
        viewBox="0 0 80 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        style={{ background: inkBg }}
      >
        {THUMBNAIL_RENDERERS[layout.id]({ stroke, dim })}
      </svg>
    </div>
  );
});
