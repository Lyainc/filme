import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import dynamic from 'next/dynamic';
import { LayoutStrip } from '@/components/LayoutPicker';
import { useLogoCrop } from '@/hooks/useLogoCrop';
import TexturePicker from '@/components/wizard/TexturePicker';
import ColorPicker from '@/components/wizard/ColorPicker';
import BrightnessSlider from '@/components/wizard/BrightnessSlider';
import { TEXTURE_RECIPES } from '@/utils/textureRecipes';
import { MATERIAL_OPTIONS, COATING_OPTIONS, TARGET_HEIGHT } from '@/utils/constants';
import { MINIMAL_STAMP_MAX_SCALE } from '@/components/moods/MoodMinimal';
import { containsHangul } from '@/components/moods/_shared';
import { Eyebrow } from './Eyebrow';
import { POSTER_FILL_MOODS, TONE_FIXED_MOODS } from '@/constants/fields';
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
export type RailItemId = 'mood' | 'color' | 'texture' | 'highlight' | 'opacity' | 'size' | 'pattern' | 'custom';
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
          className={cn(pressableVariants(), `h-9 flex-1 truncate rounded-chip border px-3 text-caption font-medium transition-colors ${
            value === o.key
              ? 'border-transparent bg-accent-soft text-accent'
              : 'border-line bg-surface-elevated text-fg-muted'
          }`)}
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
  /** null = 어떤 칩도 "선택됨"으로 표시하지 않는다(형압처럼 값 선택이 곧 실행 상태를 뜻해,
      실행 중이 아닐 땐 마지막으로 쓴 도구를 선택된 것처럼 보이면 안 되는 경우). */
  value: V | null;
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
            // h-9(#682 다이어트 — 이전 h-10에서 4px 축소, AxisSegment 형제 버튼과 같은 높이로
            // 맞춘다). AA 하한(24)의 1.5배라 여전히 여유 있다.
            data-touch="36"
            className={cn(pressableVariants(), `h-9 flex-1 truncate rounded-chip border px-3 text-caption font-medium transition-colors ${
              value === opt.value
                ? 'border-transparent bg-accent-soft text-accent'
                : 'border-line bg-surface-elevated text-fg-muted'
            } ${opt.disabled ? 'opacity-40' : ''}`)}
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

// 효과 축(#732 d3 · #735) — 하이라이트(기존 광택)와 형압(볼록 압인, #734)은 마스크가 분리돼 있어
// 브러시/올가미가 지금 어느 쪽에 커밋되는지 먼저 골라야 한다. 도구 칩과 달리 값이 항상 선택돼
// 있다 — "지금 칠하는 중"만 뜻하는 도구 칩(null=idle)과 달리, 편집을 끝낸 뒤에도 강도 슬라이더가
// 어느 효과를 가리키는지 계속 표시해야 하기 때문이다.
const EMBOSS_EFFECT_OPTIONS = [
  { value: 'highlight', label: '하이라이트' },
  { value: 'relief', label: '형압' },
] as const;

/**
 * 형압 패널(#509 → #679 → #735 마스크 분리) — 재질·코팅 옆 독립 후가공 축(c5). 모드는 c9(명시적 진입/종료)를
 * 유지하지만, 진입 어포던스를 별도 전폭 CTA에서 뗐다(#679: 값 칩 → 전폭 CTA → 안내문 → 슬라이더
 * 4단 구성이 다른 패널의 AxisSegment/ChipRadio 문법과 어긋나고, 그 CTA가 393×659에서 화면 밖으로
 * 잘렸다 — bottom 666.2 > 659). 셸이 브러시 레이어를 띄우는 절반(MobileEditorShell이 photo.
 * embossEditMode를 직접 읽는 부분)은 그대로다 — 이 패널은 상태를 켜고 끌 뿐 브러시 자체를 그리지
 * 않는다(브러시는 티켓 프리뷰 위에 겹쳐야 해서 rail 패널 트리 밖에 산다).
 *
 * 도구 칩(브러시/올가미) 탭 자체가 그 도구로 편집 모드에 진입한다(#679 방향 1) — "도구를 고른다
 * → 시작 버튼을 누른다"의 2단계를 1단계로 접는다: 도구를 고르는 행위 자체가 이미 의도 표명이라는
 * 판단. 이미 편집 중인 도구 칩을 다시 탭하면 종료된다 — 칩 자체가 진입·종료 어포던스를 겸해
 * 별도 버튼 없이 상태 전체를 표현한다(ChipRadio는 포스터 fit·한줄평 폰트가 이미 쓰는 값 피커
 * 문법, ColorPicker와 동일).
 *
 * **컨트롤 4종이 동시에 다 뜨지 않는다(#682 다이어트)** — 실측(393×659)해보니 다 뜬 상태가
 * 최대 308px로 슬롯(171px) 대비 137px 넘쳤다. 편집 중/편집 후가 서로 다른 관심사라는 게
 * 근거다: 칠하는 동안은 브러시 크기(칠하는 도구 자체를 조절)만 필요하고, 칠한 걸 검토·조정하는
 * 건 편집을 끝낸 뒤(형압 강도·지우기)다 — 그래서 브러시 크기는 `embossEditMode` 동안만,
 * 강도·지우기는 `!embossEditMode` 동안만 뜬다. "지우기"도 전폭 버튼(52px)이 아니라 형압 강도
 * 슬라이더 라벨 줄에 접힌다(BrightnessSlider의 action prop). 최악(편집 중, 마스크 有)이 177px로
 * 줄어든다 — 슬롯보다 6px 남는데, 이건 칠하는 손이 캔버스(EmbossBrushLayer, zIndex 45)에 있어
 * 이 패널을 보고 있지 않을 확률이 높은 유일한 잔여 상태라 CSS 스크롤 어포던스(DesignRail.tsx)로
 * 감수한다 — "편집 중이 아닌" 모든 상태는 슬롯 안에 다 들어간다(실측 171px, 넘침 0).
 *
 * **#735가 한때 이 마지막 문장을 깼다가, 같은 이슈에서 되돌려놨다.** 하이라이트·형압이 마스크를
 * 분리하며(각자 embossStamps/Paths·reliefStamps/Paths, `usePhototicket.embossEffect`가 지금
 * 어느 쪽에 커밋되는지 고른다) "효과" 선택 한 줄이 상시로 붙었다 — 도구 칩과 달리 편집 중이
 * 아닐 때도 항상 떠 있어야 강도 슬라이더가 어느 효과를 가리키는지 계속 보인다(도구 칩의
 * null=idle 관례를 그대로 못 씀). ChipRadio(자체 Eyebrow 라벨)로 처음 얹었을 땐 정상 상태가
 * 199px로 슬롯(176px)을 +23px 넘쳤다(2026-08-18 실측) — "효과"가 실질적으로는 SizePanel
 * (포스터/로고)·TexturePanel(재질/코팅)과 같은 **축 전환**(선택이 아래 마스크·강도 전체를
 * 갈아끼움)이라, 같은 역할에 이미 쓰던 AxisSegment(라벨 없는 세그먼트 한 줄)로 바꾸고 바깥
 * 감쌈도 SizePanel과 같은 이유로 space-y-field로 좁혀 26.5px+6px를 되찾았다. 실측(puppeteer,
 * 400×675 다크): 정상 상태 176/176(넘침 0, 393×659에서도 171/171)로 복귀했고, 최악(편집 중
 * 브러시, 마스크 有)은 223/176(+47px)로 줄었다 — 여전히 슬롯을 넘치지만 위 문단이 감수하기로
 * 한 바로 그 "칠하는 손이 캔버스에 있어 패널을 안 보는" 잔여 상태라 카테고리는 그대로다.
 */
function EmbossPanel({ photo }: { photo: Photo }) {
  const {
    embossEditMode,
    setEmbossEditMode,
    embossBrushRadius,
    setEmbossBrushRadius,
    embossTool,
    setEmbossTool,
    embossEffect,
    setEmbossEffect,
    clearEmbossMask,
    setEmbossIntensity,
  } = photo;
  const { embossStamps, embossPaths, embossIntensity, reliefStamps, reliefPaths, reliefIntensity } = photo.state;
  // 지금 선택된 효과의 마스크·강도만 본다 — 두 마스크는 분리돼 있으니(#735) "지우기"·강도 슬라이더가
  // 다른 효과 쪽을 건드리면 안 된다.
  const hasMask = embossEffect === 'relief' ? reliefStamps.length > 0 || reliefPaths.length > 0 : embossStamps.length > 0 || embossPaths.length > 0;
  const intensity = embossEffect === 'relief' ? reliefIntensity : embossIntensity;
  const prefix = ID_PREFIX;
  const panelId = `${prefix}-emboss-effect-panel`;
  return (
    // space-y-field(SizePanel과 같은 이유 — 세그먼트와 그 아래 콘텐츠는 같은 축의 헤더·본문이라
    // group(16px)보다 field(10px)가 맞고, #735로 예산이 빠듯해진 지금은 그 6px도 필요하다).
    <div className="space-y-field">
      {/* 효과 축은 AxisSegment로(#735 다이어트) — 하이라이트/형압 선택이 아래 마스크·강도 전체를
          갈아끼우는 축 전환이라 SizePanel(포스터/로고)·TexturePanel(재질/코팅)과 같은 역할이다.
          ChipRadio(자체 Eyebrow 라벨 한 줄)보다 26.5px 짧다 — 레일 슬롯 정상 상태가 199px로
          넘치던 것(위 문서 주석)의 원인이 이 한 줄이었다. */}
      <AxisSegment
        ariaLabel="효과"
        panelId={panelId}
        options={EMBOSS_EFFECT_OPTIONS.map((o) => ({ key: o.value, label: o.label }))}
        value={embossEffect}
        // setState를 그대로 넘기지 않고 람다로 감싼다(AxisSegment 독스트링 경고 — SetStateAction이
        // K 추론에 끼어들면 'highlight'|'relief' 유니온이 string으로 풀린다, TexturePanel과 동형).
        onChange={(next) => setEmbossEffect(next)}
      />
      <div id={panelId} className="space-y-group">
        <ChipRadio
          label="도구"
          options={EMBOSS_TOOL_OPTIONS}
          // 편집 중이 아니면 null — 값 선택이 곧 실행 상태라, 마지막으로 쓴 도구가 계속
          // 선택된 것처럼 보이면 지금 칠하는 중인지 칩만 보고 구분이 안 된다(fresh-context 리뷰).
          value={embossEditMode ? embossTool : null}
          onChange={(next) => {
            // 편집 중인 도구를 다시 탭 = 종료. 그 외(다른 도구 탭, 또는 편집 중이 아닐 때 탭)는
            // 그 도구로 진입 — 칩 하나가 도구 선택 + 진입/종료 토글을 모두 담당한다.
            if (next === embossTool && embossEditMode) {
              setEmbossEditMode(false);
            } else {
              setEmbossTool(next);
              setEmbossEditMode(true);
            }
          }}
        />
        {/* hasMask && !embossEditMode(=강도·지우기가 뜨는 상태)일 땐 안내문을 아예 안 그린다 —
            <p>를 비운 채 두면 빈 줄도 space-y-group 간격을 그대로 먹어(#682 다이어트가 지운
            28px 중 하나) 안내가 필요 없어진 상태에서까지 자리를 차지한다. */}
        {(embossEditMode || !hasMask) && (
          <p className="text-caption text-fg-muted">
            {embossEditMode
              ? embossTool === 'lasso'
                // #682 다이어트로 줄였을 때 "손을 떼면 선택이 닫혀요"가 통째로 빠졌었다(claude-review
                // PR #692 P1) — EmbossBrushLayer.tsx의 onPointerUp이 실제로 그 순간 다각형을
                // 커밋하고 미리보기 선을 지우는데(스냅해서 닫힌다는 시각 피드백이 따로 없다), 그걸
                // 안내하는 유일한 수단이 이 문구라 정보 손실이었다. 다시 채워 넣되 원문(68자)만큼
                // 늘리지 않고 한 문장에 접어 44자로 복원한다.
                ? '윤곽을 따라 드래그하면 자동으로 붙고, 손을 떼면 닫혀요. 다시 탭하면 끝나요.'
                : '드래그해서 칠하세요. 도구를 다시 탭하면 끝나요.'
              : '도구를 탭하면 바로 편집을 시작해요.'}
          </p>
        )}
        {embossEditMode && embossTool === 'brush' && (
          <BrightnessSlider
            label="브러시 크기"
            id={`${prefix}-emboss-brush`}
            value={embossBrushRadius}
            onChange={setEmbossBrushRadius}
            min={0.02}
            max={0.2}
          />
        )}
        {hasMask && !embossEditMode && (
          // "지우기"를 별도 전폭 버튼(#682 이전엔 52px) 대신 슬라이더 라벨 줄에 접는다 —
          // BrightnessSlider의 action prop(같은 목적으로 새로 연 옵션). id에 effect를 실어야
          // 효과를 오가며 열어도 React가 다른 슬라이더로 보고 localValue를 다시 seed한다.
          <BrightnessSlider
            key={embossEffect}
            label={embossEffect === 'relief' ? '형압 강도' : '하이라이트 강도'}
            id={`${prefix}-emboss-intensity-${embossEffect}`}
            value={intensity}
            onChange={setEmbossIntensity}
            action={{ label: '지우기', onClick: clearEmbossMask }}
          />
        )}
      </div>
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
  // space-y-field(#682 다이어트) — 재크롭 버튼과 포스터 채우기 칩은 같은 "포스터" 축 안의
  // 형제 컨트롤이라 space-y-group(16px)보다 좁은 field 간격(10px)이 맞다. h-10→h-9도 같이
  // 줄인다 — 위 AxisSegment(형제 버튼들도 h-9)와 높이를 맞추면서 4px을 아낀다.
  const posterAxis =
    actions.onRecropPoster || showFit ? (
      <div className="space-y-field">
        {actions.onRecropPoster && (
          <button
            type="button"
            onClick={actions.onRecropPoster}
            data-touch="36"
            className={cn(pressableVariants(), 'h-9 w-full rounded-chip border border-line bg-surface-elevated px-3 text-caption font-medium text-fg transition-colors hover:bg-accent-soft hover:text-accent')}
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
    // space-y-field(#682 다이어트, TexturePanel의 같은 축-스위처+콘텐츠 구조는 그대로 group을
    // 쓰지만 여긴 예산이 더 빠듯해 6px을 더 줄인다) — 세그먼트와 그 아래 콘텐츠는 서로 다른
    // 관심사 묶음이 아니라 같은 축의 헤더·본문이라 field 간격이 더 맞다.
    <div className="space-y-field">
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
 * 배경 이미지를 실을 수 있는 무드(#530 PR 1) — 판정 기준은 "배경을 깔 종이 바탕이 그 무드에
 * 실재하는가" 하나(이슈 본문). Editorial·Criterion v5·Stub는 셋 다 종이 면이 이미 서 있고,
 * 셋 다 렌더링까지 붙어 있다.
 */
const BACKGROUND_PATTERN_MOODS: readonly LayoutId[] = ['editorial', 'criterion', 'stub'];

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
const BACKGROUND_OPACITY_DEFAULT = 0.5;

function BackgroundPatternPanel({ photo }: { photo: Photo }) {
  const image = photo.state.components.backgroundPatternImage;
  // 업로드는 로고 스탬프와 **같은** 자유비 크롭 흐름(useLogoCrop, #220)을 그대로 탄다 — 새 의존성도
  // 새 크롭 경로도 없다. 크롭 결과가 곧 스탬프 이미지다(#672로 프리셋 id 축이 사라져 같이 넘길 값도
  // 없어졌다 — 이미지 유무가 곧 스탬프 유무다).
  // maxSide는 로고 기본값(640)을 쓰면 안 된다 — 무드별 고정 박스라도 cover로 채워 그리므로 저장물은
  // pixelRatio 2라, criterion 기준 1920×3068 device px를 640짜리로 늘리면 3~5배 확대돼 뭉갠다.
  // 포스터가 같은 급 슬롯에 960×1440을 쓰는 것과 같은 이유로 캔버스 긴 변(TARGET_HEIGHT)에 맞춘다.
  //
  // 투명도 write-time 커밋(#728 c4) — 이미지와 투명도를 같은 updateComponents 호출에 묶는다.
  // 사용자가 이미 값을 고른 적이 있으면(`?? 기본값`) 그 값을 유지하고, 없으면(첫 업로드) 반투명
  // 기본값을 새로 써 넣는다. 렌더 쪽에서 "언제 올라온 이미지인가"로 분기하지 않는 이유는 그 축을
  // 저장할 필요가 아예 없어지기 때문이고, 이미지·투명도를 한 번에 커밋하는 이유는 undo 히스토리
  // 때문이다 — 따로 쓰면 undo 한 번이 반쯤 되돌린 상태를 만든다.
  const { rawSrc, isCropping, openFile, handleComplete, handleCancel } = useLogoCrop(
    (backgroundPatternImage) =>
      photo.updateComponents({
        backgroundPatternImage,
        backgroundPatternOpacity: photo.state.components.backgroundPatternOpacity ?? BACKGROUND_OPACITY_DEFAULT,
      }),
    TARGET_HEIGHT,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) openFile(file);
    // 같은 파일을 다시 골라도 change가 뜨게 비운다(StampSheet와 같은 처리).
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {image && (
        <div className="flex items-center gap-3 rounded-field border border-line bg-surface-elevated px-3.5 py-3">
          <img src={image} alt="스탬프 이미지" className="h-10 w-auto object-contain" />
          <button
            type="button"
            // blob revoke는 여기서 하지 않는다 — undo 히스토리(#356)가 이 URL을 참조한다
            // (useLogoCrop 주석과 같은 이유). 최신 URL은 usePhototicket이 언마운트·clearDraft에서 푼다.
            onClick={() => photo.updateComponents({ backgroundPatternImage: '' })}
            className={cn(pressableVariants(), 'ml-auto rounded-chip border border-line px-3 py-1.5 text-caption font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent')}
          >
            이미지 제거
          </button>
        </div>
      )}

      {/* 크기·투명도(#680·#728) — 이미지가 있을 때만. 없으면 조절할 대상이 없어 죽은 컨트롤이 된다.
          크기 패널이 아니라 여기 두는 건 그 패널이 이미 넘치기도 하지만(#682), RailItem.appliesTo가
          이미 BACKGROUND_PATTERN_MOODS로 3무드 게이팅을 해줘 노출 조건을 새로 짤 게 없어서다. */}
      {image && (
        <div className="space-y-group">
          <BrightnessSlider
            label="스탬프 크기"
            id={`${ID_PREFIX}-background-scale`}
            value={photo.state.components.backgroundPatternScale ?? 1}
            onChange={(backgroundPatternScale) => photo.updateComponents({ backgroundPatternScale })}
            min={1}
            max={BACKGROUND_SCALE_MAX}
          />
          <BrightnessSlider
            label="스탬프 투명도"
            id={`${ID_PREFIX}-background-opacity`}
            value={photo.state.components.backgroundPatternOpacity ?? 1}
            onChange={(backgroundPatternOpacity) => photo.updateComponents({ backgroundPatternOpacity })}
            min={BACKGROUND_OPACITY_MIN}
            max={1}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        data-touch="40"
        className={cn(pressableVariants(), 'inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-chip border border-dashed border-line bg-surface-elevated px-4 text-caption font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent')}
      >
        {image ? '이미지 교체' : '이미지 업로드'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        aria-label="스탬프 이미지 업로드"
        className="sr-only"
      />

      {rawSrc && (
        <ImageCropModal
          imageSrc={rawSrc}
          title="스탬프 이미지 크롭"
          onClose={handleCancel}
          onComplete={handleComplete}
          isProcessing={isCropping}
        />
      )}
    </div>
  );
}

const COLOR_ITEM: RailItem = {
  id: 'color',
  label: '컬러',
  // 컬러: 스포이드 — 닫힌 path 하나(도구 실루엣) + 픽업 지점 선. 형압·투명도와 원 계열을
  // 공유하지 않도록 #676에서 교체(잉크 색을 "찍는" 동작을 직접 지시).
  icon: (
    <svg {...RAIL_ICON}>
      <path d="m21.7 2.3-1.4 1.4M17.4 6.6a2 2 0 1 0-2.8-2.8l-9.9 9.9a2 2 0 0 0-.5.9L3 18.5a1 1 0 0 0 1 1l3.9-1.2a2 2 0 0 0 1-.5l9.9-9.9a2 2 0 0 0 0-2.8Z" />
      <path d="m9 11 4 4" />
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
    id: 'highlight',
    label: '하이라이트',
    // 하이라이트: 볼록 단면 — 기준선에서 솟아오르는 돔 곡선(측면에서 본 융기 프로필). 컬러·투명도와
    // 원 계열을 공유하지 않도록 #676에서 교체.
    icon: (
      <svg {...RAIL_ICON}>
        <path d="M4 18h16" />
        <path d="M4 18c0-7 4-12 8-12s8 5 8 12" />
      </svg>
    ),
    render: (photo) => <EmbossPanel photo={photo} />,
  },
  {
    id: 'opacity',
    label: '투명도',
    // 투명도: 체커보드 — 테두리 사각형 + 대각 두 칸 채움 path 하나(포토샵류 투명 배경 표기).
    // 컬러·형압과 원 계열을 공유하지 않도록 #676에서 교체.
    icon: (
      <svg {...RAIL_ICON}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
        <path d="M3.5 3.5h8.5v8.5h-8.5ZM12 12h8.5v8.5H12Z" fill="currentColor" stroke="none" />
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
    // id는 'pattern' 그대로 둔다(#672) — 저장·URL 어디에도 안 실리는 내부 키인데, 같이 남은
    // `backgroundPatternImage`(draft 키라 개명 불가)와 이름이 갈리면 오히려 두 벌이 된다.
    id: 'pattern',
    label: '스탬프',
    // 스탬프: 액자 안에 얹힌 사진(산 능선 + 해) — 무드가 정한 고정 박스에 앉는 사용자 이미지다.
    icon: (
      <svg {...RAIL_ICON}>
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <circle cx="8.5" cy="10" r="1.5" />
        <path d="M4 16.5l4.5-4 3.5 3 3-2.5 5 4.5" />
      </svg>
    ),
    appliesTo: BACKGROUND_PATTERN_MOODS,
    render: (photo) => <BackgroundPatternPanel photo={photo} />,
  },
  {
    id: 'custom',
    label: '커스텀',
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
