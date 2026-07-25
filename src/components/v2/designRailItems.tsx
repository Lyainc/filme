import type { ReactNode } from 'react';
import LayoutPicker, { LayoutStrip } from '@/components/LayoutPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import ColorPicker from '@/components/wizard/ColorPicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import { TEXTURE_RECIPES } from '@/utils/textureRecipes';
import { MATERIAL_OPTIONS, COATING_OPTIONS } from '@/utils/constants';
import { MINIMAL_STAMP_MAX_SCALE } from '@/components/moods/MoodMinimal';
import { LAYOUTS } from '@/utils/layouts';
import { TONE_FIXED_MOODS } from '@/constants/fields';
import type { LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

// #523 — 디자인 레일 항목 정의를 DesignRail(모바일)·DesktopDesignPanel(데스크톱) 공용 목록
// 하나로 통합. 두 화면은 이 목록만 공유하고 배치(모바일=아이콘 행+단일 패널, 데스크톱=상시
// 세로 스택)는 각자 유지 — render(photo, surface)가 화면별 분기를 항목 안으로 가둔다.
// 슬라이더 id는 surface별 prefix(rail-/desktop-)로 조립해 기존 id를 그대로 보존한다
// (rail-chain-scale·desktop-chain-scale 등 — __tests__/desktopDesignPanel.test.tsx가 CSS
// 선택자로 잡는다).
export type RailItemId = 'mood' | 'color' | 'texture' | 'opacity' | 'size';
type RailSurface = 'mobile' | 'desktop';
type Photo = ReturnType<typeof usePhototicket>;

export interface RailItem {
  id: RailItemId;
  label: string;
  eyebrow: string;
  icon: ReactNode;
  // 이 항목이 실제로 조작 가능한 무드 목록. 없으면 전 무드 적용. 현재 실사용은 컬러 하나뿐 —
  // appliesTo 밖의 무드에서도 항목 자체는 숨기지 않고 disabled로 보여준다("숨김"이 아니라
  // "잠금", 35mm 컬러의 disabledNote와 같은 이유. 개념은 있으나 그 무드가 값을 고정한 경우).
  appliesTo?: readonly LayoutId[];
  render: (photo: Photo, surface: RailSurface) => ReactNode;
}

// surface별 슬라이더 id prefix — rail-chain-scale/desktop-chain-scale 등 기존 id를 보존한다.
function prefixFor(surface: RailSurface) {
  return surface === 'mobile' ? 'rail' : 'desktop';
}

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

// claude-review PR #486 P1 — Minimal은 MoodMinimal이 실효 scale을 MINIMAL_STAMP_MAX_SCALE로
// 클램프하므로, 슬라이더 상한도 같이 낮추지 않으면 110~130% 구간이 숫자만 오르고 렌더는 그대로인
// 죽은 구간이 된다. FieldEditorBody.tsx의 StampSheet도 같은 계산을 쓴다(claude-review PR #487
// P1 — 셋 중 하나만 고치면 재발하는 버그였다) — export해 단일 소스로.
export function stampScaleMaxFor(layout: LayoutId) {
  return layout === 'minimal' ? MINIMAL_STAMP_MAX_SCALE : 1.3;
}

// TONE_FIXED_MOODS(#524, src/constants/fields.ts)의 여집합 — 컬러가 실제로 조작 가능한 무드.
// 별도 리터럴 목록을 다시 적지 않고 LAYOUTS 전체에서 걸러내, 무드 능력 표가 TONE_FIXED_MOODS
// 한 곳에만 남는다(inkColorFidelity.test.tsx도 같은 표를 참조).
const COLOR_APPLIES_TO: readonly LayoutId[] = LAYOUTS.map((l) => l.id).filter(
  (id) => !TONE_FIXED_MOODS.has(id),
);

const COLOR_ITEM: RailItem = {
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
  appliesTo: COLOR_APPLIES_TO,
  render: (photo) => (
    // 데스크톱·모바일 동일 배선 — 잉크색 단일 축(themeColor). disabled는 이 항목 자신의
    // appliesTo(= TONE_FIXED_MOODS(#524)의 여집합)를 직접 읽어 판정한다.
    <ColorPicker
      value={photo.state.components.themeColor}
      onChange={(themeColor) => photo.updateComponents({ themeColor })}
      recommended={photo.state.recommendedColors}
      disabled={!COLOR_ITEM.appliesTo!.includes(photo.state.components.layout)}
      disabledNote="이 무드는 톤이 고정이라 잉크 색을 바꿀 수 없어요."
    />
  ),
};

export const RAIL_ITEMS: readonly RailItem[] = [
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
    render: (photo, surface) => {
      const onChange = (id: LayoutId) => photo.updateComponents({ layout: id });
      return surface === 'mobile' ? (
        <LayoutStrip value={photo.state.components.layout} onChange={onChange} />
      ) : (
        <LayoutPicker value={photo.state.components.layout} onChange={onChange} />
      );
    },
  },
  COLOR_ITEM,
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
    render: (photo, surface) => {
      const prefix = prefixFor(surface);
      const { components, croppedImageUrl } = photo.state;
      const setComp = photo.updateComponents;
      // 재질×코팅 2축 피커 + 축별 강도 슬라이더(#434, #471, #475). 각 강도 슬라이더는 그 축
      // 피커 바로 아래 — 레시피 있는 옵션(원본/코팅없음 제외)에서만 유효해 레시피 밖에선 숨긴다.
      return (
        <div className="space-y-section">
          <div className="space-y-group">
            <TexturePicker
              axis="material"
              options={MATERIAL_OPTIONS}
              value={components.material}
              onChange={(material) => setComp({ material })}
              croppedImageUrl={croppedImageUrl}
              ariaLabel="재질"
            />
            {TEXTURE_RECIPES[components.material] && (
              <BrightnessSlider
                label="재질 강도"
                id={`${prefix}-material-intensity`}
                value={components.materialIntensity}
                onChange={(materialIntensity) => setComp({ materialIntensity })}
              />
            )}
          </div>
          <div className="space-y-group">
            <TexturePicker
              axis="coating"
              options={COATING_OPTIONS}
              value={components.coating}
              onChange={(coating) => setComp({ coating })}
              croppedImageUrl={croppedImageUrl}
              ariaLabel="코팅"
            />
            {TEXTURE_RECIPES[components.coating] && (
              <BrightnessSlider
                label="코팅 강도"
                id={`${prefix}-coating-intensity`}
                value={components.coatingIntensity}
                onChange={(coatingIntensity) => setComp({ coatingIntensity })}
              />
            )}
          </div>
        </div>
      );
    },
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
    render: (photo, surface) => {
      const prefix = prefixFor(surface);
      const { components } = photo.state;
      const setComp = photo.updateComponents;
      // 듀얼 슬라이더 — 포스터=밝기(posterOpacity), 컴포넌트=오버레이 불투명도(componentOpacity).
      return (
        <div className="space-y-group">
          <BrightnessSlider
            label="포스터"
            id={`${prefix}-poster-opacity`}
            value={components.posterOpacity}
            onChange={(posterOpacity) => setComp({ posterOpacity })}
          />
          <BrightnessSlider
            label="컴포넌트"
            id={`${prefix}-component-opacity`}
            value={components.componentOpacity ?? 1}
            onChange={(componentOpacity) => setComp({ componentOpacity })}
          />
        </div>
      );
    },
  },
  {
    id: 'size',
    label: '크기',
    eyebrow: 'Size',
    // 크기: 네 모서리가 바깥으로 벌어지는 화살표 — 확대/축소 힌트.
    icon: (
      <svg {...RAIL_ICON}>
        <path d="M4 20 10 20 10 14" />
        <path d="M4 20 12 12" />
        <path d="M20 4 14 4 14 10" />
        <path d="M20 4 12 12" />
      </svg>
    ),
    render: (photo, surface) => {
      const prefix = prefixFor(surface);
      const { components } = photo.state;
      const setComp = photo.updateComponents;
      const stampScaleMax = stampScaleMaxFor(components.layout);
      // 체인/포맷 로고 렌더 크기(#441, PR #485 P2 후속). value는 Math.min(raw, stampScaleMax)로
      // 표시만 클램프 — 저장된 raw 값은 안 건드려 다른 무드로 돌아가면 원래 크기로 복원된다.
      return (
        <div className="space-y-group">
          <BrightnessSlider
            label="체인 로고 크기"
            id={`${prefix}-chain-scale`}
            value={Math.min(components.chainScale ?? 1, stampScaleMax)}
            onChange={(chainScale) => setComp({ chainScale })}
            min={0.6}
            max={stampScaleMax}
          />
          <BrightnessSlider
            label="포맷 로고 크기"
            id={`${prefix}-format-scale`}
            value={Math.min(components.formatScale ?? 1, stampScaleMax)}
            onChange={(formatScale) => setComp({ formatScale })}
            min={0.6}
            max={stampScaleMax}
          />
        </div>
      );
    },
  },
];
