import { CSSProperties, Fragment, ReactNode, memo, useEffect, useMemo, useRef, useState } from 'react';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { FIELD_LABELS, STAMP_LABELS, isStampTarget, type SheetTarget } from '@/constants/fields';
import { formatDate } from '@/utils/dateFormat';
import { posterContainRect, posterFeatherMask } from '@/utils/posterFeather';
import { TEXTURE_RECIPES, recipeToGradientCss, isNoiseRecipe, noiseTileSvg } from '@/utils/textureRecipes';
import { EyeIcon } from '@/components/ui/VisibilityCheckbox';

export interface MoodProps {
  movieInfo: MovieInfo;
  components: TicketComponents;
  croppedImageUrl: string;
  fieldVisibility?: Record<TicketField, boolean>;
  /**
   * 빈 항목 미리보기(ghost, #216). 세 값의 의미가 다르다:
   * - `undefined`(데스크톱/프롭 미전달): 스탬프 placeholder는 오늘처럼 항상 on, 필드 placeholder는 off → 기존과 픽셀 동일.
   * - `true`(모바일 ghost on): 스탬프 + 빈 필드 placeholder 모두 표시.
   * - `false`(모바일 ghost off): 모든 placeholder 숨김.
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
 * 모드 활성화는 role+aria-label+click으로 동작한다. 온-티켓 편집은 포인터 전용이며(posterTapProps와
 * 동일 입장), 키보드 Tab 전용 필드 편집 목록은 #266에서 의도적으로 제거됐다(실사용 후 필요하면 재도입).
 *
 * data-field-tap(#354): 인플레이스 에디터의 측정 앵커. display:contents 래퍼 자신은 박스가 없어
 * getBoundingClientRect()가 0을 반환하므로, 에디터는 이 속성으로 래퍼를 찾은 뒤 firstElementChild
 * (실제 레이아웃 박스를 가진 노드)를 측정한다 — 박스를 벗기지 않아 캡처 계약이 유지된다.
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
      data-field-tap={field}
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
 * editorial(다열)은 포스터 컬럼에 스프레드한다. role은 생략 — root엔 이미 role=button 필드 자식이 있어
 * 중첩 방지, 포스터 변경은 포인터 제스처(키보드 업로드 경로는 ImageUploader가 커버). data 속성은
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
 *
 * 반환은 boolean 대신 상태 객체(#369) — 노출 off(dim)와 값 존재(hasValue)를 실어 나르면 무드가
 * `<FieldGhost state={g}/>`로 넘기는 것만으로 4칸(값×노출)이 전부 다른 시각으로 그려진다:
 * 없음+on 점선 / 없음+off 흐린 점선+eye-off / 있음+off 흐린 점선+eye-off+점 배지 / 있음+on 실값.
 * truthiness는 기존과 동일해(`g ? ... : null`) 분기 코드는 그대로다.
 */
export type FieldGhostState = { dim: boolean; hasValue: boolean } | false;

export function showFieldGhost(
  visible: boolean | undefined,
  value: unknown,
  ghost: boolean | undefined
): FieldGhostState {
  if (!(ghost === true && (visible === false || !value))) return false;
  return { dim: visible === false, hasValue: !!value };
}

/**
 * ChainStamp/FormatStamp가 실제로 무언가를 렌더하는지(#216). visible이고, 이미지·라벨이 있거나
 * ghost가 false가 아니라서 placeholder라도 그릴 때 true. 스탬프 사이 구분선은 두 스탬프가 모두
 * 렌더될 때만 그려야 하므로(둘 중 하나라도 null이면 허공에 뜬 구분선이 남음), 무드가 이 헬퍼로
 * 구분선을 게이팅한다. 스탬프 내부의 null 판정과 같은 조건이라 단일 소스로 export.
 *
 * 노출 off도 모바일 ghost 모드(===true)에선 흐린 placeholder를 그린다(#369) — 필드의
 * showFieldGhost와 같은 매트릭스로, 탭→재노출 경로(#266)가 스탬프에도 성립한다. ghost가
 * undefined(데스크톱)면 기존과 동일하게 숨김 스탬프는 아무것도 안 그린다(픽셀 보존).
 */
export function stampWillRender(
  visible: boolean | undefined,
  image: string | undefined,
  label: string | undefined,
  ghost: boolean | undefined
): boolean {
  if (visible === false) return ghost === true;
  return !!image || !!label || ghost !== false;
}

/**
 * 로고 스탬프 폭 상한 = 높이 × 5 (#347). 크롭이 자유 종횡비로 풀리면서(ImageCropModal) 극단적으로
 * 긴 워드마크가 그대로 올라올 수 있는데, 스탬프 그룹엔 maxWidth 제약이 없어 티켓 경계를 넘거나 옆
 * 텍스트와 겹친다. 폭만 상한을 두고 objectFit:contain으로 종횡비를 유지한 채 축소한다.
 * 5:1은 실제 극장/포맷 워드마크(CGV·메가박스·IMAX 등)를 안 건드리면서, 가장 좁은 무드(Stub, 체인
 * 높이 39·포맷 38)에서도 두 스탬프 + 구분선이 티켓 폭 960 안에 들어오는 선.
 */
export const STAMP_MAX_ASPECT = 5;

/**
 * 로고 스탬프 높이 소폭 동적화(#392, ±16px cap). 완전 가변화는 6무드 전체의 스탬프-인접 요소 정렬을
 * 흔들어 이 저장소에 이미 두 차례 있었던 "레이아웃 구조 변경 → 예상 못 한 회귀"(#275 트리 depth
 * remount, #258 조건부 unmount state 손실) 카테고리를 다시 밟을 수 있다는 게 전문가 패널 결론이라,
 * DOM 트리는 그대로 두고 height 계산값만 좁은 range에서 보정한다.
 *
 * REF_ASPECT(2)는 "실사용 로고 대부분은 정사각~가로형"이라는 추정 기준점(가로 워드마크 로고의
 * 전형적 종횡비) — 이 근방(가로형)은 delta≈0으로 기존 고정 높이를 그대로 쓰고, 세로로 긴 로고일수록
 * +16px 쪽으로, 극단적으로 가로로 긴 로고는 -16px 쪽으로 선형 보정한다. 미로드(aspect=null)는 0(기존과
 * 동일 높이) — 로드 전 첫 페인트가 보정 후 값으로 튀지 않게 한다.
 */
const STAMP_HEIGHT_DELTA_CAP = 16;
const STAMP_REF_ASPECT = 2;

export function stampHeightDelta(aspect: number | null): number {
  if (aspect === null) return 0;
  const raw = (STAMP_REF_ASPECT - aspect) * 8;
  return Math.min(STAMP_HEIGHT_DELTA_CAP, Math.max(-STAMP_HEIGHT_DELTA_CAP, raw));
}

/**
 * 이미지 자연 종횡비(width/height) — 로드 전/실패/빈 src는 null(#392, 스탬프 높이 보정 입력).
 * `active=false`면 로드 자체를 생략한다(스탬프가 화면에 전혀 안 그려지는 상태에서의 낭비 로드
 * 방지, #190 nit).
 */
function useNaturalAspect(src: string, active: boolean = true): number | null {
  const [aspect, setAspect] = useState<number | null>(null);
  useEffect(() => {
    // src/active가 바뀔 때마다 이전 값부터 폐기 — 새 로드가 끝나기 전까지 stale aspect로
    // 렌더되는 걸 막는다(로고 교체 시 이전 높이가 잠깐 유지되던 #190 nit).
    setAspect(null);
    if (!active || !src) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, active]);
  return aspect;
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
 * 35mm 필름 스트립 엣지 텍스트(FilmStripBand) 전용 기술 모노 폰트(#443, 이전 DSEG7 7-세그먼트 LCD
 * 폰트는 아날로그 필름 엣지 인쇄 톤과 안 맞아 교체). Share Tech Mono(OFL, Google Fonts)로 자체
 * 호스팅(`_app.tsx` → `--font-lcd`). ASCII 전용이라 ◆·★ 등 심볼과 한글은 이 폰트에 글리프가
 * 없다 — 심볼은 폴백 체인(JetBrains Mono)이 글리프 단위로 알아서 대체하지만, 한글 "단어" 전체가
 * 이 폴백에 걸리면 자모가 깨져 보일 수 있어 FilmStripBand는 code 단위로 containsHangul을 먼저
 * 검사해 FONT_KR로 명시 폴백한다(암묵적 글리프 폴백에 기대지 않음).
 */
export const FONT_LCD = 'var(--font-lcd), "JetBrains Mono", "SF Mono", ui-monospace, monospace';

/**
 * 장식 전용 디스플레이 세리프(#205). 유저 데이터가 아닌 순수 디자인 문구·큐레이션 라벨에만
 * 쓴다(제목/본문 데이터는 FONT_SANS 유지 — 한글 글리프 + 인쇄 안정성). Instrument Serif는
 * `_app.tsx`에서 next/font로 자체 호스팅하며 `--font-display` CSS 변수로 노출된다(레포 컨벤션:
 * CDN @import 금지). 한글이 없으므로 Georgia/Times 폴백을 두고, 한글에는 절대 쓰지 말 것.
 */
export const FONT_DISPLAY = 'var(--font-display), Georgia, "Times New Roman", serif';

// BI 마스터 v2 로고타입 전용 브랜드 타입(Nunito 900) — `_app.tsx`에서 next/font로 자체 호스팅하며
// `--font-brand` CSS 변수로 노출(#386). 워드마크 외 용도 금지(브랜드 아이덴티티 폰트).
export const FONT_BRAND = 'var(--font-brand), Nunito, sans-serif';

/**
 * Criterion 한줄평(#391)·서명(#423) 유저 입력 전용 손글씨 폰트 — FONT_DISPLAY(Instrument Serif)는
 * 한글 글리프가 없어(위 경고 참고) 한글로 쓴 값은 이걸로 분기한다. `_app.tsx`에서 next/font/local로
 * "아이스자람체"(인천교육서체, 눈누 무료·웹폰트 임베딩 허용)를 자체 호스팅해 `--font-quote-kr`로 노출.
 * 프리셋/기본 quote는 항상 영문이라 FONT_DISPLAY 유지. 시스템에 없는 커스텀 폰트라 폴백은 generic만.
 */
export const FONT_QUOTE_KR = 'var(--font-quote-kr), cursive';

/** 한글(자모·호환 자모·완성형) 포함 여부 — 한줄평 폰트 분기(FONT_QUOTE_KR vs FONT_DISPLAY)에 사용. */
export function containsHangul(text: string): boolean {
  return /[ᄀ-ᇿ㄰-㆏가-힣]/.test(text);
}

/**
 * BI 마스터 v2 워드마크(`v2/Wordmark.tsx`)의 무드-세이프 포팅(#386). 캡처 파이프라인은 전부 inline
 * style이라 Tailwind className(`text-accent` 등)을 못 쓰므로, dotless-i + 색은 prop으로 받는다.
 * `accent` 생략 시 기존처럼 전체 단색(무드 잉크) 유지 — 전달하면 "me" + dot tittle만 그 색으로 칠해
 * 실제 로고(`l<span className="text-accent">me</span>`)와 같은 포인트 컬러를 얹는다(#446).
 */
export function MoodWordmark({ size, color, accent }: { size: number; color: string; accent?: string }) {
  const meColor = accent ?? color;
  return (
    <span
      aria-label="FILME"
      style={{ display: 'inline-flex', alignItems: 'baseline', fontFamily: FONT_BRAND, fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: '-0.012em', color, whiteSpace: 'nowrap' }}
    >
      f
      <span style={{ position: 'relative', display: 'inline-block' }}>
        ı
        <span style={{ position: 'absolute', left: '50%', bottom: '0.72em', width: '0.2em', height: '0.2em', transform: 'translateX(-50%)', borderRadius: 9999, background: meColor }} />
      </span>
      l<span style={{ color: meColor }}>me</span>
    </span>
  );
}

/** "me" 포인트 컬러 — globals.css `--accent` 라이트값 고정(#446). 캡처가 정적 이미지라 다크모드
 * 분기가 무의미해 라이트 값 하나로 고정(다크 값 `--accent:#C45550`는 UI chrome 전용, 티켓엔 안 씀). */
export const WORDMARK_ACCENT = '#B0423F';

export type Surface = 'paper' | 'dark';

interface ChainStampProps {
  chain: string;
  /** 이미지 없을 때 출력할 텍스트 라벨(#141 (7)). 이미지가 있으면 무시된다. */
  label?: string;
  size?: number;
  /** 사용자 조작 크기 배율 0.6~1.3(기본 1) — 무드 고정 size와 곱연산 결합(#441). */
  scale?: number;
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
  dim = false,
  hasValue = false,
}: {
  text: string;
  width: number | string;
  height: number;
  size: number;
  surface: Surface;
  /** 노출이 명시적으로 꺼진 필드(#369) — 더 흐린 톤 + eye-off로 "빈 필드"(dim=false)와 구분. */
  dim?: boolean;
  /** dim이면서 값이 있음(#369) — accent 점 배지로 "값이 있는데 숨김"을 암시(값 자체는 노출 안 함). */
  hasValue?: boolean;
}) {
  // 고스트 시인성 개선(#313): 박스 opacity(0.4)가 테두리·텍스트 색의 자체 알파와 곱연산으로 겹쳐
  // dark surface에서 실효 알파가 테두리 0.2·텍스트 0.28까지 떨어졌었다. 박스 opacity를 0.65로 올리고
  // (paper: currentColor 알파 1 × 0.65 = 0.65), dark 오버라이드의 자체 알파도 함께 올려(0.5→0.85,
  // 0.7→0.95) 곱연산 후 실효 알파가 테두리 ~0.55·텍스트 ~0.62로 나오게 재배분했다.
  // dim(#369)은 새 색을 만들지 않고 같은 값들의 알파만 낮춘다(0.65→0.3, 0.85→0.35, 0.95→0.45).
  return (
    <div
      data-hide-on-export="true"
      data-ghost-dim={dim || undefined}
      style={{
        height,
        width,
        border: '1px dashed currentColor',
        opacity: dim ? 0.3 : 0.65,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5 * size,
        fontSize: 10 * size,
        fontWeight: 600,
        fontFamily: FONT_MONO,
        letterSpacing: 1,
        color: 'currentColor',
        ...(surface === 'dark'
          ? dim
            ? { borderColor: 'rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.45)' }
            : { borderColor: 'rgba(255,255,255,0.85)', color: 'rgba(255,255,255,0.95)' }
          : {}),
      }}
    >
      {dim && <EyeIcon open={false} size={12 * size} />}
      {text}
      {dim && hasValue && (
        <span
          aria-hidden="true"
          style={{ width: 5 * size, height: 5 * size, borderRadius: 999, background: 'var(--accent)', flexShrink: 0 }}
        />
      )}
    </div>
  );
}

/**
 * 빈 필드 자리표시자(#216). 값이 비었지만 필드가 visible이고 ghost 모드가 켜졌을 때 무드의 해당
 * 슬롯에 그리는 대시 박스. 스탬프의 DashedPlaceholder와 동일한 룩·export 제외(data-hide-on-export)를
 * 공유하되, 필드 슬롯 크기에 맞춰 width/height/size/surface를 받는다. text는 선택(라벨이 이미
 * 위에 있는 메타 셀은 빈 문자열로 두고, 단독 슬롯은 짧은 힌트를 줄 수 있다).
 *
 * state(#369) — showFieldGhost의 반환을 그대로 받아 노출 off(dim)·값 존재(hasValue) 시각을
 * 얹는다. 생략(레거시 boolean 분기)이면 기존 "빈 필드" 룩 그대로.
 */
export function FieldGhost({
  text = '',
  width = 140,
  height = 34,
  size = 1,
  surface = 'paper',
  state,
}: {
  text?: string;
  width?: number | string;
  height?: number;
  size?: number;
  surface?: Surface;
  state?: FieldGhostState;
}) {
  return (
    <DashedPlaceholder
      text={text}
      width={width}
      height={height}
      size={size}
      surface={surface}
      dim={state ? state.dim : false}
      hasValue={state ? state.hasValue : false}
    />
  );
}

export type FieldPieceSpec = {
  field: SheetTarget;
  /** 실값(있으면 텍스트만 — 데스크톱 FieldTap 통과 → 분해 전과 바이트 동일). */
  value?: string;
  /** showFieldGhost 결과 — 비었고 ghost 모드면 라벨 점선 조각을 그린다(dim/hasValue도 전달, #369). */
  ghost?: FieldGhostState;
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
          node: <FieldGhost text={s.label} width={130} height={30} surface={surface} state={s.ghost} />,
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
  scale = 1,
  surface = 'paper',
  height = 48,
  visible,
  ghost,
}: ChainStampProps) {
  // Rules of Hooks — stampWillRender의 조기 return보다 앞에서 무조건 호출(#392).
  // 결과(willRender)를 그대로 로드 여부에도 재사용 — 완전 비노출(null 렌더)이면 로드 자체를 생략한다(#190 nit).
  const willRender = stampWillRender(visible, chain, label, ghost);
  const aspect = useNaturalAspect(chain, willRender);
  // null 판정을 stampWillRender로 일원화(무드 구분선 게이팅과 동일 조건). 여기를 통과하면
  // 이미지·라벨·placeholder(ghost!==false) 중 하나는 반드시 렌더된다.
  if (!willRender) return null;
  // 무드 고정 size(디자인 상수)와 사용자 조작 scale(#441)을 분리해 받되, 실제 렌더 계산은
  // 곱연산 결합값 하나로 통일 — 아래 h·placeholder·라벨이 전부 같은 비율로 스케일된다.
  const scaledSize = size * scale;
  // delta도 스케일 — 아니면 size가 작은 무드(Stub·Editorial)에서 ±16px가 base height 대비
  // 훨씬 큰 상대 변화를 만들어 이 PR이 피하려는 회귀 카테고리를 좁은 size에서 재현한다(claude-review
  // PR #408 P1, 2차 라운드).
  const h = (height + stampHeightDelta(aspect)) * scaledSize;

  // 노출 off(#369) — 여기 도달했으면 ghost===true(stampWillRender 계약). 이미지·라벨이 있어도
  // 노출하지 않고 흐린 placeholder + 값 존재 배지로만 암시한다(탭→재노출 #266 유지).
  if (visible === false) {
    return <DashedPlaceholder text="LOGO" width={120 * scaledSize} height={h} size={scaledSize} surface={surface} dim hasValue={!!(chain || label)} />;
  }

  // 우선순위: 이미지 > 텍스트 라벨 > dashed placeholder(미리보기 전용, ghost!==false 보장됨).
  if (chain) {
    return (
      <img
        src={chain}
        alt="Theater Chain"
        style={{
          height: h,
          width: 'auto',
          maxWidth: h * STAMP_MAX_ASPECT,
          objectFit: 'contain', // 상한에 걸리면 잘리지 말고 종횡비 유지한 채 축소
          display: 'block',
          ...(surface === 'dark' ? { filter: LOGO_SHADOW } : {}),
        }}
        draggable={false}
        crossOrigin="anonymous"
      />
    );
  }

  if (label) {
    return <TextStamp label={label} height={h} size={scaledSize} surface={surface} />;
  }

  return <DashedPlaceholder text="LOGO" width={120 * scaledSize} height={h} size={scaledSize} surface={surface} />;
}

interface FormatStampProps {
  format: string;
  /** 이미지 없을 때 출력할 텍스트 라벨(#141 (7)). 이미지가 있으면 무시된다. */
  label?: string;
  size?: number;
  /** 사용자 조작 크기 배율 0.6~1.3(기본 1) — 무드 고정 size와 곱연산 결합(#441). */
  scale?: number;
  surface?: Surface;
  visible: boolean;
  /** 빈 항목 미리보기(#216). false면 dashed placeholder를 숨긴다. undefined/true면 오늘처럼 표시. */
  ghost?: boolean;
}

export function FormatStamp({
  format,
  label,
  size = 1,
  scale = 1,
  surface = 'paper',
  visible,
  ghost,
}: FormatStampProps) {
  // Rules of Hooks — stampWillRender의 조기 return보다 앞에서 무조건 호출(#392).
  // 결과(willRender)를 그대로 로드 여부에도 재사용 — 완전 비노출(null 렌더)이면 로드 자체를 생략한다(#190 nit).
  const willRender = stampWillRender(visible, format, label, ghost);
  const aspect = useNaturalAspect(format, willRender);
  // null 판정을 stampWillRender로 일원화(무드 구분선 게이팅과 동일 조건). 통과하면
  // 이미지·라벨·placeholder(ghost!==false) 중 하나는 반드시 렌더된다.
  if (!willRender) return null;
  // ChainStamp와 동일 — 무드 고정 size와 사용자 scale(#441)을 곱연산 결합값 하나로 통일.
  const scaledSize = size * scale;
  // delta도 스케일 — ChainStamp와 동일 이유(claude-review PR #408 P1, 2차 라운드).
  const h = (64 + stampHeightDelta(aspect)) * scaledSize;

  // 노출 off(#369) — ChainStamp와 동일: 값이 있어도 흐린 placeholder + 배지로만 암시.
  if (visible === false) {
    return <DashedPlaceholder text="FORMAT" width={140 * scaledSize} height={h} size={scaledSize} surface={surface} dim hasValue={!!(format || label)} />;
  }

  // 우선순위: 이미지 > 텍스트 라벨 > dashed placeholder(미리보기 전용, ghost!==false 보장됨).
  if (format) {
    return (
      <img
        src={format}
        alt="Screening Format"
        style={{
          height: h,
          width: 'auto',
          maxWidth: h * STAMP_MAX_ASPECT,
          objectFit: 'contain', // 상한에 걸리면 잘리지 말고 종횡비 유지한 채 축소
          display: 'block',
          ...(surface === 'dark' ? { filter: LOGO_SHADOW } : {}),
        }}
        draggable={false}
        crossOrigin="anonymous"
      />
    );
  }

  if (label) {
    return <TextStamp label={label} height={h} size={scaledSize} surface={surface} />;
  }

  return <DashedPlaceholder text="FORMAT" width={140 * scaledSize} height={h} size={scaledSize} surface={surface} />;
}

interface PosterProps {
  src: string;
  fit?: 'cover' | 'contain';
  background?: string;
  /** 재질 축(#475) — 'original'|'artpaper'|'vintage'|'newspaper'. 포스터 CSS filter(색) + 결 오버레이(아래)를 만든다. */
  material?: string;
  /** 재질 결 오버레이 강도 0..1(#434/#475) — TextureOverlay(재질)로 관통. 미지정 시 1(강도 100%). */
  materialIntensity?: number;
  /** 코팅 축(#475) — 'none'|'gloss'|'hologram'|'metal'|'scodix'. 재질 최종색 위에 얹는 광택 오버레이(위). */
  coating?: string;
  /** 코팅 광택 오버레이 강도 0..1(#475) — TextureOverlay(코팅)로 관통. 미지정 시 1(강도 100%). */
  coatingIntensity?: number;
  posterOpacity?: number;
  /** contain일 때 정렬(#420 원본 비율 보존 프리셋) — 'top'은 포스터 상단을 캔버스 상단에 붙인다. 기본 중앙. */
  align?: 'center' | 'top';
  /**
   * contain일 때 선명 포스터 이미지를 위/아래로 이만큼 안쪽에 둬 블러 레터박스 노출을
   * 최소 이 폭만큼 보장한다(#449). 소스 포스터가 캔버스와 종횡비가 정확히 같아 자연 레터박스가
   * 0이 되는 경우(무손실 크롭 기본 경로)에도 매트 프레임처럼 일정한 블러 띠가 보이게 하는 장치 —
   * blur 배경(data-poster-bg)은 이 인셋과 무관하게 항상 inset:0으로 캔버스 전체를 채운다.
   */
  frameInsetY?: number;
  /**
   * 상단 레터박스 밴드 실측 높이(frameInsetY + 자연비율 여백, px) 리포트 콜백(#461). Poster 내부의
   * boxSize/natAspect 측정 결과를 무드가 그대로 재사용해 밴드 구간에만 톤 정합 오버레이를 얹을 수
   * 있게 한다 — 무드가 같은 측정을 중복 구현하지 않도록. contain+중앙 정렬이 아니면(또는 측정 전)
   * 0을 리포트한다. 상단만 리포트(align='top'이면 레터박스가 전부 하단이라 0).
   */
  onTopBandHeight?: (px: number) => void;
}

/**
 * 풀블리드 contain 무드(Minimal·Criterion·35mm) 공통 frameInsetY 값(#449 claude-review P2) —
 * 세 무드가 각자 22를 하드코딩하던 걸 단일 소스로. 20~25px 블러 레터박스 노출 목표의 중간값.
 */
export const POSTER_FRAME_INSET_Y = 22;

/**
 * 포스터 레터박스(contain 여백) 기본 배경색 — Editorial·35mm Wide·Stub이 posterFitProps의
 * letterboxBg로 각자 하드코딩하던 '#0a0a0a' 리터럴을 단일 소스로(nit letterbox-bg-literal-dup).
 */
export const POSTER_LETTERBOX_BG = '#0a0a0a';

const PRINT_SIM = 'saturate(0.92) contrast(1.05)';

// vintage/newspaper have intentional contrast curves — no PRINT_SIM stacking. 키는 재질 축(#475).
const TEXTURE_FILTERS: Record<string, string> = {
  vintage: 'sepia(0.6) contrast(1.1) brightness(0.9)',
  newspaper: 'grayscale(1) contrast(1.5) brightness(1.2)',
};

// material/coating 조합별 기본 밝기(#146 확정 b → #475 2축 확장). 코팅이 있으면(none 아니면) 코팅
// sheen 위에서 메타 가독성을 위해 0.5로 살짝 어둡게 깐다 — 옛 단일축의 none/hologram/metal/scodix가
// 전부 이 조건에 해당했다. 코팅이 없으면(none) 재질 자체의 색 필터가 이미 충분히 어둡게/탈색하는지로
// 갈린다 — vintage(세피아)·newspaper(흑백)는 필터가 이미 진해 1.0 유지, artpaper는 필터가 없어(원본
// 채도 유지) 0.5로 다시 깐다. 옛 8종 단일값 전부 이 규칙으로 정확히 재현된다(#475 마이그레이션 검증).
// 사용자가 슬라이더로 직접 조정한 값이 있으면 usePhototicket이 그 값을 그대로 넘기므로, 이 기본값은
// posterOpacity 미지정 시에만 쓰인다.
const DIM_WITHOUT_COATING_MATERIALS = new Set(['artpaper']);

export function defaultBrightnessForTexture(material: string, coating: string): number {
  if (coating !== 'none') return 0.5;
  return DIM_WITHOUT_COATING_MATERIALS.has(material) ? 0.5 : 1.0;
}

/**
 * 포스터 fit 공통 정책(#440) — 6무드가 제각각 하드코딩하던 fit/align/letterbox 배경을 한 곳으로.
 * 기본은 **무손실(contain)** — 포스터를 좌우 안 잘리게 통째로 넣고 남는 공간은 무드 배경색
 * (letterboxBg)으로 흡수한다. 사용자가 크롭 모달에서 "원본 비율 보존"을 끄면 posterFit이 'cover'가
 * 되어 슬롯을 꽉 채운다(opt-in). align은 세로 슬롯에서 레터박스를 어디로 몰지(top=하단 스크림이
 * 흡수) 무드가 정하고, cover면 항상 중앙(꽉 차 무의미)이다.
 */
export function posterFitProps(
  posterFit: 'cover' | 'contain' | undefined,
  opts: { letterboxBg: string; align?: 'center' | 'top'; frameInsetY?: number },
): { fit: 'cover' | 'contain'; align: 'center' | 'top'; background?: string; frameInsetY?: number } {
  const contain = posterFit !== 'cover';
  return contain
    ? { fit: 'contain', align: opts.align ?? 'center', background: opts.letterboxBg, frameInsetY: opts.frameInsetY }
    : { fit: 'cover', align: 'center' };
}

export const Poster = memo(function Poster({
  src,
  fit = 'cover',
  background = '#0a0a0a',
  material = 'original',
  materialIntensity = 1,
  coating = 'none',
  coatingIntensity = 1,
  posterOpacity,
  align = 'center',
  frameInsetY = 0,
  onTopBandHeight,
}: PosterProps) {
  // 밝기(posterOpacity)를 material/coating과 분리해 포스터 <img>에 직접 합성한다. 이전엔
  // TextureOverlay의 검은 dim 레이어에서만 적용돼 original/vintage/newspaper에선
  // 밝기 슬라이더가 완전히 무효였다(#139 ①). brightness(x)는 검은색을 multiply로
  // opacity (1-x)만큼 덮은 것과 수학적으로 동치라(final = src*x), 텍스처 dim 룩이
  // 그대로 유지되면서 모든 조합에서 밝기가 동작한다.
  const opacity = posterOpacity ?? defaultBrightnessForTexture(material, coating);
  const baseFilter = TEXTURE_FILTERS[material] ?? PRINT_SIM;
  const filter = `${baseFilter} brightness(${opacity})`;

  // 전경 포스터 가장자리 페더(#459) — contain 레터박스 씸을 뒤의 블러 배경과 부드럽게 잇는다.
  // 씸 위치는 슬롯 실크기 + 포스터 자연 종횡비로만 정해지므로 클라이언트에서 측정한다. 측정 전
  // (SSR/첫 페인트)엔 마스크 없이 오늘과 동일 → SSR 마크업 불변(기존 렌더 스냅샷 테스트 보존).
  // export는 이 CSS 마스크가 아니라 captureToImage.compositeRaster가 canvas로 같은 씸을 다시 그린다
  // (포스터 서브트리는 html-to-image에서 제외되므로, #439). 두 경로가 posterFeather 헬퍼를 공유해 일치.
  const posterRef = useRef<HTMLImageElement>(null);
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null);
  const natAspect = useNaturalAspect(src, fit === 'contain');
  useEffect(() => {
    const el = posterRef.current;
    if (fit !== 'contain' || !el) {
      setBoxSize(null);
      return;
    }
    const measure = () => setBoxSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure(); // 초기 1회는 ResizeObserver 유무와 무관하게 동기 측정(RO는 이후 리사이즈 반영용).
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, src]);
  // 상단 밴드 실측 리포트(#461) — boxSize/natAspect가 갱신될 때마다 무드에 재계산해 넘긴다.
  // align='top'은 레터박스가 전부 하단에 몰려 상단 밴드가 없으므로 항상 0.
  useEffect(() => {
    if (!onTopBandHeight) return;
    if (fit === 'contain' && align !== 'top' && boxSize && natAspect) {
      const { insetY } = posterContainRect(boxSize.w, boxSize.h, natAspect);
      onTopBandHeight(frameInsetY + insetY);
    } else {
      onTopBandHeight(0);
    }
  }, [onTopBandHeight, fit, align, boxSize, natAspect, frameInsetY]);
  // align='top'(objectPosition '50% 0%')이면 posY=0 → posterFeatherMask가 세로 페더를 스킵한다
  // (컨텐츠가 상단에 flush라 대칭 페더가 진짜 픽셀을 잘라냄, PR #460 P1). export도 동일 py를 쓴다.
  const featherMask =
    fit === 'contain' && boxSize && natAspect
      ? posterFeatherMask(boxSize.w, boxSize.h, natAspect, align === 'top' ? 0 : 0.5)
      : undefined;

  return (
    <div
      aria-hidden="true"
      // data-poster-root(#439): 캡처 시 html-to-image의 foreignObject 경로가 iOS Safari에서
      // 큰 raster를 떨어뜨리므로, captureToImage가 이 포스터 서브트리(배경색 div + 포스터 <img>들)를
      // 통째로 제외하고 대신 canvas 2D로 직접 합성한다. 이 div의 background(#0a0a0a)까지 함께
      // 빠져야 그 자리가 '투명 구멍'으로 남아 합성한 포스터가 비쳐 보인다.
      data-poster-root="true"
      // 저장 경로(captureToImage.compositeOverlay)가 이 서브트리를 제외하고 canvas로 재합성하므로,
      // 오버레이의 material/coating·강도를 DOM 속성으로 실어보내 캡처가 상태 없이 DOM만으로 재현하게
      // 한다(#434 c1, #471, #475 c2 — 재질→코팅 순 2회 합성). 레시피 밖 값(material=original,
      // coating=none)은 해당 data-* 를 안 실어 compositeOverlay가 그 축을 건너뛴다.
      data-material={material && material !== 'original' && TEXTURE_RECIPES[material] ? material : undefined}
      data-material-intensity={materialIntensity}
      data-coating={coating && coating !== 'none' && TEXTURE_RECIPES[coating] ? coating : undefined}
      data-coating-intensity={coatingIntensity}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background,
      }}
    >
      {/* 무손실(contain) 시 좌우폭/세로 맞춤으로 남는 레터박스를, 같은 포스터의 확대·blur본으로
          채운다(#440 오너 결정). 밝기는 전경과 동일하게 둬 레터박스가 검정 여백이 아니라 포스터의
          흐릿한 연장으로 읽히게 한다(너무 어두우면 검정과 구분이 안 됨). scale(1.2)로 blur 가장자리
          투명을 덮는다. cover는 전경이 슬롯을 꽉 채워 배경이 안 보이므로 생략한다. */}
      {fit === 'contain' && (
        <img
          src={src}
          alt=""
          data-poster-bg="true"
          data-role="poster"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: `${baseFilter} brightness(${opacity}) blur(28px)`,
            transform: 'scale(1.2)',
          }}
          draggable={false}
          crossOrigin="anonymous"
        />
      )}
      {/* img(replaced element)는 top+bottom만으론 안 늘어나 inset이 무시된다 — 사이징은 일반
          div(inset은 항상 신뢰 가능)가 맡고, img는 그 안에서 기존처럼 inset:0+100%로 채운다. */}
      <div style={{ position: 'absolute', top: fit === 'contain' ? frameInsetY : 0, bottom: fit === 'contain' ? frameInsetY : 0, left: 0, right: 0 }}>
        <img
          ref={posterRef}
          src={src}
          alt=""
          data-role="poster"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: fit,
            objectPosition: align === 'top' ? '50% 0%' : '50% 50%',
            filter,
            ...(featherMask ? { maskImage: featherMask, WebkitMaskImage: featherMask } : {}),
          }}
          draggable={false}
          crossOrigin="anonymous"
        />
      </div>
      {/* z-order(#475 c2/c3): 재질 결(아래) → 코팅 광택(위). 코팅은 재질 CSS filter가 이미 적용된
          <img> 위에 얹히므로 "재질 최종색 위에 코팅 blend"(c3)가 DOM 순서 그대로 성립한다. */}
      {material && material !== 'original' && <TextureOverlay texture={material} intensity={materialIntensity} />}
      {coating && coating !== 'none' && <TextureOverlay texture={coating} intensity={coatingIntensity} />}
    </div>
  );
});

/**
 * 상단 레터박스 밴드 톤 정합 색(#461). contain 포스터의 대칭 레터박스 위에 무드 시인성 스크림이
 * 비대칭(하단 진함·상단 옅음)으로 얹혀 상단 블러 밴드만 도드라지는 문제 — 스크림 자체를 대칭화(상단을
 * 하단만큼 진하게)하면 타이틀 블록 위 포스터까지 과다크닝되므로, 별도의 밴드 전용 오버레이(TopBandTone)로
 * 상단 밴드 구간에만 이 톤을 얹어 하단이 진한 스크림에 묻히는 정도로 맞춘다.
 *
 * ponytail: 실기기 육안 기준 상수 — 이미 얹힌 무드 스크림과 이 오버레이가 겹친 최종 합성 결과는
 * 알파 합성이라 무드마다 픽셀이 다르고, 계산이 아니라 시각으로 맞추는 값이다. 대조 시 어긋나면
 * 이 알파(0.5)만 조정.
 */
export function letterboxToneMatch(inkIsDark: boolean): string {
  return inkIsDark ? 'rgba(245,240,232,0.5)' : 'rgba(0,0,0,0.5)';
}

/**
 * 상단 레터박스 밴드 톤 정합 오버레이(#461) — Poster의 onTopBandHeight로 리포트된 실측 높이 구간에만
 * tone에서 투명으로 흐르는 그라데이션을 얹는다. heightPx<=0(레터박스 없음/측정 전)이면 렌더 안 함 —
 * SSR/첫 페인트엔 오늘과 동일(#459 페더와 동일 원칙, 렌더 스냅샷 테스트 보존).
 */
export function TopBandTone({ heightPx, tone }: { heightPx: number; tone: string }) {
  if (heightPx <= 0) return null;
  return (
    <div
      aria-hidden="true"
      data-letterbox-tone="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: heightPx,
        background: `linear-gradient(180deg, ${tone} 0%, transparent 100%)`,
        pointerEvents: 'none',
      }}
    />
  );
}

// 텍스처별 오버레이. dim(밝기)은 Poster의 <img> filter로 분리됐으므로 여기선 검은 레이어를 두지
// 않는다(#139 ①). 두 계열 모두 단일 레시피(textureRecipes.ts)를 저장 경로(captureToImage.
// compositeOverlay)와 공유해 미리보기=저장물을 맞춘다 — gradient 4종은 stop 하이라이트(#434),
// 물리재질 3종은 feTurbulence 종이결(#471). intensity는 세기에 곱해져 0=완전 무가공이 된다.
function TextureOverlay({ texture, intensity = 1 }: { texture: string; intensity?: number }) {
  const recipe = TEXTURE_RECIPES[texture];
  if (!recipe) return null; // original 등 레시피 밖 — 오버레이 없음

  if (isNoiseRecipe(recipe)) {
    // 물리재질 종이결(#471) — feTurbulence 노이즈 타일을 반복해 blend로 얹는다. 저장 경로가 같은
    // noiseTileSvg를 raster화해 canvas createPattern으로 재현한다. 유효 opacity = alpha × intensity.
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: `url("${noiseTileSvg(recipe)}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: `${recipe.tile}px ${recipe.tile}px`,
          mixBlendMode: recipe.blend,
          opacity: recipe.alpha * intensity,
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: recipeToGradientCss(recipe, intensity),
        mixBlendMode: recipe.blend,
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
  /** Code128B(1자리=1심볼, 기본)와 Code128C(2자리=1심볼, 폭 절반 수준) 중 선택(#444). */
  encoding?: 'code128b' | 'code128c';
}

type Bar = { ink: boolean; w: number };

// Code 128 심볼 폭 패턴 전체 표(값 0~106). 각 항목은 bar,space,bar,space,bar,space
// (6요소, 폭 합 11모듈). 값 104=Start-B, 106=Stop(7요소, 13모듈). 103(Start-A)·105(Start-C)는 미사용(표 완전성용).
// 실제 스캐너가 bookingNo를 디코드하는 표준 Code128B 인코딩(#207) — 이전 #205는 이 표의
// 앞 32개만 쓰고 charCode%32로 인덱싱한 장식이라 체크디짓도 없어 스캔 불가였다.
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', // 0-7
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', // 8-15
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', // 16-23
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', // 24-31
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 32-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', // 40-47
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', // 48-55
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', // 56-63
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', // 64-71
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 72-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', // 80-87
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', // 88-95
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', // 96-103
  '211214', '211232', '2331112', // 104=Start-B, 105=Start-C, 106=Stop
];
const CODE128_START_B = 104;
const CODE128_START_C = 105;
const CODE128_STOP = 106;
const CODE128_CODE_B = 100; // Code128C 심볼 스트림 안에서 subset B로 전환(홀수 자리 마지막 1자리용)
const BARCODE_FALLBACK_DIGITS = 'PT-000000-0000'.replace(/\D/g, '');

// 심볼 값 배열(Start~Stop 전부 포함) -> 교차하는 Bar[]. 128B/128C 두 인코더가 공유(#444) —
// Code128 심볼 폭 표는 subset과 무관하게 값 0~106이 동일한 bar/space 패턴이라 안전하다.
function symbolsToBars(symbols: number[]): Bar[] {
  const seq = symbols.map((s) => CODE128_PATTERNS[s]).join('');
  const bars: Bar[] = [];
  let ink = true; // 데이터 심볼은 6요소(짝수)라 심볼 경계마다 bar-start parity 복원, Stop만 7요소로 bar 종결
  for (let i = 0; i < seq.length; i++) {
    bars.push({ ink, w: parseInt(seq[i], 10) });
    ink = !ink;
  }
  return bars;
}

// bookingNo 문자열을 표준 Code128B로 인코딩해 실제 스캐너가 디코드 가능한 막대 폭을 만든다.
// Start-B + 데이터(값=ASCII-32) + 체크디짓(mod 103) + Stop. export는 인코딩 self-check용.
// 숫자만 인코딩(#312) — 대시 포함 원본을 그대로 넣으면 대시가 심볼을 차지해 바코드가 왜곡된다.
// 텍스트 표시(`No. ${bookingNo}`)는 원본을 그대로 쓰므로 이 변환은 바코드 인코딩에만 영향.
export function buildBarcodeWidths(value: string): Bar[] {
  // 숫자가 하나도 없는 값(예: 순한글 OCR 오인식)도 폴백 — value가 truthy면 앞의 `value ||`
  // 폴백을 안 타고 숫자만 걸러낸 뒤 빈 문자열이 되어, 데이터 심볼 없는 "빈" 바코드가 그려졌다
  // (#190 P2 nit, PR #329 리뷰).
  const v = (value || 'PT-000000-0000').replace(/\D/g, '') || BARCODE_FALLBACK_DIGITS;
  const values: number[] = [];
  for (let i = 0; i < v.length; i++) {
    // 숫자(ASCII 48~57)만 남은 문자열이라 항상 Code128B 범위(32~126) 안이다.
    values.push(v.charCodeAt(i) - 32);
  }
  let checksum = CODE128_START_B;
  values.forEach((val, i) => {
    checksum += val * (i + 1);
  });
  checksum %= 103;
  return symbolsToBars([CODE128_START_B, ...values, checksum, CODE128_STOP]);
}

// bookingNo를 Code128C로 인코딩(#444) — 숫자 2자리를 심볼 1개(0~99)로 묶어 128B 대비 심볼 수를
// 거의 절반으로 줄인다(CGV 16자리 판매번호 기준 211유닛 -> 123유닛, quiet zone 포함 143유닛).
// 좁은 무드(editorial 216px였던 원래 폭 등)에서 모듈당 px가 스캔 가능 최소치(2px)를 넘기려면
// 필수 — editorial은 70px 폭 확대(216->286)와 함께 적용해야 실제로 2px/모듈을 넘는다.
// 자리수가 홀수면 마지막 1자리만 Code B로 전환해 넣는다(표준 Code128 mixed-mode) — Code128C는
// 항상 짝수 자리만 심볼화할 수 있어서다.
export function buildBarcodeWidths128C(value: string): Bar[] {
  const v = (value || 'PT-000000-0000').replace(/\D/g, '') || BARCODE_FALLBACK_DIGITS;
  const symbols: number[] = [CODE128_START_C];
  const pairEnd = v.length - (v.length % 2);
  for (let i = 0; i < pairEnd; i += 2) {
    symbols.push(parseInt(v.slice(i, i + 2), 10));
  }
  if (v.length % 2 === 1) {
    symbols.push(CODE128_CODE_B, v.charCodeAt(v.length - 1) - 32);
  }
  let checksum = CODE128_START_C;
  symbols.slice(1).forEach((val, i) => {
    checksum += val * (i + 1);
  });
  checksum %= 103;
  return symbolsToBars([...symbols, checksum, CODE128_STOP]);
}

export const Barcode = memo(function Barcode({
  value = 'PT-000000-0000',
  color = 'currentColor',
  height = 80,
  width = 360,
  orientation = 'horizontal',
  showText = true,
  textSize = 11,
  encoding = 'code128b',
}: BarcodeProps) {
  const widths = useMemo(
    () => (encoding === 'code128c' ? buildBarcodeWidths128C(value) : buildBarcodeWidths(value)),
    [value, encoding]
  );

  const bars = useMemo(() => {
    const totalUnits = widths.reduce((a, b) => a + b.w, 0);
    const QUIET = 10; // Code128 표준 quiet zone >=10 모듈 (#207, 너무 좁으면 스캔 실패)
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

/**
 * 35mm 필름 스트립 밴드(에픽 #281, 마스터 Ticket Design Master.dc.html v2 1:1). 상/하단 92px 밴드에
 * 천공(44×24 r6) + 프레임번호(236+i) + KEYKODE 바 + 엣지 스크롤 코드(×4, ◆ 구분) + 그레인 오버레이.
 * accent(amber)는 무드가 themeColor에서 파생해 넘긴다. pos로 상/하단을 뒤집는다 — 천공·프레임·키코드는
 * 바깥 모서리, 엣지 텍스트는 안쪽 모서리에 붙는다. HorizontalSprockets(단순 천공)와 달리 이건 35mm 전용.
 */
const KK_PATTERN = '31122112132113112212311213212112'.split('').map(Number);

export const FilmStripBand = memo(function FilmStripBand({
  pos,
  accent,
  codes,
  base = '#0a0a0a',
  height = 92,
}: {
  pos: 'top' | 'bottom';
  accent: string;
  codes: string[];
  base?: string;
  height?: number;
}) {
  const outer: 'top' | 'bottom' = pos;
  const inner: 'top' | 'bottom' = pos === 'top' ? 'bottom' : 'top';
  const N = 15;

  const holes = Array.from({ length: N }, (_, i) => (
    <div key={i} style={{ width: 44, height: 24, borderRadius: 6, background: '#f1ead9', flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.5), inset 0 2px 4px rgba(0,0,0,.6)' }} />
  ));
  const frameNums = Array.from({ length: N }, (_, i) => {
    const f = 236 + i;
    const label = f % 2 === 0 ? String(f >> 1) : `${f >> 1}A`;
    return <span key={i} style={{ fontFamily: FONT_LCD, fontSize: 9, fontWeight: 400, letterSpacing: 0.5, color: accent, flexShrink: 0 }}>{label}</span>;
  });
  let inkBar = true;
  const kkBars = KK_PATTERN.map((w, i) => {
    const seg = <span key={i} style={{ width: w * 1.5, height: 8, background: inkBar ? accent : 'transparent', flexShrink: 0 }} />;
    inkBar = !inkBar;
    return seg;
  });
  const cells: ReactNode[] = [];
  for (let r = 0; r < 4; r++)
    codes.forEach((code, i) => {
      cells.push(
        <span key={`${r}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, color: accent, fontWeight: 600, letterSpacing: 2.5 }}>
          <span style={containsHangul(code) ? { fontFamily: FONT_KR } : undefined}>{code}</span>
          <span style={{ margin: '0 15px', opacity: 0.5 }}>◆</span>
        </span>
      );
    });

  const holesStyle: CSSProperties = { position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' };
  holesStyle[outer] = 6;
  const frameStyle: CSSProperties = { position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 27px', opacity: 0.7, pointerEvents: 'none' };
  frameStyle[outer] = 32;
  const kkStyle: CSSProperties = { position: 'absolute', left: 16, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9, pointerEvents: 'none' };
  kkStyle[outer] = 45;
  const edgeStyle: CSSProperties = { position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', padding: '0 14px', fontFamily: FONT_LCD, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', opacity: 0.92, pointerEvents: 'none' };
  edgeStyle[inner] = 6;
  const rootStyle: CSSProperties = { position: 'absolute', left: 0, right: 0, height, background: base, overflow: 'hidden' };
  rootStyle[outer] = 0;

  // 밴드 전체가 순수 장식 크롬(천공·프레임번호·KEYKODE·엣지 스크롤은 편집 필드가 아님) — 엣지 텍스트가 제목·
  // 서명을 복제하므로 aria-hidden으로 스크린리더가 티켓 필드처럼 중복해 읽지 않게 한다(#289 리뷰 P2).
  return (
    <div aria-hidden="true" style={rootStyle}>
      <div style={holesStyle}>{holes}</div>
      <div style={frameStyle}>{frameNums}</div>
      <div style={kkStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>{kkBars}</div>
        <span style={{ fontFamily: FONT_LCD, fontSize: 10, fontWeight: 400, letterSpacing: 1.6, color: accent }}>KL 23 4587 1234+05</span>
      </div>
      <div style={edgeStyle}>{cells}</div>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, mixBlendMode: 'overlay', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, rgba(0,0,0,.07) 1px 3px), repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, rgba(0,0,0,.05) 1px 3px)' }} />
    </div>
  );
});

/**
 * FilmStripBand의 엣지 스크롤 코드 배열 조립(35mm·35mm Wide 공용, #393) — 두 무드가 완전히 같은
 * 로직을 각자 들고 있던 걸 통합. 순수 장식 크롬(편집 불가)이라 title/signature 복제 외엔 상수 문구.
 */
export function buildEdgeCodes({
  titleVal,
  releaseDateVal,
  ratingVisible,
  rating,
  signatureVal,
}: {
  titleVal: string;
  releaseDateVal: string;
  ratingVisible: boolean;
  rating: number;
  signatureVal: string;
}): string[] {
  return [
    // 나머지 코드가 전부 대문자 상수라 원어(영어) 원제도 맞춤(#443 팔로업). toUpperCase는 한글엔
    // no-op이라 titleOgVal 없을 때의 한글 제목 폴백에도 안전하다.
    titleVal.toUpperCase(),
    'SAFETY FILM',
    'MADE WITH FILME · 35MM',
    releaseDateVal && `PT · ${releaseDateVal}`,
    ratingVisible && `★ ${rating.toFixed(1)}`,
    signatureVal && `COLLECTED BY ${signatureVal}`,
  ].filter(Boolean) as string[];
}

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

function seedFromString(s: string): number {
  let h = 0x9e3779b9 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x85ebca6b) >>> 0;
  }
  return h;
}

const CURRENT_YEAR = new Date().getFullYear();

function legacyFallbackBookingNumber(seed: string): string {
  const tail = String(seedFromString(seed) % 10000).padStart(4, '0');
  return `PT-${CURRENT_YEAR}-${tail}`;
}

// movieCd(8자리) + watchDate(YYYYMMDD, 8자리) = 16자리. watchDate 없으면 movieCd 8자리만
// 유지(#379 — 날짜를 오늘/개봉일로 지어내면 같은 티켓이 재생성마다 바뀌거나 '관람일'의 의미가
// 사라짐). movieCd 자체가 없는 완전 수동입력 케이스만 기존 title 해시 fallback을 유지한다.
function fallbackBookingNumber(d: MovieInfo): string {
  if (d.movieCd) return d.movieCd + (d.watchDate ? d.watchDate.replace(/-/g, '') : '');
  return legacyFallbackBookingNumber(d.title || 'phototicket');
}

function resolveBookingNo(d: MovieInfo): string {
  return d.bookingNumber || fallbackBookingNumber(d);
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

export interface FitFontSizeOptions {
  fontFamily: string;
  fontWeight?: number;
  minSize: number;
  maxSize: number;
}

let measureCanvas: HTMLCanvasElement | null | undefined;

// 캔버스 엘리먼트만 모듈 스코프에서 lazy하게 재사용하고(매번 새로 만들지 않음), 2D 컨텍스트는
// 호출마다 새로 얻는다 — 컨텍스트 유무를 한 번만 확인해 영구 캐시하면 이 판정이 이후 절대
// 재확인되지 않아, 테스트(문서 프로토타입 목)나 real-world context-lost 이벤트에서 최초
// 판정이 그대로 굳어버린다. `getContext('2d')` 자체는 같은 canvas에 대해 매번 불러도 저렴하다.
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCanvas === undefined) {
    // SSR 가드 — Canvas는 브라우저 전용 API(ocrPreprocess.ts와 동일 패턴).
    measureCanvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  }
  return measureCanvas ? measureCanvas.getContext('2d') : null;
}

const fitFontSizeCache = new Map<string, number>();

/**
 * 커스텀 웹폰트(FONT_KR = next/font/local Pretendard, `display:'swap'`) 로드 완료 여부(#318
 * claude-review PR #345 P1). 로드 전엔 canvas measureText가 폴백 폰트 메트릭으로 재는데, 그
 * 결과가 캐시에 박히면 진짜 폰트가 도착해도 재계산 없인 안 바뀐다 — 그래서 로드 전엔
 * `fitFontSizeToWidth`가 캐시에 쓰지 않는다(아래). 이 훅은 그 "로드 전" 구간을 알려주고,
 * 로드 완료 시 상태 변경으로 소비 컴포넌트를 정확히 한 번 재렌더시켜 정확한 값으로 재계산·
 * 캐시되게 한다.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(
    () => typeof document === 'undefined' || document.fonts === undefined || document.fonts.status === 'loaded',
  );
  useEffect(() => {
    if (ready || typeof document === 'undefined' || !document.fonts) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);
  return ready;
}

/**
 * 텍스트가 maxWidth(px) 안에 들어가는 가장 큰 폰트 크기를 이진탐색으로 구한다(#318).
 *
 * 티켓은 뷰포트에 반응하지 않고 무드별 고정 자연 픽셀 크기로 렌더되므로, 타이틀 영역의
 * 가용폭은 런타임에 관찰할 필요 없이 이미 알려진 상수다 — ResizeObserver나 실측
 * 오버플로 루프 없이 canvas 2D `measureText`로 순수 계산 후 그대로 쓴다.
 *
 * SSR-safe: document 없으면(서버 렌더) throw 없이 maxSize를 그대로 반환한다(ocrPreprocess.ts
 * 실패-흡수 패턴).
 *
 * `fontsReady=false`(호출부가 `useFontsReady()`로 넘김)일 땐 **캐시에 쓰지 않는다** — 폰트
 * 로드 전 폴백 메트릭으로 잰 값이 캐시에 박혀 로드 후에도 안 바뀌는 걸 막는다(PR #345 P1).
 * 이 구간은 실사용에서 아주 짧고 드물어(로드 전 렌더는 useFontsReady가 재렌더를 트리거하기
 * 전까지의 한두 프레임뿐) 캐시 미스 비용이 무시할 만하다.
 *
 * (text, maxWidth, fontFamily, fontWeight, minSize, maxSize) 키로 메모이즈해 리렌더마다
 * 재계산하지 않는다.
 *
 * ponytail: letter-spacing은 측정에 반영하지 않는다 — 실제 호출부 값이 전부 0 이하(자간
 * 좁힘)라 canvas 기본 측정값이 실제보다 넓게(보수적으로) 잡히므로 오버플로 방향의 오차는
 * 없다. 완벽한 줄바꿈 시뮬레이션도 하지 않는다 — 호출부가 "가용폭 × 클램프 줄 수"를
 * maxWidth로 넘겨 가장 긴 한 줄 기준으로 안전하게 축소하는 근사를 쓴다.
 */
export function fitFontSizeToWidth(
  text: string,
  maxWidth: number,
  { fontFamily, fontWeight = 400, minSize, maxSize }: FitFontSizeOptions,
  fontsReady = true,
): number {
  if (!text) return maxSize;

  const key = `${text} ${maxWidth} ${fontFamily} ${fontWeight} ${minSize} ${maxSize}`;
  const cached = fitFontSizeCache.get(key);
  if (cached !== undefined) return cached;

  const ctx = getMeasureCtx();
  if (!ctx) return maxSize;

  const widthAt = (size: number) => {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    return ctx.measureText(text).width;
  };

  let result = maxSize;
  if (widthAt(maxSize) > maxWidth) {
    if (widthAt(minSize) > maxWidth) {
      result = minSize;
    } else {
      let lo = minSize;
      let hi = maxSize;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (widthAt(mid) <= maxWidth) lo = mid;
        else hi = mid;
      }
      result = lo;
    }
  }

  if (fontsReady) fitFontSizeCache.set(key, result);
  return result;
}

function luminance(hex: string): number {
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
