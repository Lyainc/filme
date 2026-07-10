import type { ReactNode } from 'react';

// 프리뷰 2단 줌 모드 — 모바일(#214)·데스크톱(#225) 공용. 기본(인라인) · 최대화(세로 꽉).
// 아이콘·라벨의 단일 출처(중복 방지, #224 리뷰 P1 선례).
// "실제 크기(cm)" 모드는 #311에서 제거 — 웹은 물리 DPI를 못 읽어 CSS cm이 실측과 어긋나고(#275-7),
// 이를 보정할 슬라이더도 UI 비용 대비 이득이 적어 걷어냈다. 실물 크기 확인 니즈는 모드 대신
// 최대화(pinch-zoom 가능한 전체화면)로 커버한다.
export type ViewMode = 'default' | 'max';

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
];

/** 2아이콘 줌 pill. className은 바깥 group에 덧붙는다(모바일=미지정, 데스크톱=절대배치). */
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
