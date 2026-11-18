import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { LayoutStrip } from '@/components/LayoutPicker';
import TexturePicker from '@/components/v2/pickers/TexturePicker';
import ColorPicker from '@/components/v2/pickers/ColorPicker';
import BrightnessSlider from '@/components/v2/pickers/BrightnessSlider';
import { TEXTURE_RECIPES } from '@/utils/textureRecipes';
import { MATERIAL_OPTIONS, COATING_OPTIONS } from '@/utils/constants';
import { MINIMAL_STAMP_MAX_SCALE } from '@/components/moods/MoodMinimal';
import { Eyebrow } from './Eyebrow';
import { POSTER_FILL_MOODS, TONE_FIXED_MOODS, STAMP_KEYS, STAMP_LABELS, STAMP_TARGETS, type SheetTarget } from '@/constants/fields';
import type { LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 디자인 도크 디자인 모드의 도구 정의 목록(#523 → #826 S2) — 무드 · 색상 · 재질 · 코팅 · 투명도 · 크기.
// 슬라이더 id의 rail- prefix는 기존 id 보존용이다.
export type DesignToolId = 'mood' | 'color' | 'material' | 'coating' | 'opacity' | 'size';
type Photo = ReturnType<typeof usePhototicket>;

/**
 * 도구가 셸에서만 할 수 있는 동작을 부를 때 쓰는 통로. photo(상태)로는 표현이 안 되는 것만
 * 여기 온다 — 인플레이스 편집은 셸이 소유한다. 포스터 재크롭(#492)은 사진 모드의 자르기 행으로
 * 옮겨 갔다(#826 S2 G-01).
 */
interface DesignToolActions {
  /** 필드 인플레이스 편집 진입(#781) — 로고 크기 패널의 입력 액션이 셸의 handleField로 로고 입력을 연다. */
  onEditField?: (field: SheetTarget) => void;
}

interface DesignTool {
  id: DesignToolId;
  label: string;
  render: (photo: Photo, actions: DesignToolActions) => ReactNode;
}

// 슬라이더·패널 id prefix — rail-chain-scale 등 기존 id를 보존한다.
const ID_PREFIX = 'rail';

// claude-review PR #486 P1 — Minimal은 MoodMinimal이 실효 scale을 MINIMAL_STAMP_MAX_SCALE로
// 클램프하므로, 슬라이더 상한도 같이 낮추지 않으면 110~130% 구간이 숫자만 오르고 렌더는 그대로인
// 죽은 구간이 된다. FieldEditorBody.tsx의 StampSheet도 같은 계산을 쓴다(claude-review PR #487
// P1 — 셋 중 하나만 고치면 재발하는 버그였다) — export해 단일 소스로.
export function stampScaleMaxFor(layout: LayoutId) {
  return layout === 'minimal' ? MINIMAL_STAMP_MAX_SCALE : 1.3;
}

/**
 * 값 칩 한 줄(라디오그룹) — 포스터 채우기(#527).
 */
function ChipRadio<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (next: V) => void;
}) {
  return (
    <div className="space-y-field">
      <Eyebrow as="div">{label}</Eyebrow>
      {/* 이름은 컨테이너 aria-label로 — TexturePicker·FieldEditorBody의 radiogroup과 같은 문법. */}
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            // h-9(#682 다이어트 — 이전 h-10에서 4px 축소, AxisSegment 형제 버튼과 같은 높이로
            // 맞춘다). AA 하한(24)의 1.5배라 여전히 여유 있다.
            data-touch="36"
            className={cn(pressableVariants(), `h-9 grow basis-[6rem] truncate rounded-chip border px-3 text-caption font-medium transition-colors ${
              value === opt.value
                ? 'border-hair-strong bg-s2 font-semibold text-ink'
                : 'border-transparent text-ink-2'
            } `)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const POSTER_FIT_OPTIONS = [
  { value: 'contain', label: '원본 비율' },
  { value: 'cover', label: '꽉 채우기' },
] as const;

type TextureAxis = 'material' | 'coating';
const TEXTURE_AXES: { key: TextureAxis; label: string; options: readonly { value: string; label: string }[] }[] = [
  { key: 'material', label: '재질', options: MATERIAL_OPTIONS },
  { key: 'coating', label: '코팅', options: COATING_OPTIONS },
];

/** 한 축(재질 또는 코팅)의 피커 + 그 축 강도 슬라이더. 축별 배치는 부모가 정한다. */
function TextureAxisControls({ photo, axis }: { photo: Photo; axis: TextureAxis }) {
  const { components, croppedImageUrl } = photo.state;
  const setComp = photo.updateComponents;
  const meta = TEXTURE_AXES.find((a) => a.key === axis)!;
  const isMaterial = axis === 'material';
  const value = isMaterial ? components.material : components.coating;
  // 강도 슬라이더는 레시피 있는 옵션(원본/코팅없음 제외)에서만 유효해 레시피 밖에선 숨긴다.
  return (
    <div className="space-y-group">
      <TexturePicker
        axis={axis}
        options={meta.options}
        value={value}
        onChange={(next) => setComp(isMaterial ? { material: next } : { coating: next })}
        croppedImageUrl={croppedImageUrl}
        ariaLabel={meta.label}
      />
      {TEXTURE_RECIPES[value] && (
        <BrightnessSlider
          label={`${meta.label} 강도`}
          id={`${ID_PREFIX}-${axis}-intensity`}
          value={isMaterial ? components.materialIntensity : components.coatingIntensity}
          onChange={(v) => setComp(isMaterial ? { materialIntensity: v } : { coatingIntensity: v })}
        />
      )}
    </div>
  );
}

/**
 * 크기 패널(#441, #492, #527 → #554 → #826 S2 D-05) — 포스터 채우기 · 극장/포맷 로고 크기 · 배경 스탬프 크기를
 * 한 스크롤 본문에 쌓는다. 후보정(#500)·크기(#554)가 dock 높이 예산 때문에 쓰던 축 전환 세그먼트는 도크가
 * 고정 높이(마스터 C-DOCK)가 되며 필요가 없어졌다 — 넘치면 본문 안에서 세로 스크롤한다.
 * 포스터 재크롭 진입(#492)은 사진 모드 포스터 행의 '자르기'(G-01)로 옮겨 갔다.
 *
 * 포스터 채우기(#527)는 값이 갈리는 무드(POSTER_FILL_MOODS)에서만 — 나머지 무드는 슬롯이 이미 포스터 표준
 * 비율이라 토글해도 그림이 같다. 숨겨도 저장값은 남아 무드 복귀 시 그대로 살아난다(체인/포맷
 * 스케일 클램프와 같은 원칙). 스탬프 크기도 같은 규칙으로 스탬프 이미지가 있는 3무드에서만 뜬다.
 */
function SizePanel({ photo, actions }: { photo: Photo; actions: DesignToolActions }) {
  const { components } = photo.state;
  const setComp = photo.updateComponents;
  const stampScaleMax = stampScaleMaxFor(components.layout);
  const showFit = POSTER_FILL_MOODS.has(components.layout);
  const showBackgroundScale =
    BACKGROUND_PATTERN_MOODS.includes(components.layout) && !!components.backgroundPatternImage;

  // 체인/포맷 로고 렌더 크기(#441, PR #485 P2 후속). value는 Math.min(raw, stampScaleMax)로
  // 표시만 클램프 — 저장된 raw 값은 안 건드려 다른 무드로 돌아가면 원래 크기로 복원된다.
  //
  // 빈 상태·숨김 안내(#781) — 이미지도 텍스트도 없으면 조절할 대상이 없고, 숨겼으면 티켓에 안 보여서
  // 슬라이더를 움직여도 아무 변화가 없다. 그렇다고 슬라이더를 끄진 않는다: 텍스트 라벨만 있어도
  // ChainStamp·FormatStamp가 scale로 조절하고, 입력 전에 크기를 미리 정해 둘 수도 있어서다.
  // 입력 액션은 셸의 handleField로 가서 숨긴 로고면 표시를 켜고 인플레이스 편집을 연다.
  return (
    <div className="space-y-group">
      {showFit && (
        <ChipRadio
          label="포스터 채우기"
          options={POSTER_FIT_OPTIONS}
          value={components.posterFit ?? 'contain'}
          onChange={(posterFit) => setComp({ posterFit })}
        />
      )}
      {STAMP_TARGETS.map((target) => {
        const keys = STAMP_KEYS[target];
        const empty = !components[keys.image] && !String(components[keys.label] ?? '').trim();
        const hidden = !components[keys.visible];
        const scaleKey = target === 'chain' ? 'chainScale' : 'formatScale';
        return (
          <div key={target} className="space-y-field">
            {(empty || hidden) && (
              <p className="text-caption text-ink-2">
                {empty
                  ? `${STAMP_LABELS[target]}가 비어 있어요. 이미지나 텍스트를 입력하세요.`
                  : `${STAMP_LABELS[target]}가 숨겨져 있어요.`}
              </p>
            )}
            <BrightnessSlider
              // 이름은 안내문·정보 행·입력칸과 같은 STAMP_LABELS에서 뜬다(#781) — 옛 '체인 로고 크기'는 바로 위
              // 안내문의 '극장 로고'와 한 컨트롤을 두 이름으로 불렀다.
              label={`${STAMP_LABELS[target]} 크기`}
              id={`${ID_PREFIX}-${target}-scale`}
              value={Math.min(components[scaleKey] ?? 1, stampScaleMax)}
              onChange={(value) => setComp({ [scaleKey]: value })}
              min={0.6}
              max={stampScaleMax}
              action={
                actions.onEditField && (empty || hidden)
                  ? { label: empty ? '입력' : '표시·편집', onClick: () => actions.onEditField?.(target) }
                  : undefined
              }
            />
          </div>
        );
      })}
      {showBackgroundScale && (
        <BrightnessSlider
          label="스탬프 크기"
          id={`${ID_PREFIX}-background-scale`}
          value={components.backgroundPatternScale ?? 1}
          onChange={(backgroundPatternScale) => setComp({ backgroundPatternScale })}
          min={1}
          max={BACKGROUND_SCALE_MAX}
        />
      )}
    </div>
  );
}

/**
 * 배경 이미지를 실을 수 있는 무드(#530 PR 1) — 판정 기준은 "배경을 깔 종이 바탕이 그 무드에
 * 실재하는가" 하나(이슈 본문). Editorial·Criterion v5·Stub는 셋 다 종이 면이 이미 서 있고,
 * 셋 다 렌더링까지 붙어 있다.
 */
export const BACKGROUND_PATTERN_MOODS: readonly LayoutId[] = ['editorial', 'criterion', 'stub'];

/**
 * 배경 배율 상한(#680) — 로고 스탬프의 1.3과 다른 건 취향이 아니라 해상도다. 배경은 캔버스 전면을
 * 채우느라 maxSide = TARGET_HEIGHT(1534)로 굽는데 저장물은 pixelRatio 2라 배율 1.0에서 이미 약
 * 2배 업스케일이고, 2.0이면 4배가 돼 눈에 띄게 뭉갠다. 이 값을 올리려면 useLogoCrop의 maxSide부터
 * 올려야 하고, 그러면 #673이 "제일 큰 payload"로 지목한 배경 blob이 같이 커진다.
 *
 * 하한이 1.0인 건 cover 미만으로 내리면 캔버스에 빈 자리가 생겨 반복·단색·blur 중 하나를 새로
 * 정해야 하기 때문이다. 타일 반복은 backgroundPatterns.tsx가 이미 기각해뒀다(임의의 사진이라
 * 이음매가 보인다). 하한을 1.0으로 잠그면 그 결정 자체가 없어진다.
 *
 * 무드별로 안 갈리므로 stampScaleMaxFor 같은 함수로 감싸지 않는다 — 로고가 그 장치를 가진 건
 * MoodMinimal이 실효 scale을 따로 클램프하기 때문인데(PR #486 P1), 배경은 minimal에 안 실리고
 * 세 무드가 같은 0.626 캔버스를 쓴다.
 */
const BACKGROUND_SCALE_MAX = 1.5;

/**
 * 스탬프 투명도 범위(#728 c4·ac3). 하한 0.2는 완전히 안 보일 정도로 내려가면 "왜 스탬프가
 * 안 보이지"가 되는 반대쪽 함정이라 바닥을 둔다. **새로 올린 이미지의 write-time 기본값**은
 * 이 범위 중간인 0.5 — 고정 박스에 반투명하게 앉아 있는 게 스탬프라는 이번 재설계의 취지를
 * 업로드 즉시 보여준다. 상한 1.0(불투명)은 기존 저장본이 `?? 1`로 읽는 값과 같아, 사용자가
 * 슬라이더를 끝까지 올리면 옛 배경 렌더와 픽셀이 같아진다.
 */
const BACKGROUND_OPACITY_MIN = 0.2;
export const BACKGROUND_OPACITY_DEFAULT = 0.5;

/**
 * 디자인 도구 목록(마스터 D-01~D-05 순서) — 여섯 도구가 전 무드에 존재한다.
 */
export const DESIGN_TOOLS: readonly DesignTool[] = [
  {
    id: 'mood',
    label: '무드',
    render: (photo) => (
      <LayoutStrip
        value={photo.state.components.layout}
        onChange={(id: LayoutId) => photo.updateComponents({ layout: id })}
      />
    ),
  },
  {
    id: 'color',
    label: '색상',
    // 잉크색 단일 축(themeColor). 색이 고정된 무드(TONE_FIXED_MOODS, #524)는 도구를 숨기지 않고 컨트롤만 잠근다.
    render: (photo) => (
      <ColorPicker
        value={photo.state.components.themeColor}
        onChange={(themeColor) => photo.updateComponents({ themeColor })}
        recommended={photo.state.recommendedColors}
        disabled={TONE_FIXED_MOODS.has(photo.state.components.layout)}
        disabledNote="이 무드는 색이 고정돼요"
      />
    ),
  },
  { id: 'material', label: '재질', render: (photo) => <TextureAxisControls photo={photo} axis="material" /> },
  { id: 'coating', label: '코팅', render: (photo) => <TextureAxisControls photo={photo} axis="coating" /> },
  {
    id: 'opacity',
    label: '투명도',
    render: (photo) => {
      const { components } = photo.state;
      const setComp = photo.updateComponents;
      // 듀얼 슬라이더 — 포스터=밝기(posterOpacity), 컴포넌트=오버레이 불투명도(componentOpacity).
      // 배경 스탬프 투명도(#728)는 스탬프 이미지가 있는 3무드에서만 세 번째로 붙는다.
      const showStampOpacity =
        BACKGROUND_PATTERN_MOODS.includes(components.layout) && !!components.backgroundPatternImage;
      return (
        <div className="space-y-group">
          <BrightnessSlider
            label="포스터"
            id={`${ID_PREFIX}-poster-opacity`}
            value={components.posterOpacity}
            onChange={(posterOpacity) => setComp({ posterOpacity })}
          />
          <BrightnessSlider
            label="컴포넌트"
            id={`${ID_PREFIX}-component-opacity`}
            value={components.componentOpacity ?? 1}
            onChange={(componentOpacity) => setComp({ componentOpacity })}
          />
          {showStampOpacity && (
            <BrightnessSlider
              label="스탬프 투명도"
              id={`${ID_PREFIX}-background-opacity`}
              value={components.backgroundPatternOpacity ?? 1}
              onChange={(backgroundPatternOpacity) => setComp({ backgroundPatternOpacity })}
              min={BACKGROUND_OPACITY_MIN}
              max={1}
            />
          )}
        </div>
      );
    },
  },
  { id: 'size', label: '크기', render: (photo, actions) => <SizePanel photo={photo} actions={actions} /> },
];
