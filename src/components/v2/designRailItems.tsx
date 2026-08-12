import { useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { LayoutStrip } from '@/components/LayoutPicker';
import { useLogoCrop } from '@/hooks/useLogoCrop';
import TexturePicker from '@/components/wizard/TexturePicker';
import ColorPicker from '@/components/wizard/ColorPicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import { TEXTURE_RECIPES } from '@/utils/textureRecipes';
import { MATERIAL_OPTIONS, COATING_OPTIONS } from '@/utils/constants';
import { MINIMAL_STAMP_MAX_SCALE } from '@/components/moods/MoodMinimal';
import { containsHangul } from '@/components/moods/_shared';
import { Eyebrow } from './Eyebrow';
import { POSTER_FILL_MOODS, TONE_FIXED_MOODS } from '@/constants/fields';
import { BACKGROUND_PATTERN_OPTIONS } from '@/utils/backgroundPatterns';
import type { LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

// 크롭 모달은 레일 첫 페인트에 필요 없으니 지연 로드 — FieldEditorBody가 로고 업로드에서 쓰는
// 것과 같은 모듈·같은 방식이라 청크도 공유된다.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

// #523 — 디자인 레일 항목 정의 목록. 원래는 모바일 rail과 데스크톱 패널이 이 목록만 공유하고
// 배치는 각자 유지하려고 render(photo, surface, actions)에 surface 축을 뒀는데, #607에서
// DesktopDesignPanel이 삭제되며 소비자가 DesignRail 하나가 됐다. 축과 그 분기(desktop 전용
// 상시 스택 배치, desktop- id prefix)는 아무도 안 타는 죽은 코드라 같이 걷어냈다 — 남겨두면
// 타입도 테스트도 안 건드리는 채로 두 셸 전제가 조용히 되살아난다.
// 슬라이더 id의 rail- prefix는 그대로 유지한다(기존 id 보존).
export type RailItemId = 'mood' | 'color' | 'texture' | 'emboss' | 'opacity' | 'size' | 'pattern' | 'custom';
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
  render: (photo: Photo, actions: RailActions) => ReactNode;
}

// #523 AC3 — appliesTo 기반 무드별 노출 필터. 순수 함수라 합성(가짜) RailItem만으로 검증 가능.
export function filterItemsForMood(items: readonly RailItem[], layout: LayoutId): RailItem[] {
  return items.filter((item) => !item.appliesTo || item.appliesTo.includes(layout));
}

// 슬라이더·패널 id prefix — rail-chain-scale 등 기존 id를 보존한다.
const ID_PREFIX = 'rail';

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

/**
 * 축 전환 세그먼트(#500 → #554) — 모바일 dock에서 한 번에 한 축만 그리는 배치의 공용 스위치.
 * 후보정(재질↔코팅)과 크기(포스터↔로고)가 같은 처방을 쓰므로 마크업은 여기 하나만 둔다.
 *
 * 높이는 h-9(36px)로 명시해 SC 2.5.8 하한을 클래스 파싱만으로 검증할 수 있게 한다
 * (__tests__/tapTargets.ts — 실렌더 px를 못 보는 파서라 선언이 곧 계약이다).
 */
function AxisSegment<K extends string>({
  ariaLabel,
  panelId,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  panelId: string;
  options: readonly { key: K; label: string }[];
  value: K;
  /** 호출부는 setState를 그대로 넘기지 말고 람다로 감쌀 것 — SetStateAction이 K 추론 후보로
      끼어들면 K가 string으로 넓어져 축 유니온이 풀린다. */
  onChange: (next: K) => void;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          aria-controls={panelId}
          onClick={() => onChange(o.key)}
          data-touch="36"
          className={`h-9 flex-1 truncate rounded-chip border px-3 text-caption font-medium transition-colors active:scale-[0.97] ${
            value === o.key
              ? 'border-transparent bg-accent-soft text-accent'
              : 'border-line bg-surface-elevated text-fg-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 값 칩 한 줄(라디오그룹) — 포스터 채우기(#527)와 한줄평 폰트(#558)가 같은 모양이라 하나만 둔다.
 * AxisSegment(축 전환)와는 역할이 다르다: 저건 아래 패널을 갈아끼우는 스위치(aria-controls)고
 * 이건 값 자체를 고르는 피커라, 개별 칩을 잠글 수 있다(disabled + 사유 문구 — ColorPicker가
 * TONE_FIXED_MOODS를 다루는 문법과 같다. 잠금은 "숨김"이 아니므로 칩은 자리에 남는다).
 */
function ChipRadio<V extends string>({
  label,
  options,
  value,
  onChange,
  note,
}: {
  label: string;
  options: readonly { value: V; label: string; disabled?: boolean }[];
  value: V;
  onChange: (next: V) => void;
  /** 칩 하나 이상이 잠겼을 때의 사유. 잠긴 칩이 없으면 호출부가 undefined를 넘긴다. */
  note?: string;
}) {
  return (
    <div className="space-y-field">
      <Eyebrow as="div">{label}</Eyebrow>
      {note && <p className="text-caption text-fg-muted">{note}</p>}
      {/* 이름은 컨테이너 aria-label로 — TexturePicker·FieldEditorBody의 radiogroup과 같은 문법. */}
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            data-touch="40"
            className={`h-10 flex-1 truncate rounded-chip border px-3 text-caption font-medium transition-colors active:scale-[0.97] ${
              value === opt.value
                ? 'border-transparent bg-accent-soft text-accent'
                : 'border-line bg-surface-elevated text-fg-muted'
            } ${opt.disabled ? 'opacity-40' : ''}`}
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

const QUOTE_FONT_OPTIONS = [
  { value: 'auto', label: '자동' },
  { value: 'hand', label: '손글씨' },
  { value: 'gothic', label: '고딕' },
  { value: 'serif', label: '세리프' },
] as const;

/**
 * 한줄평 폰트가 존재하는 무드(#558) — quote를 렌더하는 무드와 같다. '커스텀' 항목의 appliesTo는
 * **그 항목에 든 컨트롤들의 합집합**이고, 컨트롤은 render 안에서 제 표를 다시 본다(#523 c1과
 * 같은 처방 — SizePanel의 showFit/POSTER_FILL_MOODS가 선례). 지금은 컨트롤이 하나뿐이라 둘이
 * 같지만, #530 배경 패턴이 이 항목에 합류하면 합집합만 넓어지고 폰트 피커는 여기서 계속 걸린다.
 */
const QUOTE_FONT_MOODS: readonly LayoutId[] = ['criterion'];

/**
 * 커스텀 패널(#558) — 무드 전용 커스터마이즈가 모이는 자리. 지금은 Criterion 한줄평 폰트 하나.
 *
 * 텍스트 편집은 여기 안 둔다(스펙 c5): 레일은 하단 고정 dock이라 텍스트 인풋을 넣으면 소프트
 * 키보드가 dock을 통째로 덮는다 — 한줄평 문구는 온티켓 탭(FieldTap → InPlaceFieldEditor)이 계속
 * 소유한다. 대가로 한줄평 컨트롤이 두 자리로 갈린다.
 */
function CustomPanel({ photo }: { photo: Photo }) {
  const { components, movieInfo } = photo.state;
  if (!QUOTE_FONT_MOODS.includes(components.layout)) return null;
  // 세리프(Instrument Serif)는 한글 글리프가 없어 시스템 세리프로 깨진다 → 숨기지 않고 잠근다.
  // 판정은 사용자가 직접 쓴 문구만 본다 — 프리셋·기본 quote는 항상 영문이다(MoodCriterion).
  const hangul = containsHangul(movieInfo.quote ?? '');
  return (
    <ChipRadio
      label="한줄평 폰트"
      options={QUOTE_FONT_OPTIONS.map((o) => (o.value === 'serif' ? { ...o, disabled: hangul } : o))}
      value={components.quoteFont ?? 'auto'}
      onChange={(quoteFont) => photo.updateComponents({ quoteFont })}
      note={hangul ? '세리프는 한글 글리프가 없어 한글 한줄평에는 못 써요.' : undefined}
    />
  );
}

type TextureAxis = 'material' | 'coating';
const TEXTURE_AXES: { key: TextureAxis; label: string; options: readonly { value: string; label: string }[] }[] = [
  { key: 'material', label: '재질', options: MATERIAL_OPTIONS },
  { key: 'coating', label: '코팅', options: COATING_OPTIONS },
];

/** 그 축이 지금 고르고 있는 옵션의 짧은 라벨 — 칩과 같은 표기(괄호 앞부분)를 쓴다. */
function currentOptionLabel(photo: Photo, axis: TextureAxis) {
  const value = axis === 'material' ? photo.state.components.material : photo.state.components.coating;
  const meta = TEXTURE_AXES.find((a) => a.key === axis)!;
  return (meta.options.find((o) => o.value === value)?.label ?? value).split('(')[0].trim();
}

/** 한 축(재질 또는 코팅)의 피커 + 그 축 강도 슬라이더. 축별 배치는 부모가 정한다. */
function TextureAxisControls({ photo, prefix, axis }: { photo: Photo; prefix: string; axis: TextureAxis }) {
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
          id={`${prefix}-${axis}-intensity`}
          value={isMaterial ? components.materialIntensity : components.coatingIntensity}
          onChange={(v) => setComp(isMaterial ? { materialIntensity: v } : { coatingIntensity: v })}
        />
      )}
    </div>
  );
}

/**
 * 후보정 패널(#434, #471, #475 → #500) — 재질×코팅 2축.
 *
 * 모바일은 두 축을 세로로 쌓으면 dock이 400×675 뷰포트에서 **413px**(양축 강도 슬라이더까지
 * 뜬 최악)까지 자라 프리뷰 티켓이 114×182px로 쪼그라든다. 그래서 한 번에 한 축만 그리고 축
 * 전환은 세그먼트가 맡는다 — 실측 결과 dock 413→**312px**, 티켓 114×182→**177×283px**
 * (면적 2.4배). 강도 슬라이더를 투명도 탭으로 몰아내는 옵션 b는 강도를 그 축의 피커에서
 * 떼어놓는 데다(고른 직후 조절이 탭 이동이 된다) 투명도 탭이 대신 4슬라이더로 자라 dock
 * 최댓값이 별로 안 준다 — 실측 표와 판정 근거는 #500 코멘트.
 *
 * 데스크톱은 사이드 패널이라 이 세로 예산 문제가 없어(#500 "데스크톱 미해당") 두 축 상시
 * 노출을 유지한다 — 축 컨트롤 자체는 TextureAxisControls 하나를 공유해 배치만 갈린다
 * (모드 항목의 LayoutStrip/LayoutPicker 분기와 같은 이유·같은 모양).
 *
 * #563 이후 위 "dock이 413px까지 자란다"는 더는 성립하지 않는다 — 모바일 패널이 고정 높이
 * 슬롯이라 dock은 콘텐츠와 무관하게 안 움직인다. 그래도 축 분리는 유지한다: 콘텐츠가 슬롯을
 * 넘으면 대신 안에서 스크롤하게 되므로, 이 배치가 줄이는 건 이제 dock 높이가 아니라 스크롤
 * 양이다(양축 세로 쌓기면 후보정 콘텐츠가 슬롯의 3배를 넘는다).
 */
function TexturePanel({ photo }: { photo: Photo }) {
  const [axis, setAxis] = useState<TextureAxis>('material');
  const prefix = ID_PREFIX;
  // aria-controls와 대상 id는 반드시 같은 상수에서 나와야 한다 — 따로 조립하면 한쪽만 고쳐도
  // 아무 테스트가 안 깨진 채 세그먼트↔패널 관계만 조용히 끊긴다(SizePanel도 같은 이유로 hoist).
  const panelId = `${prefix}-texture-axis-panel`;
  return (
    <div className="space-y-group">
      {/* 라벨에 그 축의 현재 값을 같이 실는 이유: 한 축만 그리는 배치의 유일한 대가가 "안 열린
          축이 기본값이 아닌 걸 알 방법이 없다"는 것이라(홀로그램 코팅이 걸린 채 재질 축이 열려
          있으면 티켓의 광택만 보이고 출처가 안 보인다), 값을 라벨에 올려 두 축 상태를 항상
          노출한다 — 표시자를 따로 만드는 것보다 싸고, 열린 축 쪽은 아래 칩 선택과 중복이라
          해가 없다. 크기 축(#554)은 두 묶음 다 값이 티켓에 그대로 보여서 이 보정이 필요 없다. */}
      <AxisSegment
        ariaLabel="후보정 축"
        panelId={panelId}
        options={TEXTURE_AXES.map((a) => ({
          key: a.key,
          label: `${a.label} · ${currentOptionLabel(photo, a.key)}`,
        }))}
        value={axis}
        onChange={(next) => setAxis(next)}
      />
      {/* key={axis} — 축이 바뀌면 컨트롤을 새로 세운다. 같은 range 노드를 재사용하면 id·label만
          갈린 채 포커스가 남아 스크린리더가 바뀐 의미를 다시 안 읽는다. */}
      <div id={panelId}>
        <TextureAxisControls key={axis} photo={photo} prefix={prefix} axis={axis} />
      </div>
    </div>
  );
}

const EMBOSS_TOOL_OPTIONS = [
  { value: 'brush', label: '브러시' },
  { value: 'lasso', label: '올가미' },
] as const;

/**
 * 형압 패널(#509) — 재질·코팅 옆 독립 후가공 축(c5). 모드 토글이 c9(명시적 진입/종료)의 UI
 * 절반이고, 나머지 절반(모드 중 셸이 브러시 레이어를 띄우는 것)은 MobileEditorShell이 photo.
 * embossEditMode를 직접 읽어 담당한다 — 이 패널은 상태를 켜고 끌 뿐 브러시 자체를 그리지 않는다
 * (브러시는 티켓 프리뷰 위에 겹쳐야 해서 rail 패널 트리 밖에 산다).
 *
 * 도구 선택(브러시/올가미, #509 2단계 c10)은 포토샵 등 사진편집 서비스의 "먼저 도구를 고르고
 * 캔버스에서 그린다" 관성을 그대로 따른다 — ChipRadio(포스터 fit·한줄평 폰트가 이미 쓰는 값
 * 피커, ColorPicker와 동일 문법)로 진입 버튼 위에 상시 노출해, 편집 모드 진입 전에도 다음
 * 드래그가 뭘 할지 미리 정할 수 있게 한다.
 */
function EmbossPanel({ photo }: { photo: Photo }) {
  const {
    embossEditMode,
    setEmbossEditMode,
    embossBrushRadius,
    setEmbossBrushRadius,
    embossTool,
    setEmbossTool,
    clearEmbossMask,
    setEmbossIntensity,
  } = photo;
  const { embossStamps, embossPaths, embossIntensity } = photo.state;
  const hasMask = embossStamps.length > 0 || embossPaths.length > 0;
  const prefix = ID_PREFIX;
  return (
    <div className="space-y-group">
      <ChipRadio
        label="형압 도구"
        options={EMBOSS_TOOL_OPTIONS}
        value={embossTool}
        onChange={setEmbossTool}
      />
      <button
        type="button"
        onClick={() => setEmbossEditMode(!embossEditMode)}
        data-touch="40"
        className={`h-10 w-full rounded-chip border px-3 text-caption font-medium transition-colors active:scale-[0.97] ${
          embossEditMode
            ? 'border-transparent bg-accent-soft text-accent'
            : 'border-line bg-surface-elevated text-fg-muted hover:text-fg'
        }`}
      >
        {embossEditMode
          ? embossTool === 'lasso'
            ? '선택하는 중 · 탭해서 종료'
            : '칠하는 중 · 탭해서 종료'
          : embossTool === 'lasso'
            ? '올가미로 선택 시작'
            : '형압 칠하기 시작'}
      </button>
      {embossEditMode &&
        (embossTool === 'lasso' ? (
          <p className="text-caption text-fg-muted">포스터 오브젝트 윤곽을 따라 드래그하면 자동으로 가장자리에 붙어요. 손을 떼면 선택이 닫혀요.</p>
        ) : (
          <p className="text-caption text-fg-muted">티켓 포스터 위를 드래그해서 볼록하게 만들 영역을 칠하세요.</p>
        ))}
      {embossTool === 'brush' && (
        <BrightnessSlider
          label="브러시 크기"
          id={`${prefix}-emboss-brush`}
          value={embossBrushRadius}
          onChange={setEmbossBrushRadius}
          min={0.02}
          max={0.2}
        />
      )}
      {hasMask && (
        <>
          <BrightnessSlider
            label="형압 강도"
            id={`${prefix}-emboss-intensity`}
            value={embossIntensity}
            onChange={setEmbossIntensity}
          />
          <button
            type="button"
            onClick={clearEmbossMask}
            data-touch="36"
            className="h-9 w-full rounded-chip border border-line bg-surface-elevated px-3 text-caption font-medium text-fg-muted transition-colors hover:text-fg active:scale-[0.97]"
          >
            칠한 영역 지우기
          </button>
        </>
      )}
    </div>
  );
}

const SIZE_AXES = [
  { key: 'poster', label: '포스터' },
  { key: 'logo', label: '로고' },
] as const;
type SizeAxis = (typeof SIZE_AXES)[number]['key'];

/**
 * 크기 패널(#441, #492, #527 → #554) — 포스터축(재크롭·채우기) × 로고축(체인·포맷 스케일).
 *
 * 모바일은 네 컨트롤을 세로로 쌓으면 dock이 400×675 뷰포트에서 **361px**(minimal + 원본 보유,
 * 즉 둘 다 뜨는 최악)까지 자라 프리뷰 티켓이 146×234px로 쪼그라든다 — #500이 후보정에서 걷어낸
 * dock 최댓값이 그대로 이 탭으로 옮겨 앉은 것. 그래서 후보정과 **같은 처방**을 쓴다: 한 번에 한
 * 축만 그리고 전환은 AxisSegment가 맡는다. 판정 근거(세 후보의 실측 절감이 −50~58px로 사실상
 * 같아 px가 아니라 대가로 갈렸다)는 #554 코멘트.
 *
 * 포스터축이 통째로 빌 수 있다(원본 없음 + POSTER_FILL_MOODS 밖 무드) — 그땐 세그먼트를 아예
 * 안 그리고 로고 슬라이더만 남긴다. 한 칸이 빈 축 전환은 죽은 컨트롤이라, 조건부 노출 규칙
 * (onRecropPoster·POSTER_FILL_MOODS)을 세그먼트 층까지 그대로 밀어올린 것.
 *
 * 데스크톱은 사이드 패널이라 이 세로 예산 문제가 없어(#500 "데스크톱 미해당") 두 축 상시 노출을
 * 유지한다 — 축 컨트롤 자체는 같은 JSX를 공유하고 배치만 갈린다(TexturePanel과 같은 모양).
 *
 * #563 이후 dock 높이 논거는 TexturePanel과 같이 읽을 것 — 축 분리가 줄이는 건 이제 dock이
 * 아니라 고정 슬롯 안에서 스크롤할 양이다.
 */
function SizePanel({ photo, actions }: { photo: Photo; actions: RailActions }) {
  const [axis, setAxis] = useState<SizeAxis>('poster');
  const prefix = ID_PREFIX;
  const { components } = photo.state;
  const setComp = photo.updateComponents;
  const stampScaleMax = stampScaleMaxFor(components.layout);

  // 크롭 재진입(#492) — "포스터 크기·비율을 한 자리에서" 다루게 하는 게 이 섹션의 취지라,
  // "얼마나 크게"(스케일·채우기) 옆에 "어디를 쓸지"(크롭)를 같이 둔다. #554가 이 결정을 다시
  // 열었고 **번복하지 않았다** — 후보 (b)(재크롭을 dock 밖으로)는 여기 축 분리와 절감이 같은데
  // (−56 vs −58px) 진입점을 하나 잃는 대가가 붙어서, 진입점을 그대로 둔 채 축으로 접는 (a)를
  // 골랐다. 원본이 없으면 셸이 onRecropPoster를 안 넘겨 버튼 자체가 안 뜬다 — 재업로드 안내는
  // 원래 진입점(모바일 헤더 메뉴 '재크롭', 데스크톱 POSTER 탭)이 disabled+title로 계속 들고 있다.
  // 포스터 채우기(#527/#492)는 값이 갈리는 무드에서만 — 나머지 무드는 슬롯이 이미 포스터 표준
  // 비율이라 토글해도 그림이 같다. 숨겨도 저장값은 남아 무드 복귀 시 그대로 살아난다(체인/포맷
  // 스케일 클램프와 같은 원칙).
  const showFit = POSTER_FILL_MOODS.has(components.layout);
  const posterAxis =
    actions.onRecropPoster || showFit ? (
      <div className="space-y-group">
        {actions.onRecropPoster && (
          <button
            type="button"
            onClick={actions.onRecropPoster}
            data-touch="40"
            className="h-10 w-full rounded-chip border border-line bg-surface-elevated px-3 text-caption font-medium text-fg transition-colors hover:bg-accent-soft hover:text-accent active:scale-[0.97]"
          >
            포스터 다시 크롭
          </button>
        )}
        {showFit && (
          <ChipRadio
            label="포스터 채우기"
            options={POSTER_FIT_OPTIONS}
            value={components.posterFit ?? 'contain'}
            onChange={(posterFit) => setComp({ posterFit })}
          />
        )}
      </div>
    ) : null;

  // 체인/포맷 로고 렌더 크기(#441, PR #485 P2 후속). value는 Math.min(raw, stampScaleMax)로
  // 표시만 클램프 — 저장된 raw 값은 안 건드려 다른 무드로 돌아가면 원래 크기로 복원된다.
  const logoAxis = (
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

  if (!posterAxis) {
    return (
      <div className="space-y-group">
        {posterAxis}
        {logoAxis}
      </div>
    );
  }
  const panelId = `${prefix}-size-axis-panel`;
  return (
    <div className="space-y-group">
      <AxisSegment
        ariaLabel="크기 축"
        panelId={panelId}
        options={SIZE_AXES}
        value={axis}
        onChange={(next) => setAxis(next)}
      />
      {/* key={axis} — TexturePanel과 같은 이유(축이 갈리면 컨트롤을 새로 세워 포커스가 옛 의미를
          물고 넘어가지 않게). */}
      <div id={panelId} key={axis}>
        {axis === 'poster' ? posterAxis : logoAxis}
      </div>
    </div>
  );
}

/**
 * 배경 기하 패턴이 존재하는 무드(#530 PR 1) — 판정 기준은 "패턴을 깔 종이 바탕이 그 무드에
 * 실재하는가" 하나(이슈 본문). Editorial·Criterion v5·Stub는 셋 다 종이 면이 이미 서 있다.
 * 이번 PR은 이 셋을 appliesTo에 전부 등록하되 Editorial 렌더링만 붙인다 — Criterion·Stub는
 * 무드 자체가 재설계 대상이라(#524 03, Stub 리디자인) 값은 저장되지만 아직 티켓에 안 그려진다.
 */
const BACKGROUND_PATTERN_MOODS: readonly LayoutId[] = ['editorial', 'criterion', 'stub'];

function BackgroundPatternPanel({ photo }: { photo: Photo }) {
  const pattern = photo.state.components.backgroundPattern ?? 'none';
  const image = photo.state.components.backgroundPatternImage;
  // 업로드는 로고 스탬프와 **같은** 자유비 크롭 흐름(useLogoCrop, #220)을 그대로 탄다 — 새 의존성도
  // 새 크롭 경로도 없다. 크롭 결과가 곧 배경 이미지고, 고르는 순간 backgroundPattern도 'custom'으로
  // 같이 넘긴다(다른 프리셋을 보고 있는데 업로드만 되고 안 그려지는 상태를 안 만든다).
  const { rawSrc, isCropping, openFile, handleComplete, handleCancel } = useLogoCrop((backgroundPatternImage) =>
    photo.updateComponents({ backgroundPattern: 'custom', backgroundPatternImage }),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) openFile(file);
    // 같은 파일을 다시 골라도 change가 뜨게 비운다(StampSheet와 같은 처리).
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-field">
      <ChipRadio
        label="배경 패턴"
        options={BACKGROUND_PATTERN_OPTIONS}
        value={pattern}
        onChange={(backgroundPattern) => photo.updateComponents({ backgroundPattern })}
      />

      {/* '내 이미지'를 고른 동안만 업로드 컨트롤을 그린다 — 다른 프리셋에서 죽은 컨트롤을 안 남긴다. */}
      {pattern === 'custom' && (
        <div className="space-y-3">
          {image && (
            <div className="flex items-center gap-3 rounded-field border border-line bg-surface-elevated px-3.5 py-3">
              <img src={image} alt="배경 패턴 이미지" className="h-10 w-auto object-contain" />
              <button
                type="button"
                // blob revoke는 여기서 하지 않는다 — undo 히스토리(#356)가 이 URL을 참조한다
                // (useLogoCrop 주석과 같은 이유). 최신 URL은 usePhototicket이 언마운트·clearDraft에서 푼다.
                onClick={() => photo.updateComponents({ backgroundPatternImage: '' })}
                className="ml-auto rounded-chip border border-line px-3 py-1.5 text-caption font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent active:scale-[0.97]"
              >
                이미지 제거
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            data-touch="40"
            className="inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-chip border border-dashed border-line bg-surface-elevated px-4 text-caption font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent active:scale-[0.97]"
          >
            {image ? '이미지 교체' : '이미지 업로드'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileChange}
            aria-label="배경 패턴 이미지 업로드"
            className="sr-only"
          />

          {rawSrc && (
            <ImageCropModal
              imageSrc={rawSrc}
              title="배경 이미지 크롭"
              onClose={handleCancel}
              onComplete={handleComplete}
              isProcessing={isCropping}
            />
          )}
        </div>
      )}
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
    render: (photo) => (
      <LayoutStrip
        value={photo.state.components.layout}
        onChange={(id: LayoutId) => photo.updateComponents({ layout: id })}
      />
    ),
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
    render: (photo) => <TexturePanel photo={photo} />,
  },
  {
    id: 'emboss',
    label: '형압',
    eyebrow: 'Emboss',
    // 형압: 볼록 원 힌트 — 큰 원(융기 영역) 안에 작은 채움 원(빛 반사 포인트).
    icon: (
      <svg {...RAIL_ICON}>
        <circle cx="12" cy="12" r="7" />
        <circle cx="9.5" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
    render: (photo) => <EmbossPanel photo={photo} />,
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
    render: (photo) => {
      const prefix = ID_PREFIX;
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
    render: (photo, actions) => <SizePanel photo={photo} actions={actions} />,
  },
  {
    id: 'pattern',
    label: '패턴',
    eyebrow: 'Pattern',
    // 패턴: 격자 점 — 도트/사선/그리드 카탈로그를 아우르는 중립 힌트.
    icon: (
      <svg {...RAIL_ICON}>
        <circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="7" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="17" cy="7" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="7" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="17" cy="12" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="7" cy="17" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="17" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="17" cy="17" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
    appliesTo: BACKGROUND_PATTERN_MOODS,
    render: (photo) => <BackgroundPatternPanel photo={photo} />,
  },
  {
    id: 'custom',
    label: '커스텀',
    eyebrow: 'Custom',
    // 커스텀: 슬라이더 두 줄(무드 전용 조절 힌트) — 크기(사방 화살표)·후보정(사선)과 안 겹친다.
    icon: (
      <svg {...RAIL_ICON}>
        <path d="M4 8h11M19 8h1M4 16h5M13 16h7" />
        <circle cx="17" cy="8" r="2" />
        <circle cx="11" cy="16" r="2" />
      </svg>
    ),
    appliesTo: QUOTE_FONT_MOODS,
    render: (photo) => <CustomPanel photo={photo} />,
  },
];
