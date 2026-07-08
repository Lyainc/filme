import { Fragment, useRef, useState, type ReactNode } from 'react';
import LayoutPicker from '@/components/LayoutPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import ColorPicker from '@/components/wizard/ColorPicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import type { LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 모바일 디자인 레일(#217+): 무드·컬러·후보정·투명도 편집 콘텐츠를 인라인 폼 밖으로 빼 가로 원형
// 아이콘 + 단일 공용 확장 패널로 호스팅한다. 컬러(#218)·투명도(#219) 추가 완료.
type Pop = 'mood' | 'color' | 'texture' | 'opacity';

const PANEL_ID = 'design-rail-panel';

// 잉크 원탭 토글(#262, 2a 레일 5번째 버튼). 라이트↔다크 잉크를 컬러 패널 안 열고 즉시 전환한다.
// 값은 ColorPicker의 White/Black 프리셋과 동일한 hex라야 두 UI가 안 어긋난다 — 2a 목업 팔레트
// (#F2EFEA/#0C0E11)가 아니라 우리 프리셋(#FFFFFF/#000000)을 쓴다.
const LIGHT_INK = '#FFFFFF';
const DARK_INK = '#000000';

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
      className="flex flex-col items-center gap-1.5 outline-none"
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

// 잉크 원탭 토글 버튼 — 패널을 여는 disclosure가 아니라 즉시 라이트↔다크를 뒤집는 토글이라
// aria-expanded/aria-controls 없이 별도 버튼으로 둔다. 접근성 이름에 현재 잉크를 실어 SR에 상태 노출.
function InkToggleButton({
  isLight,
  disabled,
  onToggle,
}: {
  isLight: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={`잉크 색상 전환, 현재 ${isLight ? '라이트' : '다크'}`}
      data-touch="44"
      className="flex flex-col items-center gap-1.5 outline-none disabled:opacity-40"
    >
      <span
        aria-hidden="true"
        className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line"
        // 좌 다크 / 우 라이트 반원 스플릿. 현재 잉크는 마커 점 위치로 표시(라이트=우 75%, 다크=좌 25%).
        style={{ background: `linear-gradient(90deg, ${DARK_INK} 50%, ${LIGHT_INK} 50%)` }}
      >
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white transition-[left] duration-200 motion-reduce:transition-none"
          style={{ left: isLight ? '75%' : '25%', boxShadow: '0 0 0 2px rgba(0,0,0,.35)' }}
        />
      </span>
      <span className="text-[11px] font-medium text-fg-muted">잉크</span>
    </button>
  );
}

function RailExpandPanel({
  open,
  eyebrow,
  onClose,
  children,
}: {
  open: boolean;
  eyebrow: string;
  onClose: () => void;
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
        <div
          id={PANEL_ID}
          role="region"
          aria-label={eyebrow}
          className="rounded-card border border-line bg-surface-elevated p-4"
        >
          {/* 라벨은 피커 자체 헤더(LayoutPicker "Mood · n/count", TexturePicker "Surface treatment")와
              겹치므로 여기선 생략 — 닫기 버튼만. 접근성 이름은 region aria-label(eyebrow)이 유지. */}
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
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

  // 잉크 원탭 토글(#262) — 라이트↔다크. 색이 고정된 35mm 무드는 컬러 패널과 동일하게 disabled.
  const isLightInk = (components.themeColor || '').toLowerCase() === LIGHT_INK.toLowerCase();
  const inkDisabled = components.layout === '35mm';
  const toggleInk = () => setComp({ themeColor: isLightInk ? DARK_INK : LIGHT_INK });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-center gap-6">
        {RAIL_ITEMS.map((it) => (
          <Fragment key={it.id}>
            <RailIconButton
              icon={it.icon}
              label={it.label}
              selected={pop === it.id}
              ringColor={ringColor}
              onClick={() => toggle(it.id)}
            />
            {/* 2a 레일 순서: 무드·컬러·잉크·후보정·투명도 — 컬러 뒤에 잉크 토글 삽입 */}
            {it.id === 'color' && (
              <InkToggleButton isLight={isLightInk} disabled={inkDisabled} onToggle={toggleInk} />
            )}
          </Fragment>
        ))}
      </div>

      <RailExpandPanel open={pop !== null} eyebrow={eyebrow} onClose={() => setPop(null)}>
        {active === 'mood' ? (
          <LayoutPicker value={components.layout} onChange={(id: LayoutId) => setComp({ layout: id })} />
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
          <div className="space-y-4">
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
