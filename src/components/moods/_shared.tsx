import { CSSProperties, Fragment, ReactNode, memo, useMemo } from 'react';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { FIELD_LABELS, STAMP_LABELS, isStampTarget, type SheetTarget } from '@/constants/fields';
import { formatDate } from '@/utils/dateFormat';

export interface MoodProps {
  movieInfo: MovieInfo;
  components: TicketComponents;
  croppedImageUrl: string;
  fieldVisibility?: Record<TicketField, boolean>;
  /**
   * 빈 항목 미리보기(ghost, #216). 세 값의 의미가 다르다:
   * - `undefined`(데스크톱/프롭 미전달): 스탬프 placeholder는 오늘처럼 항상 on, 필드 placeholder는 off → 기존과 픽셀 동일.
   * - `true`(모바일 ghost on): 스탬프 + 빈 필드 placeholder 모두 표시.
   * - `false`(모바일 ghost off / 실제 크기 모드): 모든 placeholder 숨김.
   */
  ghost?: boolean;
  /**
   * 온-티켓 탭 편집(#259) — 모바일 default 줌 전용. 필드/스탬프를 탭하면 그 타깃의 편집 시트를 연다.
   * undefined(데스크톱/캡처 파이프라인)면 FieldTap이 래퍼 없이 통과 → 레이아웃·래스터 픽셀 동일.
   */
  onField?: (field: SheetTarget) => void;
  /** 포스터 영역 탭(#259) → 파일 선택 → 크롭. undefined면 포스터는 비인터랙티브(캡처/데스크톱). */
  onPosterTap?: () => void;
}

/**
 * 온-티켓 필드 탭 래퍼(#259). onField가 없으면(데스크톱/캡처) 래퍼 없이 children을 그대로 통과해
 * 레이아웃·래스터가 완전히 동일하다 — 캡처(ResultPanel의 별도 TicketRenderer)엔 onField가 안 가므로
 * 탭 UI가 산출물에 샐 수 없다. onField가 있으면 display:contents 래퍼로 감싼다: 박스를 만들지 않아
 * 무드의 절대배치·크기에 0 영향이고(포커스링도 그릴 박스가 없어 캡처 유출 원천 차단), 탭만 받는다.
 * stopPropagation으로 포스터 root 탭(onPosterTap)과 겹치지 않게 한다.
 *
 * display:contents는 principal box를 만들지 않아 Tab 포커스를 받을 수 없다(CSS 스펙, 브라우저 공통) —
 * tabIndex/onKeyDown을 얹어도 죽은 코드라 두지 않는다. 클릭(터치·마우스)은 버블링으로, SR 브라우즈
 * 모드 활성화는 role+aria-label+click으로 동작하고, 키보드 Tab 편집 경로는 FieldLauncher가 커버한다
 * (posterTapProps의 pointer-only 입장과 동일).
 */
export function FieldTap({
  field,
  onField,
  children,
}: {
  field: SheetTarget;
  onField?: (field: SheetTarget) => void;
  children: ReactNode;
}) {
  if (!onField) return <>{children}</>;
  const label = isStampTarget(field) ? STAMP_LABELS[field] : FIELD_LABELS[field];
  return (
    <div
      role="button"
      aria-label={`${label} 편집`}
      onClick={(e) => {
        e.stopPropagation();
        onField(field);
      }}
      style={{ display: 'contents' }}
    >
      {children}
    </div>
  );
}

/**
 * 포스터 영역 탭 props(#259). onPosterTap이 있을 때만 onClick+라벨을 얹는다. 풀블리드 무드는 root에,
 * editorial(3열)은 포스터 컬럼에 스프레드한다. role은 생략 — root엔 이미 role=button 필드 자식이 있어
 * 중첩 방지, 포스터 변경은 포인터 제스처(키보드는 FieldLauncher/ImageUploader가 커버). data 속성은
 * 테스트 셀렉터용이며 캡처 렌더러엔 onPosterTap이 안 가 붙지 않는다.
 */
export function posterTapProps(onPosterTap?: () => void) {
  return onPosterTap
    ? { onClick: onPosterTap, 'aria-label': '포스터 변경', 'data-poster-tap': 'true' }
    : {};
}

/**
 * 빈 항목 미리보기(ghost, #216 → #266 PR-A) 판정. ghost 모드가 켜졌을(===true) 때, 필드가
 * (a) 숨김(visible===false)이거나 (b) 값이 비었으면 무드가 해당 슬롯에 자리표시자를 그린다.
 * (a)는 목록 없이 필드를 다시 켜는 유일 경로 — 숨긴 필드가 `+ 라벨` 점선으로 티켓에 떠 탭→재노출(#266).
 * ghost가 undefined(데스크톱)나 false면 항상 false라 신규 placeholder는 등장하지 않는다(데스크톱 픽셀 보존).
 */
export function showFieldGhost(
  visible: boolean | undefined,
  value: unknown,
  ghost: boolean | undefined
): boolean {
  return ghost === true && (visible === false || !value);
}

/**
 * ChainStamp/FormatStamp가 실제로 무언가를 렌더하는지(#216). visible이고, 이미지·라벨이 있거나
 * ghost가 false가 아니라서 placeholder라도 그릴 때 true. 스탬프 사이 구분선은 두 스탬프가 모두
 * 렌더될 때만 그려야 하므로(둘 중 하나라도 null이면 허공에 뜬 구분선이 남음), 무드가 이 헬퍼로
 * 구분선을 게이팅한다. 스탬프 내부의 null 판정과 같은 조건이라 단일 소스로 export.
 */
export function stampWillRender(
  visible: boolean | undefined,
  image: string | undefined,
  label: string | undefined,
  ghost: boolean | undefined
): boolean {
  return visible !== false && (!!image || !!label || ghost !== false);
}

/**
 * Returns `value` when the field is visible (or visibility is undefined), otherwise ''.
 * Falsy values (empty string, null, undefined, false) always return ''.
 *
 * 무드의 `{gateVal && <X/>}` 조건부는 gate가 항상 string을 반환하므로 falsy-0
 * footgun이 없다(빈 문자열 → 렌더 없음). 단, 향후 숫자/0이 가능한 필드를 직접
 * 조건에 쓸 땐 `{num > 0 && ...}` 또는 명시 삼항을 사용할 것(`{0 && <X/>}`는 "0"을 렌더).
 */
export function gate(
  visible: boolean | undefined,
  value: string | false | undefined | null
): string {
  return visible !== false && value ? value : '';
}

export const FONT_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';
export const FONT_SANS = '"Pretendard Variable", "Pretendard", "Noto Sans KR", sans-serif';
// Inter는 한글 글리프가 없어 폴백 시 한글이 시스템 폰트로 어긋남 → 한글 지원 폰트로 교체.
export const FONT_KR = '"Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

/**
 * 장식 전용 디스플레이 세리프(#205). 유저 데이터가 아닌 순수 디자인 문구·큐레이션 라벨에만
 * 쓴다(제목/본문 데이터는 FONT_SANS 유지 — 한글 글리프 + 인쇄 안정성). Instrument Serif는
 * `_app.tsx`에서 next/font로 자체 호스팅하며 `--font-display` CSS 변수로 노출된다(레포 컨벤션:
 * CDN @import 금지). 한글이 없으므로 Georgia/Times 폴백을 두고, 한글에는 절대 쓰지 말 것.
 */
export const FONT_DISPLAY = 'var(--font-display), Georgia, "Times New Roman", serif';

export type Surface = 'paper' | 'dark';

interface ChainStampProps {
  chain: string;
  /** 이미지 없을 때 출력할 텍스트 라벨(#141 (7)). 이미지가 있으면 무시된다. */
  label?: string;
  size?: number;
  surface?: Surface;
  height?: number;
  visible: boolean;
  /** 빈 항목 미리보기(#216). false면 dashed placeholder를 숨긴다. undefined/true면 오늘처럼 표시. */
  ghost?: boolean;
}

const LOGO_SHADOW = 'drop-shadow(0 2px 8px rgba(0,0,0,0.85))';
const TEXT_SHADOW = '0 2px 8px rgba(0,0,0,0.85)';

/**
 * 로고 텍스트 fallback 스탬프(#141 (7)). 이미지가 없고 라벨만 있을 때 브랜드 워드마크처럼
 * 렌더한다. dashed placeholder와 달리 **export에 포함**된다(data-hide-on-export 없음) —
 * 라벨은 사용자가 의도한 실제 콘텐츠이기 때문. 색은 currentColor(무드 잉크)를 따라가고,
 * dark surface(35mm 등 포스터 위)에선 가독성을 위해 text-shadow를 얹는다.
 */
function TextStamp({
  label,
  height,
  size,
  surface,
}: {
  label: string;
  height: number;
  size: number;
  surface: Surface;
}) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        fontSize: Math.round(height * 0.46),
        fontWeight: 800,
        fontFamily: FONT_SANS,
        letterSpacing: 1.5 * size,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        color: 'currentColor',
        lineHeight: 1,
        ...(surface === 'dark' ? { textShadow: TEXT_SHADOW } : {}),
      }}
    >
      {label}
    </div>
  );
}

function DashedPlaceholder({
  text,
  width,
  height,
  size,
  surface,
}: {
  text: string;
  width: number | string;
  height: number;
  size: number;
  surface: Surface;
}) {
  return (
    <div
      data-hide-on-export="true"
      style={{
        height,
        width,
        border: '1px dashed currentColor',
        opacity: 0.4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10 * size,
        fontWeight: 600,
        fontFamily: FONT_MONO,
        letterSpacing: 1,
        color: 'currentColor',
        ...(surface === 'dark' ? { borderColor: 'rgba(255,255,255,0.5)', color: 'rgba(255,255,255,0.7)' } : {}),
      }}
    >
      {text}
    </div>
  );
}

/**
 * 빈 필드 자리표시자(#216). 값이 비었지만 필드가 visible이고 ghost 모드가 켜졌을 때 무드의 해당
 * 슬롯에 그리는 대시 박스. 스탬프의 DashedPlaceholder와 동일한 룩·export 제외(data-hide-on-export)를
 * 공유하되, 필드 슬롯 크기에 맞춰 width/height/size/surface를 받는다. text는 선택(라벨이 이미
 * 위에 있는 메타 셀은 빈 문자열로 두고, 단독 슬롯은 짧은 힌트를 줄 수 있다).
 */
export function FieldGhost({
  text = '',
  width = 140,
  height = 34,
  size = 1,
  surface = 'paper',
}: {
  text?: string;
  width?: number | string;
  height?: number;
  size?: number;
  surface?: Surface;
}) {
  return <DashedPlaceholder text={text} width={width} height={height} size={size} surface={surface} />;
}

export type FieldPieceSpec = {
  field: SheetTarget;
  /** 실값(있으면 텍스트만 — 데스크톱 FieldTap 통과 → 분해 전과 바이트 동일). */
  value?: string;
  /** showFieldGhost 결과 — 비었고 ghost 모드면 라벨 점선 조각을 그린다. */
  ghost?: boolean;
  /** ghost 점선 라벨(THEATER/SCREEN/SEAT/DATE/TIME 등) — 조각이 나란히 서므로 뭐가 뭔지 표시. */
  label: string;
};

/**
 * 병합 셀(여러 필드를 sep으로 이어 붙이던 한 셀)을 필드별 독립 조각으로 분해한다(#266 PR-B/PR-C).
 * 각 조각: 값이 있으면 텍스트만, 비었고 ghost면 라벨 점선(FieldGhost), 아니면 null. present 조각
 * 사이에만 sep을 끼운다(원래 filter(Boolean).join(sep)과 동치). 각 조각은 제 FieldTap을 달아 탭이
 * 자기 시트 타깃을 연다 — 바깥 셀 FieldTap을 없애고 조각을 형제로 배치하므로 이중 중첩 stopPropagation
 * 삼킴이 없다. onField가 없으면(데스크톱/캡처) FieldTap이 통과해 결합 텍스트가 바이트 그대로 보존된다.
 * hasGhost: ghost 조각(블록 FieldGhost)이 실값 텍스트(inline)와 섞였는지 — 무드가 이걸로 값 컨테이너를
 * flex로 감싸 nowrap 한 줄 전제에서 ghost 박스가 줄바꿈돼 어긋나는 걸 막는다(#268 리뷰 P1).
 */
export function fieldPieces(
  specs: FieldPieceSpec[],
  onField: ((field: SheetTarget) => void) | undefined,
  opts?: { sep?: string; surface?: Surface }
): { node: ReactNode; hasGhost: boolean; hasAny: boolean } {
  const sep = opts?.sep ?? ' · ';
  const surface = opts?.surface ?? 'dark';
  const present = specs
    .map((s): { field: SheetTarget; ghost: boolean; node: ReactNode } | null => {
      if (s.value) return { field: s.field, ghost: false, node: s.value };
      if (s.ghost)
        return {
          field: s.field,
          ghost: true,
          node: <FieldGhost text={s.label} width={130} height={30} surface={surface} />,
        };
      return null;
    })
    .filter((x): x is { field: SheetTarget; ghost: boolean; node: ReactNode } => x !== null);

  const node = present.length ? (
    <>
      {present.map((p, i) => (
        <Fragment key={`${p.field}-${i}`}>
          {i > 0 ? sep : null}
          <FieldTap field={p.field} onField={onField}>{p.node}</FieldTap>
        </Fragment>
      ))}
    </>
  ) : null;

  return { node, hasGhost: present.some((p) => p.ghost), hasAny: present.length > 0 };
}

export function ChainStamp({
  chain,
  label,
  size = 1,
  surface = 'paper',
  height = 48,
  visible,
  ghost,
}: ChainStampProps) {
  // null 판정을 stampWillRender로 일원화(무드 구분선 게이팅과 동일 조건). 여기를 통과하면
  // 이미지·라벨·placeholder(ghost!==false) 중 하나는 반드시 렌더된다.
  if (!stampWillRender(visible, chain, label, ghost)) return null;
  const h = height * size;

  // 우선순위: 이미지 > 텍스트 라벨 > dashed placeholder(미리보기 전용, ghost!==false 보장됨).
  if (chain) {
    return (
      <img
        src={chain}
        alt="Theater Chain"
        style={{
          height: h,
          width: 'auto',
          display: 'block',
          ...(surface === 'dark' ? { filter: LOGO_SHADOW } : {}),
        }}
        draggable={false}
      />
    );
  }

  if (label) {
    return <TextStamp label={label} height={h} size={size} surface={surface} />;
  }

  return <DashedPlaceholder text="LOGO" width={120 * size} height={h} size={size} surface={surface} />;
}

interface FormatStampProps {
  format: string;
  /** 이미지 없을 때 출력할 텍스트 라벨(#141 (7)). 이미지가 있으면 무시된다. */
  label?: string;
  size?: number;
  surface?: Surface;
  visible: boolean;
  /** 빈 항목 미리보기(#216). false면 dashed placeholder를 숨긴다. undefined/true면 오늘처럼 표시. */
  ghost?: boolean;
}

export function FormatStamp({
  format,
  label,
  size = 1,
  surface = 'paper',
  visible,
  ghost,
}: FormatStampProps) {
  // null 판정을 stampWillRender로 일원화(무드 구분선 게이팅과 동일 조건). 통과하면
  // 이미지·라벨·placeholder(ghost!==false) 중 하나는 반드시 렌더된다.
  if (!stampWillRender(visible, format, label, ghost)) return null;
  const h = 64 * size;

  // 우선순위: 이미지 > 텍스트 라벨 > dashed placeholder(미리보기 전용, ghost!==false 보장됨).
  if (format) {
    return (
      <img
        src={format}
        alt="Screening Format"
        style={{
          height: h,
          width: 'auto',
          display: 'block',
          ...(surface === 'dark' ? { filter: LOGO_SHADOW } : {}),
        }}
        draggable={false}
      />
    );
  }

  if (label) {
    return <TextStamp label={label} height={h} size={size} surface={surface} />;
  }

  return <DashedPlaceholder text="FORMAT" width={140 * size} height={h} size={size} surface={surface} />;
}

interface PosterProps {
  src: string;
  fit?: 'cover' | 'contain';
  background?: string;
  texture?: string;
  posterOpacity?: number;
}

const PRINT_SIM = 'saturate(0.92) contrast(1.05)';

// vintage/newspaper have intentional contrast curves — no PRINT_SIM stacking
const TEXTURE_FILTERS: Record<string, string> = {
  vintage: 'sepia(0.6) contrast(1.1) brightness(0.9)',
  newspaper: 'grayscale(1) contrast(1.5) brightness(1.2)',
};

// texture별 기본 밝기(#146 확정 b). original/vintage/newspaper는 포스터를 그대로 보여주는
// 룩이라 1.0(원본 밝기), 그 외 가공 텍스처(none·hologram·metal·artpaper·scodix)는 메타
// 가독성을 위해 0.5로 살짝 어둡게 깐다. 사용자가 슬라이더로 직접 조정한 값이 있으면
// usePhototicket이 그 값을 그대로 넘기므로, 이 기본값은 posterOpacity 미지정 시에만 쓰인다.
const FULL_BRIGHTNESS_TEXTURES = new Set(['original', 'vintage', 'newspaper']);

export function defaultBrightnessForTexture(texture: string): number {
  return FULL_BRIGHTNESS_TEXTURES.has(texture) ? 1.0 : 0.5;
}

export function Poster({
  src,
  fit = 'cover',
  background = '#0a0a0a',
  texture = 'original',
  posterOpacity,
}: PosterProps) {
  // 밝기(posterOpacity)를 texture와 분리해 포스터 <img>에 직접 합성한다. 이전엔
  // TextureOverlay의 검은 dim 레이어에서만 적용돼 original/vintage/newspaper에선
  // 밝기 슬라이더가 완전히 무효였다(#139 ①). brightness(x)는 검은색을 multiply로
  // opacity (1-x)만큼 덮은 것과 수학적으로 동치라(final = src*x), 텍스처 dim 룩이
  // 그대로 유지되면서 모든 texture에서 밝기가 동작한다.
  const opacity = posterOpacity ?? defaultBrightnessForTexture(texture);
  const baseFilter = TEXTURE_FILTERS[texture] ?? PRINT_SIM;
  const filter = `${baseFilter} brightness(${opacity})`;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background,
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: fit,
          objectPosition: '50% 50%',
          filter,
        }}
        draggable={false}
        crossOrigin="anonymous"
      />
      {texture && texture !== 'original' && <TextureOverlay texture={texture} />}
    </div>
  );
}

// 텍스처별 sheen(하이라이트) 오버레이만 담당한다. dim(밝기)은 Poster의 <img> filter로
// 분리됐으므로 여기선 검은 레이어를 두지 않는다(#139 ①).
function TextureOverlay({ texture }: { texture: string }) {
  if (texture === 'original' || texture === 'vintage' || texture === 'newspaper') {
    return null;
  }

  const overlays: Record<string, CSSProperties> = {
    none: {
      background:
        'linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.06) 70%, rgba(255,255,255,0) 100%)',
      mixBlendMode: 'screen',
    },
    hologram: {
      background:
        'linear-gradient(135deg, rgba(255,182,193,0.32) 0%, rgba(255,223,186,0.32) 20%, rgba(255,255,186,0.32) 40%, rgba(186,255,201,0.32) 60%, rgba(186,225,255,0.32) 80%, rgba(216,191,216,0.32) 100%)',
      mixBlendMode: 'color-dodge',
    },
    metal: {
      background:
        'linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(180,190,200,0.1) 30%, rgba(255,255,255,0.55) 50%, rgba(100,110,120,0.1) 70%, rgba(30,40,50,0.35) 100%)',
      mixBlendMode: 'hard-light',
    },
    artpaper: {
      background:
        'repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0 2px, rgba(255,255,255,0.04) 2px 4px)',
      mixBlendMode: 'multiply',
    },
    scodix: {
      background:
        'linear-gradient(135deg, rgba(255,255,255,0) 40%, rgba(0,0,0,0.12) 45%, rgba(255,255,255,0.65) 50%, rgba(255,255,255,0) 55%)',
      mixBlendMode: 'overlay',
    },
  };

  const style = overlays[texture];
  if (!style) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}

interface BarcodeProps {
  value?: string;
  color?: string;
  height?: number;
  width?: number;
  orientation?: 'horizontal' | 'vertical';
  showText?: boolean;
  textSize?: number;
}

type Bar = { ink: boolean; w: number };

// Code 128 심볼 패턴(6모듈 = bar,space,bar,space,bar,space, 합 11) 서브셋. 실제 바코드의
// 균형 잡힌 밀도감을 재현해 "가짜 랜덤 막대" 느낌을 없앤다(#205 바코드 재설계).
const C128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
];
const C128_START = '211214'; // Start-B 가이드
const C128_STOP = '2331112'; // Stop 가이드(7모듈, bar로 끝)

function buildBarcodeWidths(value: string): Bar[] {
  const v = value || 'PT-000000-0000';
  let seq = C128_START;
  for (let i = 0; i < v.length; i++) {
    seq += C128_PATTERNS[v.charCodeAt(i) % C128_PATTERNS.length];
  }
  seq += C128_STOP;
  const widths: Bar[] = [];
  let ink = true; // 시퀀스는 항상 bar로 시작→space 교차
  for (let i = 0; i < seq.length; i++) {
    widths.push({ ink, w: parseInt(seq[i], 10) });
    ink = !ink;
  }
  return widths;
}

export const Barcode = memo(function Barcode({
  value = 'PT-000000-0000',
  color = 'currentColor',
  height = 80,
  width = 360,
  orientation = 'horizontal',
  showText = true,
  textSize = 11,
}: BarcodeProps) {
  const widths = useMemo(() => buildBarcodeWidths(value), [value]);

  const bars = useMemo(() => {
    const totalUnits = widths.reduce((a, b) => a + b.w, 0);
    const QUIET = 6;
    const longSide = orientation === 'horizontal' ? width : height;
    const shortSide = orientation === 'horizontal' ? height : width;
    const unit = longSide / (totalUnits + QUIET * 2);
    let cursor = QUIET * unit;

    return widths.map((b, i) => {
      const x = cursor;
      cursor += b.w * unit;
      if (!b.ink) return null;
      const dims =
        orientation === 'horizontal'
          ? { x, y: 0, width: Math.max(b.w * unit, 0.5), height: shortSide }
          : { x: 0, y: x, width: shortSide, height: Math.max(b.w * unit, 0.5) };
      return <rect key={i} {...dims} fill={color} />;
    });
  }, [widths, orientation, width, height, color]);

  const shortSide = orientation === 'horizontal' ? height : width;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: orientation === 'horizontal' ? 'column' : 'row',
        alignItems: orientation === 'horizontal' ? 'flex-start' : 'flex-end',
        gap: Math.max(textSize * 0.5, 6),
      }}
    >
      <svg
        width={orientation === 'horizontal' ? width : shortSide}
        height={orientation === 'horizontal' ? shortSide : height}
        viewBox={
          orientation === 'horizontal'
            ? `0 0 ${width} ${shortSide}`
            : `0 0 ${shortSide} ${height}`
        }
        style={{ display: 'block' }}
        shapeRendering="crispEdges"
      >
        {bars}
      </svg>
      {showText && (
        <span
          style={{
            fontWeight: 600,
            fontSize: textSize,
            fontFamily: FONT_MONO,
            color,
            letterSpacing: textSize * 0.18,
            whiteSpace: 'nowrap',
            writingMode: orientation === 'horizontal' ? 'horizontal-tb' : 'vertical-rl',
            ...(orientation === 'vertical' ? { transform: 'rotate(180deg)' } : {}),
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
});

export const HorizontalSprockets = memo(function HorizontalSprockets({
  count = 14,
  height = 64,
  base = '#0a0a0a',
  hole = '#f6f1e4',
}: {
  count?: number;
  height?: number;
  base?: string;
  hole?: string;
}) {
  // 무드 리렌더 시 count·hole이 고정이면 배열 재생성 안 함
  const holes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            width: 50,
            height: 38,
            borderRadius: 2,
            background: hole,
            flexShrink: 0,
          }}
        />
      )),
    [count, hole]
  );
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 18px',
        height,
        background: base,
      }}
    >
      {holes}
    </div>
  );
});

export const PerforationStrip = memo(function PerforationStrip({
  vertical = true,
  count = 30,
  color = '#1a1612',
  background = 'transparent',
}: {
  vertical?: boolean;
  count?: number;
  color?: string;
  background?: string;
}) {
  // 무드 리렌더 시 count·color가 고정이면 dot 배열 재생성 안 함
  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: color,
            opacity: 0.55,
          }}
        />
      )),
    [count, color]
  );
  return (
    <div
      style={{
        position: 'absolute',
        background,
        ...(vertical
          ? {
              left: 0,
              top: 0,
              bottom: 0,
              width: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-around',
            }
          : {
              left: 0,
              right: 0,
              top: 0,
              height: 14,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-around',
            }),
      }}
    >
      {dots}
    </div>
  );
});

export function seedFromString(s: string): number {
  let h = 0x9e3779b9 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x85ebca6b) >>> 0;
  }
  return h;
}

const CURRENT_YEAR = new Date().getFullYear();

export function fallbackBookingNumber(seed: string): string {
  const tail = String(seedFromString(seed) % 10000).padStart(4, '0');
  return `PT-${CURRENT_YEAR}-${tail}`;
}

export function resolveBookingNo(d: MovieInfo): string {
  return d.bookingNumber || fallbackBookingNumber(d.title || 'phototicket');
}

/**
 * 4종 무드가 공통으로 파생하던 티켓 데이터를 한 곳으로 모은 것.
 * 신규 무드는 `const { ... } = resolveTicketData(d)` 한 줄로 동일 파생값을 얻는다.
 *
 * watchYear는 watchDate가 정규화된 YYYY-MM-DD 형식이므로 `slice(0,4)`로 통일
 * (이전 MoodCriterion의 `match(/\d{4}/)`와 ISO 입력에서 결과 동일).
 */
export function resolveTicketData(d: MovieInfo) {
  const watchToken = d.watchDateFormat || 'kr-compact';
  const releaseToken = d.releaseDateFormat || 'kr-compact';
  const releaseGran = d.releaseDateGranularity || 'date';
  return {
    bookingNo: resolveBookingNo(d),
    watchDateClean: formatDate(d.watchDate, watchToken, 'date'),
    releaseClean: formatDate(d.releaseDate, releaseToken, releaseGran),
    reissueClean: d.isReissue ? formatDate(d.reissueDate, releaseToken, releaseGran) : '',
    watchYear: d.watchDate ? d.watchDate.slice(0, 4) : '',
  };
}

export function pickTitleSize(len: number, sizes: [number, number, number, number]): number {
  if (len <= 6) return sizes[0];
  if (len <= 10) return sizes[1];
  if (len <= 14) return sizes[2];
  return sizes[3];
}

export function luminance(hex: string): number {
  const c = hex.replace('#', '').padEnd(6, '0');
  const toLinear = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const r = toLinear(parseInt(c.slice(0, 2), 16) / 255);
  const g = toLinear(parseInt(c.slice(2, 4), 16) / 255);
  const b = toLinear(parseInt(c.slice(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 선택된 잉크(themeColor)가 어두운지 판정한다(luminance < 0.18).
 * true면 무드는 어두운 잉크가 읽히도록 밝은(크림) 표면 톤으로 스냅한다.
 * (이전 이름 `isInkLight`는 실제 반환 의미와 반대라 #147에서 바로잡음.)
 */
export function isInkDark(themeColor: string): boolean {
  return luminance(themeColor) < 0.18;
}

/**
 * 잉크 색을 안전하게 해석한다 — 완전한 6자리 hex만 통과하고, 부분 입력(`#8E` 등)은
 * fallback으로 떨군다. ColorPicker 텍스트 필드는 타이핑/삭제 중 `'#8'`·`'#8E4E6'` 같은
 * 불완전 hex도 emit하는데, 그게 잉크로 새면 `color:'#8E'`가 무효 CSS라 텍스트가 순간
 * 투명해진다(#177 리뷰 P1). 유효 hex는 그대로, 불완전 hex는 fallback으로 가독성을 지킨다.
 */
export function resolveInk(themeColor: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : fallback;
}

export function truncateActors(actors: string, max = 3): string {
  if (!actors) return '';
  const parts = actors.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length <= max) return parts.join(', ');
  return `${parts.slice(0, max).join(', ')} 외 ${parts.length - max}명`;
}
