import type { ReactNode } from 'react';
import LayoutPicker, { LayoutStrip } from '@/components/LayoutPicker';
import TexturePicker from '@/components/wizard/TexturePicker';
import ColorPicker from '@/components/wizard/ColorPicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import { TEXTURE_RECIPES } from '@/utils/textureRecipes';
import { MATERIAL_OPTIONS, COATING_OPTIONS } from '@/utils/constants';
import { MINIMAL_STAMP_MAX_SCALE } from '@/components/moods/MoodMinimal';
import { Eyebrow } from './Eyebrow';
import { POSTER_FILL_MOODS, TONE_FIXED_MOODS } from '@/constants/fields';
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

/**
 * 항목이 셸에서만 할 수 있는 동작을 부를 때 쓰는 통로(#492). photo(상태)로는 표현이 안 되는
 * 것만 여기 온다 — 포스터 크롭 파이프라인은 원본 objectURL의 수명을 셸이 소유하기 때문이다.
 * 못 하는 상황(원본 없음)이면 셸이 아예 안 넘기고, 항목은 그때 컨트롤을 안 그린다 — 죽은
 * 컨트롤을 남기지 않는다는 점에서 POSTER_FILL_MOODS 게이트와 같은 규칙.
 */
export interface RailActions {
  /** 포스터 재크롭 진입 — 셸의 크롭 모달을 기존 원본으로 다시 연다. */
  onRecropPoster?: () => void;
}

export interface RailItem {
  id: RailItemId;
  label: string;
  eyebrow: string;
  icon: ReactNode;
  // 이 무드 목록에서만 항목 자체가 존재한다("숨김" — 개념이 아예 없는 무드). 없으면 전 무드
  // 노출. filterItemsForMood가 이 필드로 실제 렌더 목록을 걸러낸다. "잠금"(개념은 있으나 그
  // 무드가 값을 고정)은 이 필드가 아니라 항목 자신의 render 안에서 disabled로 표현 — 컬러가
  // 그 예: TONE_FIXED_MOODS를 이 필드에 안 싣고 render 클로저 안에서만 직접 참조해, 아이콘은
  // 그대로 두고 컨트롤만 잠근다(35mm 컬러의 disabledNote와 같은 이유).
  appliesTo?: readonly LayoutId[];
  render: (photo: Photo, surface: RailSurface, actions: RailActions) => ReactNode;
}

// #523 AC3 — appliesTo 기반 무드별 노출 필터. 순수 함수라 합성(가짜) RailItem만으로 검증 가능.
export function filterItemsForMood(items: readonly RailItem[], layout: LayoutId): RailItem[] {
  return items.filter((item) => !item.appliesTo || item.appliesTo.includes(layout));
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

const POSTER_FIT_OPTIONS = [
  { value: 'contain', label: '원본 비율' },
  { value: 'cover', label: '꽉 채우기' },
] as const;

/**
 * 포스터를 슬롯에 앉히는 방식(#527, #492) — 근거와 무드별 실측은 TicketComponents.posterFit
 * 주석과 POSTER_FILL_MOODS에. 여기선 "크롭 모달이 아니라 DESIGN '크기' 섹션"이라는 자리만 잡는다.
 */
function PosterFitToggle({
  value,
  onChange,
}: {
  value: 'contain' | 'cover';
  onChange: (next: 'contain' | 'cover') => void;
}) {
  return (
    <div className="space-y-field">
      <Eyebrow as="div">포스터 채우기</Eyebrow>
      {/* 이름은 컨테이너 aria-label로 — TexturePicker·FieldEditorBody의 radiogroup과 같은 문법. */}
      <div role="radiogroup" aria-label="포스터 채우기" className="flex gap-2">
        {POSTER_FIT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            data-touch="44"
            className={`flex-1 rounded-chip border px-3 py-2.5 text-[12px] font-medium transition-colors ${
              value === opt.value
                ? 'border-transparent bg-accent-soft text-accent'
                : 'border-line bg-surface-elevated text-fg-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  render: (photo) => (
    // 데스크톱·모바일 동일 배선 — 잉크색 단일 축(themeColor). disabled는 RailItem.appliesTo가
    // 아니라 이 클로저가 직접 쥔 TONE_FIXED_MOODS(#524)로 판정한다 — appliesTo에 실으면
    // filterItemsForMood가 아이콘 자체를 숨겨버려 "잠금"이 "숨김"이 된다(/simplify reuse 지적 —
    // 여집합을 배열로 만들었다 다시 부정하는 왕복 대신 원래 Set 판정을 직접 쓴다).
    <ColorPicker
      value={photo.state.components.themeColor}
      onChange={(themeColor) => photo.updateComponents({ themeColor })}
      recommended={photo.state.recommendedColors}
      disabled={TONE_FIXED_MOODS.has(photo.state.components.layout)}
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
    render: (photo, surface, actions) => {
      const prefix = prefixFor(surface);
      const { components } = photo.state;
      const setComp = photo.updateComponents;
      const stampScaleMax = stampScaleMaxFor(components.layout);
      // 체인/포맷 로고 렌더 크기(#441, PR #485 P2 후속). value는 Math.min(raw, stampScaleMax)로
      // 표시만 클램프 — 저장된 raw 값은 안 건드려 다른 무드로 돌아가면 원래 크기로 복원된다.
      // 포스터 채우기(#527/#492)는 값이 갈리는 무드에서만 — 나머지 무드는 슬롯이 이미 포스터
      // 표준 비율이라 토글해도 그림이 같다. 숨겨도 저장값은 남아 무드 복귀 시 그대로 살아난다
      // (체인/포맷 스케일 클램프와 같은 원칙).
      // 크롭 재진입(#492) — 포스터 크기·비율을 한 자리에서 다루게 하는 게 이 섹션의 취지라,
      // "얼마나 크게"(스케일·채우기) 옆에 "어디를 쓸지"(크롭)를 같이 둔다. 원본이 없으면 셸이
      // onRecropPoster를 안 넘겨 버튼 자체가 안 뜬다 — 재업로드 안내는 원래 진입점(모바일 헤더
      // 메뉴 '재크롭', 데스크톱 POSTER 탭)이 disabled+title로 계속 들고 있다.
      return (
        <div className="space-y-group">
          {actions.onRecropPoster && (
            <button
              type="button"
              onClick={actions.onRecropPoster}
              data-touch="44"
              className="w-full rounded-chip border border-line bg-surface-elevated px-3 py-2.5 text-[12px] font-medium text-fg transition-colors hover:bg-accent-soft hover:text-accent"
            >
              포스터 다시 크롭
            </button>
          )}
          {POSTER_FILL_MOODS.has(components.layout) && (
            <PosterFitToggle
              value={components.posterFit ?? 'contain'}
              onChange={(posterFit) => setComp({ posterFit })}
            />
          )}
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
