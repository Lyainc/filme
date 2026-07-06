import type { ReactNode } from 'react';
import type { LayoutSpec } from '@/utils/layouts';

// 프리뷰 3단 줌 모드 — 모바일(#214)·데스크톱(#225) 공용. 기본(인라인) · 최대화(세로 꽉) ·
// 실제 크기(물리 cm). 아이콘·라벨·cm 값의 단일 출처(중복 방지, #224 리뷰 P1 선례).
export type ViewMode = 'default' | 'max' | 'actual';

const ICON_SVG = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const VIEW_MODES: { id: ViewMode; label: string; icon: ReactNode }[] = [
  {
    // 기본: 베이스라인 있는 둥근 사각(인라인 카드)
    id: 'default',
    label: '기본',
    icon: (
      <svg {...ICON_SVG}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <line x1="4" y1="15" x2="20" y2="15" />
      </svg>
    ),
  },
  {
    // 최대화: 네 모서리 확장 화살표
    id: 'max',
    label: '최대화',
    icon: (
      <svg {...ICON_SVG}>
        <path d="M8 3H5a2 2 0 0 0-2 2v3" />
        <path d="M16 3h3a2 2 0 0 1 2 2v3" />
        <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      </svg>
    ),
  },
  {
    // 실제 크기: 점선 바깥틀 + 채운 안쪽 사각
    id: 'actual',
    label: '실제 크기',
    icon: (
      <svg {...ICON_SVG}>
        <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 2.5" />
        <rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

/**
 * 실제 크기 렌더용 방향별 cm 값 — DPI 계산 없이 CSS cm 그대로(1cm≈37.8px @96dpi, 모바일과 동일).
 * portrait 5.5×8.5cm(짧은변 5.5) / landscape 8.5×5.5cm(짧은변 8.5).
 */
export function actualSize(layout: LayoutSpec): { caption: string; shortSideCm: string } {
  return layout.orientation === 'landscape'
    ? { caption: '8.5 × 5.5cm', shortSideCm: '8.5cm' }
    : { caption: '5.5 × 8.5cm', shortSideCm: '5.5cm' };
}

/** 3아이콘 줌 pill. className은 바깥 group에 덧붙는다(모바일=미지정, 데스크톱=절대배치). */
export function ZoomSegment({
  viewMode,
  onChange,
  className = '',
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="미리보기 크기"
      className={`inline-flex items-center gap-1 rounded-full border border-line bg-surface-elevated p-1${
        className ? ` ${className}` : ''
      }`}
    >
      {VIEW_MODES.map((m) => {
        const selected = viewMode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            aria-pressed={selected}
            aria-label={m.label}
            title={m.label}
            className={`flex h-9 items-center justify-center rounded-full px-3.5 transition-colors ${
              selected ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {m.icon}
          </button>
        );
      })}
    </div>
  );
}
