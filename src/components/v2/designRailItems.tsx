import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { LayoutStrip } from '@/components/LayoutPicker';
import TexturePicker from '@/components/v2/pickers/TexturePicker';
import ColorPicker from '@/components/v2/pickers/ColorPicker';
import BrightnessSlider from '@/components/v2/pickers/BrightnessSlider';
import { TEXTURE_RECIPES } from '@/utils/textureRecipes';
import { MATERIAL_OPTIONS, COATING_OPTIONS } from '@/utils/constants';
import { userTextFont } from '@/components/moods/_shared';
import { MINIMAL_STAMP_MAX_SCALE } from '@/components/moods/MoodMinimal';
import { DEFAULT_QUOTE } from '@/components/moods/MoodCriterion';
import { Eyebrow } from './Eyebrow';
import { POSTER_FILL_MOODS, TONE_FIXED_MOODS, STAMP_KEYS, STAMP_LABELS, STAMP_TARGETS, type SheetTarget } from '@/constants/fields';
import type { LayoutId } from '@/types';
import type { usePhototicket } from '@/hooks/usePhototicket';

// #523 → #826 S2 — 디자인 도크의 도구 정의 목록. 예전엔 가로 원형 아이콘 레일(DesignRail)의 항목이었고
// 지금은 도크 디자인 모드의 도구 줄(무드 · 색상 · 재질 · 코팅 · 투명도 · 크기, 마스터 D-01~D-05)이
// 소비한다. 패널 본문은 그대로 재사용하고, 질감 도구는 재질/코팅 두 도구로 갈라 각자 강도 슬라이더를
// 든다(D-03 — 도구 줄 · 칸 · 옵션의 세 겹을 한 겹 걷었다). '커스텀'(한줄평·서명 폰트)과 '스탬프'
// 항목은 디자인 도구가 아니다: 스탬프 업로드는 사진 모드로, 폰트는 인플레이스 입력 바로 간다.
// 슬라이더 id의 rail- prefix는 그대로 유지한다(기존 id 보존).
export type DesignToolId = 'mood' | 'color' | 'material' | 'coating' | 'opacity' | 'size';
type Photo = ReturnType<typeof usePhototicket>;

/**
 * 도구가 셸에서만 할 수 있는 동작을 부를 때 쓰는 통로. photo(상태)로는 표현이 안 되는 것만
 * 여기 온다 — 인플레이스 편집은 셸이 소유한다. 포스터 재크롭(#492)은 사진 모드의 자르기 행으로
 * 옮겨 갔다(#826 S2 G-01).
 */
export interface DesignToolActions {
  /** 필드 인플레이스 편집 진입(#781) — 로고 크기 패널의 입력 액션이 셸의 handleField로 로고 입력을 연다. */
  onEditField?: (field: SheetTarget) => void;
}

export interface DesignTool {
  id: DesignToolId;
  label: string;
  // 이 무드 목록에서만 도구 자체가 존재한다("숨김" — 개념이 아예 없는 무드). 없으면 전 무드
  // 노출. filterItemsForMood가 이 필드로 실제 렌더 목록을 걸러낸다. "잠금"(개념은 있으나 그
  // 무드가 값을 고정)은 이 필드가 아니라 도구 자신의 render 안에서 disabled로 표현 — 색상이
  // 그 예: TONE_FIXED_MOODS를 이 필드에 안 싣고 render 클로저 안에서만 직접 참조해, 탭은
  // 그대로 두고 컨트롤만 잠근다(D-02 '이 무드는 색이 고정돼요').
  appliesTo?: readonly LayoutId[];
  render: (photo: Photo, actions: DesignToolActions) => ReactNode;
}

// #523 AC3 — appliesTo 기반 무드별 노출 필터. 순수 함수라 합성(가짜) 항목만으로 검증 가능.
export function filterItemsForMood<T extends { appliesTo?: readonly LayoutId[] }>(
  items: readonly T[],
  layout: LayoutId,
): T[] {
  return items.filter((item) => !item.appliesTo || item.appliesTo.includes(layout));
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
 * 축 전환 세그먼트(#500 → #554) — 한 번에 한 축만 그리는 배치의 공용 스위치. #826 S2에서 후보정(재질↔
 * 코팅)과 크기(포스터↔로고)는 도구가 갈려 이 스위치를 안 쓰고, 지금 소비자는 폰트 패널(CustomPanel)뿐이다.
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
              : 'border-hair bg-s2 text-ink-2'
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
  preview,
  optionStyle,
}: {
  label: string;
  options: readonly { value: V; label: string; disabled?: boolean }[];
  value: V;
  onChange: (next: V) => void;
  /** 칩 하나 이상이 잠겼을 때의 사유. 잠긴 칩이 없으면 호출부가 undefined를 넘긴다. */
  note?: string;
  /** 옵션 위에 얹는 실견본(#780) — 지금은 폰트 피커 전용. 존재 여부로 grid/flex 배치를 가른다. */
  preview?: ReactNode;
  /** 옵션 라벨 자체를 그 선택지의 서체로 그린다(#780) — 선택 전에도 9택을 나란히 비교하게. */
  optionStyle?: (value: V, label: string) => CSSProperties;
}) {
  return (
    <div className="space-y-field">
      <Eyebrow as="div">{label}</Eyebrow>
      {note && <p className="text-caption text-ink-2">{note}</p>}
      {preview}
      {/* 이름은 컨테이너 aria-label로 — TexturePicker·FieldEditorBody의 radiogroup과 같은 문법. */}
      {/* 폰트 피커가 9택이 되면서(#437) 한 줄에 다 못 선다 — basis 6rem은 400px 프레임에서
          한 줄에 3칩이 서는 값이고, 나머지 소비자(도구·포스터 채우기)는 전부 2택이라 grow가
          예전 flex-1과 똑같이 반씩 채운다. basis 0(=flex-1)이면 wrap이 영영 안 일어난다.
          폰트 피커(preview가 있는 소비자)만 grid로 간다(#780) — flex-wrap에선 마지막 줄에 한 칩만
          남으면 grow가 그 칩을 줄 전체로 늘렸다(320px에서 140 vs 288). auto-fit + minmax(6rem)는
          같은 6rem 하한으로 열 수를 정하면서 마지막 칩도 같은 너비에 세운다. grid 안에선 칩의
          grow·basis가 효과가 없고 무해하다. */}
      <div role="radiogroup" aria-label={label} className={preview !== undefined ? 'grid grid-cols-[repeat(auto-fit,minmax(6rem,1fr))] gap-2' : 'flex flex-wrap gap-2'}>
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
            className={cn(pressableVariants(), `h-9 grow basis-[6rem] truncate rounded-chip border px-3 text-caption font-medium transition-colors ${
              value === opt.value
                ? 'border-transparent bg-accent-soft text-accent'
                : 'border-hair bg-s2 text-ink-2'
            } ${opt.disabled ? 'opacity-40' : ''}`)}
            style={optionStyle?.(opt.value, opt.label)}
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

/**
 * 한줄평·서명 폰트 9택(#558 4택 → #437). 값의 뜻과 실제 폰트는 `_shared.tsx`의 `userTextFont`가
 * 단일 소스이고, 여기는 라벨만 쥔다.
 *
 * 라벨이 스타일 이름이 아니라 폰트 이름인 건 8종 중 5종이 손글씨 계열이기 때문이다 —
 * '손글씨'·'캘리그라피' 같은 스타일어로는 서로 구분이 안 돼서, 사용자가 눈누에서 보고 고른
 * 이름 그대로 쓴다. 그래서 #558의 'hand'는 값은 그대로 두고 라벨만 '손글씨'→'자람'이 됐다.
 *
 * 'serif'(Instrument Serif)는 빠졌다 — 한글 글리프가 없어 한글에선 항상 잠겨 있던 칩인데,
 * 한글 되는 세리프('바탕' = 경기천년바탕)가 들어오면서 자리를 넘겼다. 라틴 세리프는 'auto'가
 * 계속 준다(QuoteFont 주석 — 저장돼 있던 'serif'는 렌더가 안 변한다).
 */
const QUOTE_FONT_OPTIONS = [
  { value: 'auto', label: '자동' },
  { value: 'gothic', label: '고딕' },
  { value: 'batang', label: '바탕' },
  { value: 'hand', label: '자람' },
  { value: 'ink', label: '잉크' },
  { value: 'eunyoung', label: '은영' },
  { value: 'brush', label: '붓' },
  { value: 'coolguy', label: '쿨가이' },
  { value: 'flower', label: '꽃길' },
] as const;

/**
 * 한줄평 폰트가 존재하는 무드(#558) — quote를 렌더하는 무드와 같다. '커스텀' 항목의 appliesTo는
 * **그 항목에 든 컨트롤들의 합집합**이고, 컨트롤은 render 안에서 제 표를 다시 본다(#523 c1과
 * 같은 처방 — SizePanel의 showFit/POSTER_FILL_MOODS가 선례). 지금은 컨트롤이 하나뿐이라 둘이
 * 같지만, #530 배경 패턴이 이 항목에 합류하면 합집합만 넓어지고 폰트 피커는 여기서 계속 걸린다.
 */
const QUOTE_FONT_MOODS: readonly LayoutId[] = ['criterion'];

/**
 * 서명 폰트가 존재하는 무드(#437) — signature를 텍스트 스팬으로 렌더하는 무드 전부. 35mm·
 * 35mm-landscape는 필름 엣지 스텐실(FONT_LCD 고정, 대상 아님)과 별개로 FilmCreditCut의
 * "Collected by" 행이 다른 4무드와 같은 userTextFont 경로를 타서 포함된다
 * (docs/specs/quote-signature-font-selection.md §6).
 */
/** 폰트 칩 라벨의 기준 크기(#780) — caption(12px) 그대로면 체감 크기가 가장 작은 손글씨 계열이
 *  칩 안에서 거의 안 읽힌다. `userTextFont`의 #437 배율이 hand=1.0 기준이라 16을 주면 손글씨는
 *  16px, 고딕·바탕은 13px 안팎으로 서서 9칩의 글자면이 비슷한 크기로 선다. */
const CHIP_SAMPLE_BASE_PX = 16;

const SIGNATURE_FONT_MOODS: readonly LayoutId[] = ['criterion', 'minimal', 'stub', 'editorial', '35mm', '35mm-landscape'];

/** '커스텀' 항목의 appliesTo — 안에 든 컨트롤(quote 폰트·signature 폰트)의 노출 무드 합집합. */
const CUSTOM_PANEL_MOODS: readonly LayoutId[] = Array.from(new Set([...QUOTE_FONT_MOODS, ...SIGNATURE_FONT_MOODS]));

/**
 * 커스텀 패널(#558·#437) — 무드 전용 커스터마이즈가 모이는 자리. Criterion 한줄평 폰트 +
 * 서명 폰트 둘. 컨트롤별 노출은 각자 무드 표(QUOTE_FONT_MOODS·SIGNATURE_FONT_MOODS)를
 * render 안에서 다시 본다(#523 c1 패턴 — appliesTo는 합집합, 게이팅은 컨트롤 자신).
 *
 * 텍스트 편집은 여기 안 둔다(스펙 c5): 레일은 하단 고정 dock이라 텍스트 인풋을 넣으면 소프트
 * 키보드가 dock을 통째로 덮는다 — 한줄평·서명 문구는 온티켓 탭(FieldTap → InPlaceFieldEditor)이
 * 계속 소유한다.
 *
 * 두 피커가 다 뜨는 무드(지금은 Criterion)는 한 번에 한 축만 그린다(#797) — 후보정·크기와 같은
 * AxisSegment 처방이다. 둘을 세로로 쌓으면 409px(375~414 폭, 320에선 585px)라 슬롯(148~214px)의
 * 두 배를 넘었다. 축으로 나눠도 피커 하나(견본 줄 + 9칩 그리드, 서명만 뜨는 무드에서 217px)가
 * 이미 슬롯보다 커서 넘침이 0이 되진 않는다 — 줄이는 건 스크롤 양이고, 나머지는 슬롯 스크롤
 * 그림자가 잇는다(DesignRail 슬롯 주석). 피커가 하나뿐인 무드는 세그먼트를 안 그린다: 한 칸짜리
 * 축 전환은 죽은 컨트롤이다(SizePanel의 posterAxis 부재 분기와 같은 이유).
 */
const CUSTOM_AXES = [
  { key: 'quote', label: '한줄평' },
  { key: 'signature', label: '서명' },
] as const;
type CustomAxis = (typeof CUSTOM_AXES)[number]['key'];

export function CustomPanel({ photo }: { photo: Photo }) {
  // 무드를 오가도 고른 축을 기억하게 early return보다 위에 둔다(훅 순서 규칙이기도 하다).
  const [axis, setAxis] = useState<CustomAxis>('quote');
  const { components } = photo.state;
  const showQuote = QUOTE_FONT_MOODS.includes(components.layout);
  const showSignature = SIGNATURE_FONT_MOODS.includes(components.layout);
  if (!showQuote && !showSignature) return null;
  // 서명 이미지가 있으면 텍스트 서명 자체가 안 그려지니(#484 우선순위) 피커를 통째로 잠근다.
  // 9택이 되면서 잠금 사유는 이것 하나만 남았다 — 8종 전부 한글 글리프를 갖고 있어 #558의
  // "세리프는 한글에서 잠금"이 사라졌다(그 칩 자체가 없어졌다, QUOTE_FONT_OPTIONS 주석).
  const signatureLocked = !!components.signatureImage;
  const lockAll = QUOTE_FONT_OPTIONS.map((o) => ({ ...o, disabled: true }));
  // 견본 문구(#780) — 빈 값에서도 폰트 차이가 보여야 해서 폴백한다. 한줄평은 빈 값이면 티켓이
  // 영문 기본 문구(별점 문구 포함 전부 라틴)를 그리므로 그 문장을 써야 '자동'이 티켓과 같은
  // 서체(latin)로 풀린다. 서명은 빈 값이면 티켓에 자리표시만 서서 대응 문장이 없으니 한글+영문
  // 견본으로 두 축을 다 보여준다.
  const quoteSample = photo.state.movieInfo.quote?.trim() || DEFAULT_QUOTE;
  const signatureSample = photo.state.movieInfo.signature?.trim() || '영화의 순간 Film';
  const quotePicker = (
    <ChipRadio
      label="한줄평 폰트"
      preview={
        <p
          data-font-preview="quote"
          className="truncate leading-8 text-ink"
          style={userTextFont(quoteSample, components.quoteFont, 22)}
        >
          {quoteSample}
        </p>
      }
      options={QUOTE_FONT_OPTIONS}
      // '자동'은 라벨(한글)이 아니라 실제 문장으로 풀어야 티켓과 같은 서체가 된다 — 라틴 문장이면
      // hand가 아니라 latin(Instrument Serif)으로 간다.
      optionStyle={(font, label) =>
        userTextFont(font === 'auto' ? quoteSample : label, font, CHIP_SAMPLE_BASE_PX)
      }
      value={components.quoteFont ?? 'auto'}
      onChange={(quoteFont) => photo.updateComponents({ quoteFont })}
    />
  );
  const signaturePicker = (
    <ChipRadio
      label="서명 폰트"
      preview={
        signatureLocked ? null : (
          <p
            data-font-preview="signature"
            className="truncate leading-8 text-ink"
            style={userTextFont(signatureSample, components.signatureFont, 22)}
          >
            {signatureSample}
          </p>
        )
      }
      options={signatureLocked ? lockAll : QUOTE_FONT_OPTIONS}
      optionStyle={(font, label) =>
        userTextFont(font === 'auto' ? signatureSample : label, font, CHIP_SAMPLE_BASE_PX)
      }
      value={components.signatureFont ?? 'auto'}
      onChange={(signatureFont) => photo.updateComponents({ signatureFont })}
      note={signatureLocked ? '서명 이미지가 있으면 폰트가 적용되지 않아요.' : undefined}
    />
  );
  if (!showQuote || !showSignature) return showQuote ? quotePicker : signaturePicker;
  // aria-controls와 대상 id는 같은 상수에서 — TexturePanel·SizePanel과 같은 이유.
  const panelId = `${ID_PREFIX}-custom-axis-panel`;
  return (
    <div className="space-y-field">
      <AxisSegment
        ariaLabel="폰트 축"
        panelId={panelId}
        options={CUSTOM_AXES}
        value={axis}
        onChange={(next) => setAxis(next)}
      />
      <div id={panelId} key={axis}>
        {axis === 'quote' ? quotePicker : signaturePicker}
      </div>
    </div>
  );
}

type TextureAxis = 'material' | 'coating';
const TEXTURE_AXES: { key: TextureAxis; label: string; options: readonly { value: string; label: string }[] }[] = [
  { key: 'material', label: '재질', options: MATERIAL_OPTIONS },
  { key: 'coating', label: '코팅', options: COATING_OPTIONS },
];

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
  const prefix = ID_PREFIX;
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
              id={`${prefix}-${target}-scale`}
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
export const BACKGROUND_SCALE_MAX = 1.5;

/**
 * 스탬프 투명도 범위(#728 c4·ac3). 하한 0.2는 완전히 안 보일 정도로 내려가면 "왜 스탬프가
 * 안 보이지"가 되는 반대쪽 함정이라 바닥을 둔다. **새로 올린 이미지의 write-time 기본값**은
 * 이 범위 중간인 0.5 — 고정 박스에 반투명하게 앉아 있는 게 스탬프라는 이번 재설계의 취지를
 * 업로드 즉시 보여준다. 상한 1.0(불투명)은 기존 저장본이 `?? 1`로 읽는 값과 같아, 사용자가
 * 슬라이더를 끝까지 올리면 옛 배경 렌더와 픽셀이 같아진다.
 */
export const BACKGROUND_OPACITY_MIN = 0.2;
export const BACKGROUND_OPACITY_DEFAULT = 0.5;

/** 재질/코팅 도구 본문(#826 S2 D-03) — 피커 + 그 축 강도 슬라이더. 축 전환 세그먼트는 도구 줄이 대신한다. */
function TextureToolBody({ photo, axis }: { photo: Photo; axis: TextureAxis }) {
  return <TextureAxisControls photo={photo} prefix={ID_PREFIX} axis={axis} />;
}

/**
 * 디자인 도구 목록(마스터 D-01~D-05 순서: 무드 · 색상 · 재질 · 코팅 · 투명도 · 크기). 여섯 도구가 전 무드에
 * 존재해 지금은 appliesTo를 든 항목이 없다 — 도구 자체가 숨는 무드가 생기면 그 필드로 걸러진다(#523).
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
    // 잉크색 단일 축(themeColor). disabled는 appliesTo가 아니라 이 클로저가 직접 쥔 TONE_FIXED_MOODS(#524)로
    // 판정한다 — appliesTo에 실으면 filterItemsForMood가 도구 자체를 숨겨 "잠금"이 "숨김"이 된다.
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
  { id: 'material', label: '재질', render: (photo) => <TextureToolBody photo={photo} axis="material" /> },
  { id: 'coating', label: '코팅', render: (photo) => <TextureToolBody photo={photo} axis="coating" /> },
  {
    id: 'opacity',
    label: '투명도',
    render: (photo) => {
      const prefix = ID_PREFIX;
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
          {showStampOpacity && (
            <BrightnessSlider
              label="스탬프 투명도"
              id={`${prefix}-background-opacity`}
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
