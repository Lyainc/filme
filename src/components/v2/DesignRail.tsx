import { useRef, useState, type ReactNode } from 'react';
import { LayoutStrip } from '@/components/LayoutPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import ColorPicker from '@/components/wizard/ColorPicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import type { LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 모바일 디자인 레일(#217+): 무드·컬러·후보정·투명도 편집 콘텐츠를 인라인 폼 밖으로 빼 가로 원형
// 아이콘 + 단일 공용 확장 패널로 호스팅한다. 컬러(#218)·투명도(#219) 추가 완료.
type Pop = 'mood' | 'color' | 'texture' | 'opacity';

const PANEL_ID = 'design-rail-panel';

const RAIL_ICON = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const RAIL_ITEMS: { id: Pop; label: string; eyebrow: string; icon: ReactNode }[] = [
  {
    id: 'mood',
    label: '무드',
    eyebrow: 'Mood',
    // 사면체 힌트: 외곽 삼각 + 꼭짓점→밑변 중앙 능선
    icon: (
      <svg {...RAIL_ICON}>
        <path d="M12 3 21 20H3Z" />
        <path d="M12 3v17" />
      </svg>
    ),
  },
  {
    id: 'color',
    label: '컬러',
    eyebrow: 'Color',
    // 컬러: 겹친 두 원(잉크 색 혼합 힌트)
    icon: (
      <svg {...RAIL_ICON}>
        <circle cx="9" cy="12" r="5" />
        <circle cx="15" cy="12" r="5" />
      </svg>
    ),
  },
  {
    id: 'texture',
    label: '후보정',
    eyebrow: 'Texture',
    // 질감: 대각선 3줄
    icon: (
      <svg {...RAIL_ICON}>
        <path d="M4 20 20 4" />
        <path d="M4 14 14 4" />
        <path d="M10 20 20 10" />
      </svg>
    ),
  },
  {
    id: 'opacity',
    label: '투명도',
    eyebrow: 'Opacity',
    // 투명도: 겹친 두 원 — 한쪽은 반투명 채움으로 컬러(윤곽만)와 구분.
    icon: (
      <svg {...RAIL_ICON}>
        <circle cx="10" cy="12" r="6" />
        <circle cx="14" cy="12" r="6" fill="currentColor" fillOpacity={0.25} />
      </svg>
    ),
  },
];

function RailIconButton({
  icon,
  label,
  selected,
  ringColor,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  selected: boolean;
  ringColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={selected}
      aria-controls={PANEL_ID}
      data-touch="44"
      // outline-none 제거(#357) — 전역 :focus-visible 링이 dock 탭에도 걸리게 한다(키보드
      // 포커스에만 뜨므로 터치/마우스 시각 변화 없음).
      className="flex flex-col items-center gap-1.5"
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
          selected ? 'bg-accent-soft text-accent' : 'border-line bg-surface-elevated text-fg-muted'
        }`}
        // 선택 시 유저의 티켓 잉크색(themeColor) 링. 미설정이면 accent로 폴백.
        style={selected ? { borderColor: 'transparent', boxShadow: `0 0 0 2px ${ringColor}` } : undefined}
      >
        {icon}
      </span>
      <span
        className={`text-[11px] font-medium transition-colors ${selected ? 'text-accent' : 'text-fg-muted'}`}
      >
        {label}
      </span>
    </button>
  );
}

function RailExpandPanel({
  open,
  eyebrow,
  children,
}: {
  open: boolean;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    // collapse = grid-rows 0fr↔1fr + overflow-hidden(필수) + 접힘 시 inert(포커스/Tab/SR 차단).
    // reduced-motion은 전역 가드 + motion-reduce:transition-none로 이중 차단(MobileEditorShell 패턴).
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="overflow-hidden" inert={!open || undefined}>
        {/* v8 언박스(#357) — 패널의 배경·보더·라운드·그림자 전부 제거. 상세는 앰비언트 배경 위
            느슨한 컨트롤로 얹히고, 가독성은 앰비언트의 어두움 + 각 피커 자체 대비로 확보한다.
            과거 박스형 룩(rounded-card border bg-surface-elevated) 복원 금지 — 언박스가 최종. */}
        <div id={PANEL_ID} role="region" aria-label={eyebrow} className="pt-3">
          {/* 닫기(x) 버튼 제거(#322) — 레일 아이콘 재클릭으로 이미 토글 닫힘이라 기능 중복.
              라벨은 피커 자체 헤더(LayoutStrip "Mood", TexturePicker "Surface treatment")와 겹쳐 생략,
              접근성 이름은 region aria-label(eyebrow)이 유지. */}
          {children}
        </div>
      </div>
    </div>
  );
}

export function DesignRail({ photo }: { photo: ReturnType<typeof usePhototicket> }) {
  const [pop, setPop] = useState<Pop | null>(null);
  const { components, croppedImageUrl, recommendedColors } = photo.state;
  const setComp = photo.updateComponents;

  // 접히는 중에도 콘텐츠를 마운트한 채 높이만 줄여 부드럽게 닫는다(패널이 비면 점프한다).
  // 마지막 활성 섹션을 기억 — pop이 null이 돼도 애니메이션 동안 직전 섹션이 남는다.
  const lastPopRef = useRef<Pop>('mood');
  if (pop) lastPopRef.current = pop;
  const active = lastPopRef.current;
  const eyebrow = RAIL_ITEMS.find((it) => it.id === active)?.eyebrow ?? '';

  const ringColor = components.themeColor || 'var(--accent)';
  const toggle = (id: Pop) => setPop((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-center gap-6">
        {RAIL_ITEMS.map((it) => (
          <RailIconButton
            key={it.id}
            icon={it.icon}
            label={it.label}
            selected={pop === it.id}
            ringColor={ringColor}
            onClick={() => toggle(it.id)}
          />
        ))}
      </div>

      <RailExpandPanel open={pop !== null} eyebrow={eyebrow}>
        {active === 'mood' ? (
          <LayoutStrip value={components.layout} onChange={(id: LayoutId) => setComp({ layout: id })} />
        ) : active === 'color' ? (
          // DesktopStudioShell과 동일 배선 — 잉크색 단일 축(themeColor). 35mm는 톤 고정이라 disabled.
          <ColorPicker
            value={components.themeColor}
            onChange={(themeColor) => setComp({ themeColor })}
            recommended={recommendedColors}
            disabled={components.layout === '35mm'}
            disabledNote="35mm 무드는 필름 톤(크림·먹색)이 고정이라 잉크 색을 바꿀 수 없어요."
          />
        ) : active === 'texture' ? (
          <TexturePicker
            value={components.texture}
            onChange={(texture) => setComp({ texture })}
            croppedImageUrl={croppedImageUrl}
          />
        ) : (
          // 투명도(#219) — 듀얼 슬라이더. 포스터=밝기(posterOpacity, 기존 메커니즘 유지),
          // 컴포넌트=오버레이 불투명도(componentOpacity). BrightnessSlider 재사용(둘 다 0..1→%).
          <div className="space-y-group">
            <BrightnessSlider
              label="포스터"
              id="rail-poster-opacity"
              value={components.posterOpacity}
              onChange={(posterOpacity) => setComp({ posterOpacity })}
            />
            <BrightnessSlider
              label="컴포넌트"
              id="rail-component-opacity"
              value={components.componentOpacity ?? 1}
              onChange={(componentOpacity) => setComp({ componentOpacity })}
            />
          </div>
        )}
      </RailExpandPanel>
    </div>
  );
}
