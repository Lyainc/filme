import { CSSProperties, Fragment, HTMLAttributes, ImgHTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactElement, ReactNode, SyntheticEvent, cloneElement, isValidElement, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MovieInfo, QuoteFont, TicketComponents, TicketField } from '@/types';
import { FIELD_LABELS, STAMP_LABELS, isStampTarget, type SheetTarget } from '@/constants/fields';
import { formatDate } from '@/utils/dateFormat';
import { posterContainRect, posterContentFrac, posterFeatherMask, type EmbossContentFrac } from '@/utils/posterFeather';
import { TEXTURE_RECIPES, gradientBitmapSvg, isNoiseRecipe, noiseTileSvg, EMBOSS_RECIPE, embossBitmapSvg, RELIEF_RECIPE, reliefBitmapSvg, projectEmbossStamps, projectEmbossPaths, type TextureRecipe, type TextureBlend, type EmbossStamp, type EmbossPath } from '@/utils/textureRecipes';
import { EyeIcon } from '@/components/ui/VisibilityCheckbox';

export interface MoodProps {
  movieInfo: MovieInfo;
  components: TicketComponents;
  /** null = 포스터 없음. Poster가 배경색만 칠한다(포스터를 안 쓰는 무드·사용자도 정상 경로). */
  croppedImageUrl: string | null;
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
  /**
   * 형압 마스크(#509) — croppedImageUrl과 동일하게 `components`(TicketComponents) 밖의 세션 한정
   * 필드다(PhototicketState 주석 참고). 각 무드가 자기 Poster() 호출에 그대로 전달한다.
   */
  embossStamps?: EmbossStamp[];
  /** 자석 올가미(#509 2단계, c10) 닫힌 다각형 — embossStamps와 나란히 각 무드가 그대로 전달한다. */
  embossPaths?: EmbossPath[];
  /** 형압 강도 0..1(#509). 미지정 시 Poster 기본값(1). */
  embossIntensity?: number;
  /** 볼록 압인 마스크(#732 d2 · #735) — embossStamps와 나란한 두 번째 벌, 좌표계·전달 규율 동일. */
  reliefStamps?: EmbossStamp[];
  /** 볼록 압인 올가미(#735) — embossPaths와 나란한 두 번째 벌. */
  reliefPaths?: EmbossPath[];
  /** 볼록 압인 강도 0..1(#735). 미지정 시 Poster 기본값(1). */
  reliefIntensity?: number;
}

/**
 * 온-티켓 필드 탭 래퍼(#259 → #646 키보드 접근성). onField가 없으면(데스크톱/캡처) children을 그대로
 * 통과해 레이아웃·래스터가 완전히 동일하다 — 캡처(ResultPanel의 별도 TicketRenderer)엔 onField가 안
 * 가므로 탭 UI가 산출물에 샐 수 없다.
 *
 * onField가 있으면 별도 래퍼 박스를 만들지 않고, role/aria-label/tabIndex/onClick/onKeyDown을
 * children 자신에 cloneElement로 얹는다 — children이 유효한 단일 엘리먼트일 때, 무드의 절대배치·
 * 크기엔 0 영향(기존 박스를 그대로 재사용). children이 순수 텍스트(fieldPieces의 값 조각)면 새
 * `<span>`으로 감싼다 — 원래도 인라인 텍스트 흐름이라 레이아웃 영향이 없다.
 *
 * 예전엔 display:contents div로 감쌌는데, 그 div 자신은 CSS 스펙상 principal box가 없어 tabIndex를
 * 얹어도 포커스를 받지 못했다(#646 항목1 — role="button"인데 키보드로 활성화가 안 되는 ARIA 위반).
 * children에 직접 부착하면 이 문제가 원천적으로 없다 — 부착 대상 자체가 실제 박스를 가진 노드라서.
 * FieldGhost·SignatureStamp처럼 커스텀 컴포넌트가 children으로 오는 경우 그 컴포넌트가 rest props를
 * DOM 루트로 포워드해야 role/tabIndex 등이 실제로 렌더된다 — 새 children을 추가할 땐 이 계약을 지킬 것.
 * Fragment(`<>...</>`)는 이 계약을 못 받는다 — `isValidElement`는 Fragment도 true지만
 * `cloneElement`는 Fragment에 role/tabIndex 등 임의 prop을 못 얹으므로(React가 조용히 무시), 클릭·
 * 키보드가 둘 다 죽는다. FieldTap의 children으로 Fragment를 직접 넘기지 말 것.
 *
 * stopPropagation으로 포스터 root 탭(onPosterTap)과 겹치지 않게 한다.
 *
 * data-field-tap(#354): 인플레이스 에디터(measureField)의 측정 앵커 — children 자신에 붙으므로
 * 에디터는 이제 별도 firstElementChild 인다이렉션 없이 이 엘리먼트를 곧바로 측정한다.
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
  const label = isStampTarget(field) ? STAMP_LABELS[field] : FIELD_LABELS[field];
  const activate = useCallback(
    (e: SyntheticEvent) => {
      e.stopPropagation();
      onField?.(field);
    },
    [onField, field]
  );
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(e);
      }
    },
    [activate]
  );
  // 안정적인 참조(#646) — Barcode 등 memo 자식이 매 리렌더 새 prop 객체를 받아 memo bail-out이
  // 무력화되지 않게 field/onField/label이 안 바뀌면 같은 객체를 유지한다.
  const interactiveProps = useMemo(
    () => ({
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': `${label} 편집`,
      'data-field-tap': field,
      onClick: activate,
      onKeyDown,
    }),
    [label, field, activate, onKeyDown]
  );
  if (!onField) return <>{children}</>;
  if (isValidElement(children)) {
    return cloneElement(children as ReactElement<Record<string, unknown>>, interactiveProps);
  }
  return <span {...interactiveProps}>{children}</span>;
}

/**
 * 포스터 영역 탭 props(#259). onPosterTap이 있을 때만 onClick+라벨을 얹는다. 풀블리드 무드는 root에,
 * editorial(다열)은 포스터 컬럼에 스프레드한다. role은 생략 — root엔 이미 role=button 필드 자식이 있어
 * 중첩 방지, 포스터 변경은 포인터 제스처다. data 속성은 테스트 셀렉터용이며 캡처 렌더러엔
 * onPosterTap이 안 가 붙지 않는다.
 *
 * 셸이 이걸 넘기는 조건은 **포스터가 없을 때뿐이다**(#723, MobileEditorShell의 TicketRenderer 호출부).
 * #365가 없앤 건 "포스터가 **있는** 상태에서 빈 곳을 오탭해 파일선택창이 뜨는 것"이라, 그 게이트를
 * 유지하는 한 미스터치는 되돌아오지 않는다. 라벨이 '변경'이 아니라 '추가'인 것도 같은 이유다 —
 * 이 props가 붙는 순간 그 자리엔 아직 포스터가 없다. 게이트를 넓히려면 라벨도 같이 볼 것.
 *
 * 이게 키보드 사용자를 막지는 않는다(#608) — 위 게이트 때문에 키보드 완주가 이 경로에 의존하지
 * 않고, 포스터 업로드·교체·재크롭 진입점은 전부 `<button>`(업로드 드롭존 · 헤더 편집 메뉴 행)이라
 * Enter/Space로 열린다. 그 완주 경로는 `__tests__/posterCropPipeline.test.tsx`의
 * '키보드 전용 포스터 업로드 경로 (#608)' describe가 Tab+Enter만으로 못 박는다.
 * 예전 주석이 "키보드 업로드 경로는 ImageUploader가 커버"라고 적었는데, 그 컴포넌트는 #607에서
 * 삭제됐고 실제로 커버하고 있던 것도 아니었다.
 */
export function posterTapProps(onPosterTap?: () => void) {
  return onPosterTap
    ? { onClick: onPosterTap, 'aria-label': '포스터 추가', 'data-poster-tap': 'true' }
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
 * 스탬프 폭에 무드별 절대 상한을 겹쳐 건다(#589). STAMP_MAX_ASPECT는 높이 기반이라 사용자
 * scale(최대 1.3)이 곱해지면 같이 커지는데, Editorial 스텁처럼 폭 예산이 px로 고정된 자리에선
 * 그 상한이 예산을 넘긴다 — 그런 무드만 `maxWidth`(px)를 넘겨 scale과 무관한 천장을 얹는다.
 * 미지정 무드는 지금까지와 동일(높이 기반 상한만).
 */
const capW = (aspectCap: number, absolute?: number) =>
  absolute === undefined ? aspectCap : Math.min(aspectCap, absolute);

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
 * 렌더된 로고 `<img>`가 이미 로드한 자연 종횡비(width/height) — 미로드/실패/img 없음은
 * null(#392, 스탬프 높이 보정 입력). 반환 `imgProps`를 그 `<img>`에 펼쳐 붙인다.
 *
 * 예전엔 같은 src를 `new Image()`로 한 번 더 디코드하는 프로브였다(#539) — 로고마다 2회,
 * 스탬프 2종이면 티켓당 4회, 마운트마다(에디터 프리뷰 + 결과 렌더러) 배수였다. Poster가
 * #526 ①에서 먼저 걷어낸 것과 같은 패턴으로 통일한다.
 *
 * ref는 콜백이라 `<img>`가 없는 분기(라벨·placeholder·노출 off의 dim 박스)로 넘어가면
 * 언마운트에서 null로 불려 aspect가 함께 풀린다 — 로고를 숨긴 dim placeholder가 이전 로고의
 * 종횡비 보정을 물고 있지 않게 하는 게 이 콜백의 몫이다(#539 판정: 로고가 안 보이는 박스에
 * ±16px 보정은 두 고스트 박스 높이만 어긋나게 할 뿐 전달하는 정보가 없다).
 *
 * effect는 같은 `<img>`에서 src만 갈릴 때를 맡는다 — 그땐 ref가 다시 안 불리므로, 새 src의
 * complete=false를 읽어 이전 값을 즉시 폐기한다(로고 교체 시 이전 높이가 잠깐 유지되던 #190 nit).
 */
function useNaturalAspect(src: string | null) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const read = useCallback((el: HTMLImageElement | null) => {
    imgRef.current = el;
    // naturalHeight까지 보는 건 0 나눗셈 방어 — 치수가 반쪽만 잡히는 이미지(높이 없는 SVG 등)를
    // Infinity(=cap까지 축소)가 아니라 "모름"(보정 없음)으로 떨어뜨린다.
    setAspect(el && el.complete && el.naturalWidth > 0 && el.naturalHeight > 0 ? el.naturalWidth / el.naturalHeight : null);
  }, []);
  useEffect(() => {
    read(imgRef.current);
  }, [src, read]);
  return {
    aspect,
    /** ResizeObserver처럼 엘리먼트 자체가 필요한 쪽을 위해 같은 ref를 그대로 내준다(Poster). */
    ref: imgRef,
    imgProps: { ref: read, onLoad: (e: SyntheticEvent<HTMLImageElement>) => read(e.currentTarget) },
  };
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
// **맨 앞이 `var(--font-sans)`인 게 핵심이다**(#751, FONT_KR에 적용된 #437과 같은 모양). 뒤의
// `"Pretendard Variable"`은 `_app.tsx`가 번들한 폰트를 못 가리킨다 — next/font는 난독화된
// 패밀리명(`pretendard`)으로 @font-face를 등록하므로, 리터럴 이름은 **OS에 Pretendard가 따로
// 설치된 기기에서만** 맞는다. 그래서 예전엔 폰트가 깔린 개발 맥에서만 의도대로 보이고 안 깔린
// 기기에선 조용히 시스템 폰트로 떨어졌다. 뒤의 리터럴 셋은 그대로 둔다 — CSS 변수가 못 닿는
// 자리(변수를 안 건 트리, canvas measureText — `resolveCanvasFontFamily` 참고)의 폴백이다.
export const FONT_SANS =
  'var(--font-sans), "Pretendard Variable", "Pretendard", "Noto Sans KR", sans-serif';
// Inter는 한글 글리프가 없어 폴백 시 한글이 시스템 폰트로 어긋남 → 한글 지원 폰트로 교체.
//
// **맨 앞이 `var(--font-sans)`인 게 핵심이다**(#437). 뒤의 `"Pretendard Variable"`은 `_app.tsx`가
// 번들한 폰트를 못 가리킨다 — next/font는 난독화된 패밀리명(`pretendard`)으로 @font-face를
// 등록하므로, 리터럴 이름은 **OS에 Pretendard가 따로 설치된 기기에서만** 맞는다(실측:
// 브라우저의 등록 패밀리 목록에 'Pretendard Variable'이 없고 'pretendard'만 있다). 그래서
// 예전엔 폰트가 깔린 개발 맥에서만 의도대로 보이고 안 깔린 기기에선 조용히 시스템 폰트로
// 떨어졌다. 9택의 'gothic'이 이 상수를 쓰고 크기 보정까지 진짜 Pretendard 기준으로 재므로
// (HANGUL_SIZE_SCALE.gothic), 엉뚱한 서체에 배율이 걸리지 않게 여기서 닫는다.
// 뒤의 리터럴 셋은 그대로 둔다 — CSS 변수가 못 닿는 자리(변수를 안 건 트리)의 폴백이다.
export const FONT_KR =
  'var(--font-sans), "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

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

// ── 한줄평·서명 사용자 선택 폰트(#437) ───────────────────────────────────────────
// `_app.tsx`가 next/font로 자체 호스팅하고 CSS 변수로 노출한다(전부 preload:false).
// 출처·라이선스 조항은 public/fonts/LICENSES.md — 특히 잉크립퀴드체는 장평·기울기 변형이
// 금지라 이 폰트들엔 fontStyle:'italic'이나 transform:scaleX를 걸면 안 된다.
export const FONT_BATANG = 'var(--font-batang), serif';
export const FONT_INK = 'var(--font-ink), cursive';
export const FONT_EUNYOUNG = 'var(--font-eunyoung), cursive';
export const FONT_BRUSH = 'var(--font-brush), cursive';
export const FONT_COOLGUY = 'var(--font-coolguy), cursive';
// 꽃길만 완성형 전체가 아니라 KS X 1001 상용 2352자다(실측: `뷁`·`쀓` 없음). 없는 음절은
// 브라우저가 글리프 단위로 다음 폰트에서 찾으므로 FONT_KR을 뒤에 붙여 두부를 막는다 —
// 나머지 7종은 11172자를 다 덮어서 이 꼬리가 필요 없다.
export const FONT_FLOWER = `var(--font-flower), ${FONT_KR}`;

/** 한글(자모·호환 자모·완성형) 포함 여부 — 한줄평 폰트 분기(FONT_QUOTE_KR vs FONT_DISPLAY)에 사용. */
export function containsHangul(text: string): boolean {
  return /[ᄀ-ᇿ㄰-㆏가-힣]/.test(text);
}

/**
 * 유저가 직접 쓴 장식 텍스트(서명 #494 · Criterion 한줄평 #391)의 폰트 — 라틴은 옆에 서는 장식
 * 라벨('collected by' 등)과 같은 FONT_DISPLAY 이탤릭으로 정합하고, 한글은 FONT_DISPLAY에 글리프가
 * 없으므로(위 경고) 손글씨 FONT_QUOTE_KR로 분기한다. 무조건 치환은 한글을 시스템 세리프로 깨뜨리니
 * 분기째로 공유해야 한다 — Criterion 한 무드에 있던 모델을 6무드 + 한줄평 공용으로 올린 것.
 * 필드 이름이 아니라 "유저 입력 장식 텍스트"가 단위다. weight를 400으로 고정하는 건 두 폰트 다
 * 단일 웨이트라 600/500을 상속하면 합성 볼드가 되어 라벨과 톤이 다시 갈리기 때문.
 *
 * `font`(#558 4택 → #437 9택)는 한줄평·서명 피커가 넘기는 사용자 선택이고, 기본 'auto'가 위
 * 자동분기다. 유니온에 없는 옛 값('serif')은 default로 떨어져 auto와 같게 렌더된다 —
 * 그게 예전 'serif'의 렌더와 픽셀이 같아서 마이그레이션이 필요 없다(`QuoteFont` 주석 참고).
 *
 * `baseFontSize`를 넘기면 아래 실측 배율을 곱한 `fontSize`까지 같이 돌려준다. 호출부는
 * 자기 리터럴 fontSize를 이 인자로 옮기고 스타일 객체에선 뺀다 — 스프레드 뒤에 fontSize를
 * 다시 쓰면 보정이 덮여 조용히 무력화된다.
 */
export function userTextFont(
  text: string,
  font: QuoteFont = 'auto',
  baseFontSize?: number
): CSSProperties {
  const hangul = containsHangul(text);
  // `font in USER_TEXT_FONTS`가 유니온에 없는 옛 저장값(#558의 'serif')까지 여기서 걸러
  // auto와 같은 길로 보낸다 — 그게 예전 'serif'의 렌더와 픽셀이 같아 마이그레이션이 없다.
  const chosen = font !== 'auto' && font in USER_TEXT_FONTS ? (font as UserTextFontKey) : null;
  const resolved: UserTextFontKey = chosen ?? (hangul ? 'hand' : 'latin');
  const scale = (hangul ? HANGUL_SIZE_SCALE : LATIN_SIZE_SCALE)[resolved] ?? 1;
  return {
    ...USER_TEXT_FONTS[resolved],
    ...(baseFontSize === undefined
      ? null
      : // 소수점 둘째 자리까지 — 배율이 세 자리라 26 * 0.838 처럼 나누어떨어지지 않고,
        // 브라우저는 소수 fontSize를 그대로 쓴다(반올림하면 작은 base에서 보정이 사라진다).
        { fontSize: Math.round(baseFontSize * scale * 100) / 100 }),
  };
}

/**
 * QuoteFont 값 → 폰트 스택. 'auto'는 여기 없다 — `userTextFont`가 한글 여부로 hand/latin
 * 중 하나로 먼저 풀고 들어온다. 'latin'은 피커에 없는 내부 키(라틴 auto의 도착지)다.
 * weight 400 고정은 이 폰트들이 전부 단일 웨이트라 600/500을 상속하면 합성 볼드가 되어
 * 옆에 선 장식 라벨과 톤이 갈리기 때문이다(#391부터의 이유, 9택에서도 같다).
 */
const USER_TEXT_FONTS = {
  latin: { fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400 },
  gothic: { fontFamily: FONT_KR, fontStyle: 'normal', fontWeight: 400 },
  batang: { fontFamily: FONT_BATANG, fontStyle: 'normal', fontWeight: 400 },
  hand: { fontFamily: FONT_QUOTE_KR, fontStyle: 'normal', fontWeight: 400 },
  ink: { fontFamily: FONT_INK, fontStyle: 'normal', fontWeight: 400 },
  eunyoung: { fontFamily: FONT_EUNYOUNG, fontStyle: 'normal', fontWeight: 400 },
  brush: { fontFamily: FONT_BRUSH, fontStyle: 'normal', fontWeight: 400 },
  coolguy: { fontFamily: FONT_COOLGUY, fontStyle: 'normal', fontWeight: 400 },
  flower: { fontFamily: FONT_FLOWER, fontStyle: 'normal', fontWeight: 400 },
} as const satisfies Record<string, CSSProperties>;

type UserTextFontKey = keyof typeof USER_TEXT_FONTS;

/**
 * 서체별 체감 크기 보정 배율(#437) — `bun scripts/measure-font-metrics.mjs`의 실측값이다.
 * 그 스크립트가 단일 소스이고, 폰트를 더하거나 갈아치우면 **다시 돌려서 이 표를 갱신**한다.
 *
 * 재는 값은 OS/2의 sxHeight/sCapHeight가 아니라 캔버스 잉크 박스다. 실측에서 잉크립퀴드체와
 * KCC은영체는 OS/2 두 값이 **모두 0**이었고(제작사 미기입), 애초에 한글은 라틴 x-height가
 * 체감 크기를 대표하지 않는다 — 한글 음절은 em 사각형을 채우는 글자면이라, 같은 fontSize에서
 * 커 보이고 작아 보이는 건 그 글자면이 em의 몇 %를 쓰느냐다. 그래서 대표 음절 10자의 세로
 * 잉크 높이 평균(em 200 기준)을 재고, 라틴도 cap-height 하나가 아니라 어센더~디센더가 다
 * 걸리는 10자 평균으로 잰다(붓글씨는 대문자가 작은 대신 디센더가 길어 cap만 보면 1.5배로
 * 잘못 키우게 된다).
 *
 * 기준이 축마다 다른 건 `auto`의 도착지가 다르기 때문이다 — 한글은 hand(아이스자람체),
 * 라틴은 display(Instrument Serif)를 1.000으로 둬서, **기존 저장본의 렌더가 안 변한다.**
 *
 * 확대만 1.25에서 자른다(hand·brush·flower의 라틴이 걸렸다: 원시 1.252·1.353·1.468).
 * 줄이는 쪽은 어떤 무드의 텍스트 예산도 안 깨지지만 키우는 쪽은 깬다 — Criterion 한줄평은
 * fontSize 50이 600px 슬롯에 서고(#577이 overflowWrap으로 겨우 가둔 자리다) 서명은 무드마다
 * nowrap + ellipsis 예산이 잡혀 있다. 남는 오차는 최대 17%.
 *
 * 2026-08-26 실측(Chrome, em 200 기준 세로 잉크 높이):
 *   한글  hand 139.84 · eunyoung 148.32 · flower 152.34 · coolguy 154.60 · ink 154.92 ·
 *         brush 157.08 · gothic 166.93 · batang 184.68
 *   라틴  flower 88.86 · brush 96.42 · hand 104.24 · coolguy 104.72 · eunyoung 105.40 ·
 *         ink 114.12 · batang 125.54 · gothic 130.16 · display 130.48
 */
const HANGUL_SIZE_SCALE: Partial<Record<UserTextFontKey, number>> = {
  hand: 1,
  gothic: 0.838,
  batang: 0.757,
  ink: 0.903,
  eunyoung: 0.943,
  brush: 0.89,
  coolguy: 0.905,
  flower: 0.918,
};

const LATIN_SIZE_SCALE: Partial<Record<UserTextFontKey, number>> = {
  latin: 1,
  hand: 1.25,
  gothic: 1.002,
  batang: 1.039,
  ink: 1.143,
  eunyoung: 1.238,
  brush: 1.25,
  coolguy: 1.246,
  flower: 1.25,
};

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

/** ChainStamp·FormatStamp·TextStamp가 FieldTap의 cloneElement 대상일 때 role/tabIndex/aria-label 등을
 *  실제 렌더 루트(img/div)로 흘려보내는 통로(#646) — 렌더 브랜치가 갈려도(placeholder/이미지/텍스트)
 *  어느 쪽이든 같은 방식으로 받는다. */
type StampInteractiveProps = HTMLAttributes<HTMLElement>;

interface ChainStampProps extends StampInteractiveProps {
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
  /** 절대 폭 상한(px, #589·#590) — FormatStamp와 동일 계약. 로고는 폭 클램프, 텍스트 라벨은 폰트
   *  축소(TextStamp)로 지킨다. 미지정이면 STAMP_MAX_ASPECT만 걸고 라벨은 자연폭 그대로. */
  maxWidth?: number;
  /**
   * 실제 렌더 높이(px) 리포트(#505, Poster의 onTopBandHeight와 동일 패턴). stampHeightDelta로
   * 로고 종횡비에 따라 ±16px 변하는 최종 높이를 그대로 콜백에 넘긴다 — 별도 DOM 실측(ref+
   * ResizeObserver) 없이 이미 계산 중인 값을 재사용. 렌더 안 함(null)이면 0을 리포트한다.
   */
  onRenderedHeight?: (h: number) => void;
}

const LOGO_SHADOW = 'drop-shadow(0 2px 8px rgba(0,0,0,0.85))';
const TEXT_SHADOW = '0 2px 8px rgba(0,0,0,0.85)';

/**
 * 폭 상한에 걸린 텍스트 라벨의 폰트 하한(#590). 11px은 Editorial 스텁이 이미 쓰는 가장 작은
 * 라벨 크기('Édition Spéciale')라 브랜드명이 그 자리에서 이물감 없이 서는 선이다.
 *
 * ponytail: 이 하한에서 스텁 상한(64px) 안에 드는 건 대략 7자까지다('MEGABOX'가 60px으로 실측
 * — 하네스 LABEL_24를 7자로 바꿔 확인). 더 긴 라벨은 ellipsis가 받는데, 하한을 더 내려도 못
 * 담는다(9px×9자 ≈ 70px) — 스탬프 몫이 길이축 예산에서 72px뿐인 게 진짜 천장이라, 그걸 늘리려면
 * 다른 그룹(바코드 286 등)에서 가져와야 한다.
 */
const TEXT_STAMP_MIN_SIZE = 11;

/**
 * 로고 텍스트 fallback 스탬프(#141 (7)). 이미지가 없고 라벨만 있을 때 브랜드 워드마크처럼
 * 렌더한다. dashed placeholder와 달리 **export에 포함**된다(data-hide-on-export 없음) —
 * 라벨은 사용자가 의도한 실제 콘텐츠이기 때문. 색은 currentColor(무드 잉크)를 따라가고,
 * dark surface(35mm 등 포스터 위)에선 가독성을 위해 text-shadow를 얹는다.
 *
 * `maxWidth`(#590)를 받은 무드는 폭 상한을 **폰트 축소로** 지킨다 — 로고는 objectFit:contain이라
 * 상한에 걸려도 줄어들 뿐이지만, 텍스트는 상한만 걸면 브랜드명이 ellipsis로 잘려 열화가 눈에
 * 띈다. 그래서 좌석 폭 맞춤(#381)과 같은 순서다: fitFontSizeToWidth로 먼저 줄이고, 하한에서도
 * 안 들어가면 span의 overflow+ellipsis가 최종 방어선. 상한을 안 넘긴 라벨('CGV' 등)은 이 경로가
 * maxSize를 그대로 돌려주므로 크기가 안 변한다.
 */
function TextStamp({
  label,
  height,
  size,
  surface,
  maxWidth,
  ...rest
}: {
  label: string;
  height: number;
  size: number;
  surface: Surface;
  maxWidth?: number;
} & StampInteractiveProps) {
  const fontsReady = useFontsReady();
  const baseSize = Math.round(height * 0.46);
  const baseLetterSpacing = 1.5 * size;
  // letterSpacing은 fitFontSizeToWidth가 측정에 안 넣는다(호출부 값이 전부 ≤0이라는 전제) — 여기선
  // 양수라 글자당 한 번씩 붙는 몫을 예산에서 먼저 뺀다. 측정 문자열도 실제 렌더대로 대문자.
  const fontSize =
    maxWidth === undefined
      ? baseSize
      : fitFontSizeToWidth(
          label.toUpperCase(),
          maxWidth - baseLetterSpacing * label.length,
          // min(하한, base) — scale 0.6의 포맷 스탬프는 base가 10px까지 내려가, 하한을 그대로 두면
          // 상한에 걸린 라벨이 base보다 커진다(fitFontSizeToWidth는 안 들어가면 minSize를 준다).
          { fontFamily: FONT_SANS, fontWeight: 800, minSize: Math.min(TEXT_STAMP_MIN_SIZE, baseSize), maxSize: baseSize },
          fontsReady,
        );
  // 자간도 축소분만큼 같이 줄인다. 1.5×size는 base 크기(22~29px) 기준의 트래킹이라 11px에서
  // 그대로 두면 자간이 글자 폭의 18%까지 차지해, 'MEGABOX'가 상한을 1px 넘겨 ellipsis로 잘렸다
  // (`--long-label`로 실측). 예산은 위에서 **축소 전** 자간으로 잡았으니 이 비례 축소는 언제나
  // 상한 안쪽으로만 움직인다(fontSize ≤ baseSize이므로 실렌더 폭 ≤ 예산).
  const letterSpacing = baseLetterSpacing * (fontSize / baseSize);
  return (
    <div
      {...rest}
      style={{
        height,
        maxWidth,
        display: 'flex',
        alignItems: 'center',
        fontSize,
        fontWeight: 800,
        fontFamily: FONT_SANS,
        letterSpacing,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        color: 'currentColor',
        lineHeight: 1,
        ...(surface === 'dark' ? { textShadow: TEXT_SHADOW } : {}),
      }}
    >
      {/* minWidth:0이 없으면 flex item이 min-content(=nowrap 전체 폭) 아래로 안 줄어들어 상한을
          넘겨 삐져나온다. 상한 없는 무드는 컨테이너 폭이 auto라 이 span이 아무것도 안 바꾼다. */}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
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
  ...rest
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
} & HTMLAttributes<HTMLDivElement>) {
  // 고스트 시인성 개선(#313): 박스 opacity(0.4)가 테두리·텍스트 색의 자체 알파와 곱연산으로 겹쳐
  // dark surface에서 실효 알파가 테두리 0.2·텍스트 0.28까지 떨어졌었다. 박스 opacity를 0.65로 올리고
  // (paper: currentColor 알파 1 × 0.65 = 0.65), dark 오버라이드의 자체 알파도 함께 올려(0.5→0.85,
  // 0.7→0.95) 곱연산 후 실효 알파가 테두리 ~0.55·텍스트 ~0.62로 나오게 재배분했다.
  // dim(#369)은 새 색을 만들지 않고 같은 값들의 알파만 낮춘다(0.65→0.3, 0.85→0.35, 0.95→0.45).
  return (
    <div
      {...rest}
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
        ...(surface === 'dark'
          ? dim
            ? { borderColor: 'rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.45)' }
            : { borderColor: 'rgba(255,255,255,0.85)', color: 'rgba(255,255,255,0.95)' }
          : { color: 'currentColor' }),
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
  ...rest
}: {
  text?: string;
  width?: number | string;
  height?: number;
  size?: number;
  surface?: Surface;
  state?: FieldGhostState;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <DashedPlaceholder
      text={text}
      width={width}
      height={height}
      size={size}
      surface={surface}
      dim={state ? state.dim : false}
      hasValue={state ? state.hasValue : false}
      {...rest}
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
  maxWidth,
  onRenderedHeight,
  ...rest
}: ChainStampProps) {
  // Rules of Hooks — stampWillRender의 조기 return보다 앞에서 무조건 호출(#392).
  // 낭비 로드 방지용 active 게이팅(#190 nit)은 필요 없어졌다 — 로드하는 <img>가 곧 렌더되는
  // <img>라, 안 그려지면 로드도 없다(#539).
  const willRender = stampWillRender(visible, chain, label, ghost);
  const { aspect, imgProps } = useNaturalAspect(chain);
  // 무드 고정 size(디자인 상수)와 사용자 조작 scale(#441)을 분리해 받되, 실제 렌더 계산은
  // 곱연산 결합값 하나로 통일 — 아래 h·placeholder·라벨이 전부 같은 비율로 스케일된다.
  const scaledSize = size * scale;
  // delta도 스케일 — 아니면 size가 작은 무드(Stub·Editorial)에서 ±16px가 base height 대비
  // 훨씬 큰 상대 변화를 만들어 이 PR이 피하려는 회귀 카테고리를 좁은 size에서 재현한다(claude-review
  // PR #408 P1, 2차 라운드).
  const h = (height + stampHeightDelta(aspect)) * scaledSize;
  // early return(willRender===false) 전에 계산·리포트 — Rules of Hooks(#392)와 동일 이유로
  // useEffect도 조기 return보다 앞에 둔다. 렌더 안 하는 프레임은 0을 리포트해 StampRow의
  // 구분선이 사라진 스탬프 높이에 걸려 남지 않게 한다.
  useEffect(() => {
    onRenderedHeight?.(willRender ? h : 0);
  }, [onRenderedHeight, willRender, h]);
  // null 판정을 stampWillRender로 일원화(무드 구분선 게이팅과 동일 조건). 여기를 통과하면
  // 이미지·라벨·placeholder(ghost!==false) 중 하나는 반드시 렌더된다.
  if (!willRender) return null;

  // 노출 off(#369) — 여기 도달했으면 ghost===true(stampWillRender 계약). 이미지·라벨이 있어도
  // 노출하지 않고 흐린 placeholder + 값 존재 배지로만 암시한다(탭→재노출 #266 유지).
  if (visible === false) {
    return <DashedPlaceholder {...rest} text="LOGO" width={capW(120 * scaledSize, maxWidth)} height={h} size={scaledSize} surface={surface} dim hasValue={!!(chain || label)} />;
  }

  // 우선순위: 이미지 > 텍스트 라벨 > dashed placeholder(미리보기 전용, ghost!==false 보장됨).
  if (chain) {
    return (
      <img
        {...imgProps}
        {...rest}
        src={chain}
        alt="Theater Chain"
        style={{
          height: h,
          width: 'auto',
          maxWidth: capW(h * STAMP_MAX_ASPECT, maxWidth),
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
    return <TextStamp {...rest} label={label} height={h} size={scaledSize} surface={surface} maxWidth={maxWidth} />;
  }

  return <DashedPlaceholder {...rest} text="LOGO" width={capW(120 * scaledSize, maxWidth)} height={h} size={scaledSize} surface={surface} />;
}

interface FormatStampProps extends StampInteractiveProps {
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
  /** 절대 폭 상한(px, #589·#590) — ChainStamp와 동일 계약(로고는 폭 클램프, 라벨은 폰트 축소). */
  maxWidth?: number;
  /** 실제 렌더 높이(px) 리포트(#505) — ChainStamp의 onRenderedHeight와 동일 계약. */
  onRenderedHeight?: (h: number) => void;
}

export function FormatStamp({
  format,
  label,
  size = 1,
  scale = 1,
  surface = 'paper',
  visible,
  ghost,
  maxWidth,
  onRenderedHeight,
  ...rest
}: FormatStampProps) {
  // ChainStamp와 동일 — Rules of Hooks(#392).
  const willRender = stampWillRender(visible, format, label, ghost);
  const { aspect, imgProps } = useNaturalAspect(format);
  // ChainStamp와 동일 — 무드 고정 size와 사용자 scale(#441)을 곱연산 결합값 하나로 통일.
  const scaledSize = size * scale;
  // delta도 스케일 — ChainStamp와 동일 이유(claude-review PR #408 P1, 2차 라운드).
  const h = (64 + stampHeightDelta(aspect)) * scaledSize;
  // ChainStamp와 동일 — 조기 return 전에 리포트(#505).
  useEffect(() => {
    onRenderedHeight?.(willRender ? h : 0);
  }, [onRenderedHeight, willRender, h]);
  // null 판정을 stampWillRender로 일원화(무드 구분선 게이팅과 동일 조건). 통과하면
  // 이미지·라벨·placeholder(ghost!==false) 중 하나는 반드시 렌더된다.
  if (!willRender) return null;

  // 노출 off(#369) — ChainStamp와 동일: 값이 있어도 흐린 placeholder + 배지로만 암시.
  if (visible === false) {
    return <DashedPlaceholder {...rest} text="FORMAT" width={capW(140 * scaledSize, maxWidth)} height={h} size={scaledSize} surface={surface} dim hasValue={!!(format || label)} />;
  }

  // 우선순위: 이미지 > 텍스트 라벨 > dashed placeholder(미리보기 전용, ghost!==false 보장됨).
  if (format) {
    return (
      <img
        {...imgProps}
        {...rest}
        src={format}
        alt="Screening Format"
        style={{
          height: h,
          width: 'auto',
          maxWidth: capW(h * STAMP_MAX_ASPECT, maxWidth),
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
    return <TextStamp {...rest} label={label} height={h} size={scaledSize} surface={surface} maxWidth={maxWidth} />;
  }

  return <DashedPlaceholder {...rest} text="FORMAT" width={capW(140 * scaledSize, maxWidth)} height={h} size={scaledSize} surface={surface} />;
}

export interface StampRowProps {
  chain: string;
  chainLabel?: string;
  chainVisible: boolean;
  /** ChainStamp의 height prop — 무드마다 고정값(39~74)이 다르다. */
  chainHeight: number;
  chainScale?: number;
  format: string;
  formatLabel?: string;
  formatVisible: boolean;
  /** FormatStamp의 size prop. */
  formatSize?: number;
  formatScale?: number;
  surface: Surface;
  ghost?: boolean;
  onField?: (field: SheetTarget) => void;
  /** 구분선 색 (무드 잉크 색상 변수를 그대로 넘긴다). */
  dividerColor: string;
  /** 구분선 opacity — 무드마다 0.35~0.55로 다르다. */
  dividerOpacity: number;
}

/**
 * Chain+format 스탬프 쌍 + 사이 구분선(#505). 5개 무드(Stub·Criterion·35mm·35mm Wide·Minimal —
 * Editorial은 세로 스택+dot이라 별도)가 각자 하드코딩 상수로 구분선 height를 그리던 걸 공유 추출.
 *
 * 구분선이 어긋나던 원인은 stampHeightDelta(로고 종횡비에 따라 ±16px)로 두 스탬프의 실제 렌더
 * 높이가 갈리는데 구분선은 무드별 고정 상수였던 것 — ChainStamp/FormatStamp가 onRenderedHeight로
 * 그 계산값(이미 자기 내부에서 구하는 h)을 그대로 리포트하게 하고, 구분선 height를 둘 중 큰 값에
 * 맞춘다(Poster의 onTopBandHeight와 동일 패턴, 별도 DOM 실측 불필요).
 *
 * 바깥 flex 컨테이너(gap·marginBottom·position 등 무드마다 다른 값)는 각 무드가 계속 소유하고,
 * 이 컴포넌트는 "체인 + 구분선 + 포맷" 세 조각만 Fragment로 반환한다.
 */
export function StampRow({
  chain,
  chainLabel,
  chainVisible,
  chainHeight,
  chainScale = 1,
  format,
  formatLabel,
  formatVisible,
  formatSize = 1,
  formatScale = 1,
  surface,
  ghost,
  onField,
  dividerColor,
  dividerOpacity,
}: StampRowProps) {
  const [chainH, setChainH] = useState(0);
  const [formatH, setFormatH] = useState(0);
  const bothStamps =
    stampWillRender(chainVisible, chain, chainLabel, ghost) &&
    stampWillRender(formatVisible, format, formatLabel, ghost);

  return (
    <>
      <FieldTap field="chain" onField={onField}>
        <ChainStamp
          chain={chain}
          label={chainLabel}
          visible={chainVisible}
          height={chainHeight}
          surface={surface}
          ghost={ghost}
          scale={chainScale}
          onRenderedHeight={setChainH}
        />
      </FieldTap>
      {bothStamps && (
        <span
          data-stamp-divider="true"
          style={{ width: 1, height: Math.max(chainH, formatH), background: dividerColor, opacity: dividerOpacity, flexShrink: 0 }}
        />
      )}
      <FieldTap field="format" onField={onField}>
        <FormatStamp
          format={format}
          label={formatLabel}
          visible={formatVisible}
          size={formatSize}
          surface={surface}
          ghost={ghost}
          scale={formatScale}
          onRenderedHeight={setFormatH}
        />
      </FieldTap>
    </>
  );
}

/**
 * 서명 이미지(#484) — ChainStamp/FormatStamp와 동일한 image 렌더 규칙(scaledSize = height * scale,
 * STAMP_MAX_ASPECT 폭 클램프, dark surface 그림자)만 뽑아 쓴다. label 문구·텍스트 폴백·ghost
 * placeholder는 무드마다 타이포가 달라(#484 c5) 각 무드가 계속 소유하고, 이미지가 있을 때만 호출된다.
 */
export function SignatureStamp({
  image,
  height,
  scale = 1,
  surface = 'paper',
  ...rest
}: {
  image: string;
  height: number;
  scale?: number;
  surface?: Surface;
} & ImgHTMLAttributes<HTMLImageElement>) {
  const h = height * scale;
  return (
    <img
      {...rest}
      src={image}
      alt="Signature"
      style={{
        height: h,
        width: 'auto',
        maxWidth: h * STAMP_MAX_ASPECT,
        objectFit: 'contain',
        display: 'block',
        ...(surface === 'dark' ? { filter: LOGO_SHADOW } : {}),
      }}
      draggable={false}
      crossOrigin="anonymous"
    />
  );
}

interface PosterProps {
  /**
   * 포스터 없음(null)은 정상 상태다 — 사용자가 포스터를 안 주거나, 단색 바탕만 쓰는 무드.
   * 그때는 아래 `background`만 칠하고 <img>를 아예 안 그린다(빈 문자열 src가 아니다: 브라우저가
   * 문서 URL을 다시 받아오고, captureToImage의 decodeImage가 naturalWidth 0을 '깨진 이미지'로
   * 보고 캡처를 통째로 중단시킨다).
   */
  src: string | null;
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
  /**
   * 형압 마스크(#509) — 사용자가 브러시로 칠한 원형 스탬프 목록(포스터 자연 0..1 분율 좌표,
   * c7). 비었거나 미지정이면 오버레이 자체를 렌더하지 않는다(빈 SVG를 안 굽는다).
   */
  embossStamps?: EmbossStamp[];
  /**
   * 자석 올가미(#509 2단계, c10) 닫힌 다각형 목록(포스터 자연 0..1 분율 좌표, embossStamps와
   * 같은 좌표계). 브러시와 동시에 있어도 같은 비트맵 한 장으로 함께 굽는다.
   */
  embossPaths?: EmbossPath[];
  /** 형압 강도 0..1(#509) — material/coatingIntensity와 동일 계약. 미지정 시 1. */
  embossIntensity?: number;
  /** 볼록 압인 마스크(#732 d2 · #735) — embossStamps와 나란한 두 번째 벌, 같은 좌표계·게이트 규율. */
  reliefStamps?: EmbossStamp[];
  reliefPaths?: EmbossPath[];
  /** 볼록 압인 강도 0..1(#735). 미지정 시 1. */
  reliefIntensity?: number;
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
 * 풀블리드 contain 무드의 frameInsetY 값(#449 claude-review P2) — 20~25px 블러 레터박스 노출
 * 목표의 중간값. 세 무드(Minimal·Criterion·35mm)가 각자 22를 하드코딩하던 걸 단일 소스로 뽑았고,
 * v5(#524)에서 Criterion·35mm이 고정 비율 컷/도판으로 바뀌며 인셋 0이 돼(강제 띠 = 레터박스 0
 * 파괴) 지금 소비자는 Minimal 하나다. 상수는 다음 풀블리드 무드를 위해 남긴다.
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
 * 포스터 fit 공통 정책(#440 → #525) — 무드가 제각각 하드코딩하던 fit/align/letterbox 배경을 한 곳으로.
 * **풀블리드 슬롯 전용 계약**이다. v5(#524)의 고정 비율 컷 무드(35mm·35mm Wide·Criterion)는 이 헬퍼를
 * 안 태우고 Poster를 직접 부르는데, 정책 이탈이 아니라 frameInsetY(강제 블러 띠)·letterboxBg 같은
 * 옵션이 고정 비율 컷엔 의미가 없고 frameInsetY를 실으면 그게 곧 레터박스 0을 깨뜨리기 때문이다
 * (fit 자체는 헬퍼와 같은 contain — 근거는 Mood35mm.tsx의 포스터 컷 주석).
 * 기본은 **무손실(contain)** — 포스터를 좌우 안 잘리게 통째로 넣고 남는 공간은 blur 배경 +
 * 무드 배경색(letterboxBg)이 흡수한다. align은 세로 슬롯에서 레터박스를 어디로 몰지
 * (top=하단 스크림이 흡수) 무드가 정한다.
 *
 * fit='cover'(#527)는 그 기본을 사용자가 명시적으로 뒤집는 옵션 — 슬롯을 꽉 채우고 넘치는 축을
 * 잘라낸다. #525가 폐지한 건 이 동작 자체가 아니라 **크롭 모달 토글이 그걸 겸하던 자리**다:
 * 사용자가 방금 0.667로 잡은 프레임이 결과에선 말없이 잘려 크롭 화면과 어긋났다. 지금은 크롭이
 * 항상 포스터 표준으로 확정되고, 이 축은 DESIGN '크기' 섹션에서 프리뷰를 보며 즉시 되돌릴 수
 * 있는 렌더 옵션으로만 선다. cover면 레터박스가 아예 없으므로 그 위에 세운 장치
 * (blur 배경 #440 · 페더 #459 · frameInsetY #449 · 상단 밴드 톤 #461)는 전부 무의미해지는데,
 * 그 게이트는 여기가 아니라 Poster 안에 산다 — 헬퍼를 안 태우는 무드(#524 고정 비율 컷)까지
 * 포함해 모든 호출자가 거기로 모이므로, 같은 판정을 여기서 한 번 더 하면 갈래만 늘어난다.
 */
export function posterFitProps(
  opts: { letterboxBg: string; align?: 'center' | 'top'; frameInsetY?: number; fit?: 'contain' | 'cover' },
): { fit: 'contain' | 'cover'; align: 'center' | 'top'; background: string; frameInsetY?: number } {
  return { fit: opts.fit ?? 'contain', align: opts.align ?? 'center', background: opts.letterboxBg, frameInsetY: opts.frameInsetY };
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
  embossStamps,
  embossPaths,
  embossIntensity = 1,
  reliefStamps,
  reliefPaths,
  reliefIntensity = 1,
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
  const [boxSize, setBoxSize] = useState<{ w: number; h: number } | null>(null);
  // 자연 종횡비는 아래 전경 <img>가 이미 로드한 값을 그대로 읽는다(onLoad + 캐시 히트용 complete
  // 체크). 같은 src를 new Image()로 한 번 더 디코드하던 프로브를 없앤다(#526 ①) — 마운트당 1회,
  // 에디터 프리뷰와 결과 렌더러가 따로 마운트되므로 최소 2회였다. fit 토글(cover↔contain, #527)에도
  // 값이 유지돼 되돌린 첫 프레임부터 featherMask가 선다(예전엔 active가 뒤집혀 재디코드 1회 + 마스크
  // 없는 프레임 1장). 스탬프(ChainStamp/FormatStamp)도 #539에서 같은 패턴으로 따라왔다 — 로고
  // <img>를 안 그리는 분기(노출 off의 dim placeholder)는 보정 없이 고정 높이로 서는 게 맞다는
  // 판정이라, 두 곳이 같은 메커니즘 하나(useNaturalAspect)로 통일됐다.
  const { aspect: natAspect, ref: posterRef, imgProps: posterImgProps } = useNaturalAspect(src);
  // fit 게이트 없이 항상 측정한다(#509 재매핑) — cover도 embossContentFrac(아래)에 img 박스 크기가
  // 필요하다. fit==='contain'에서만 쓰던 featherMask/topBandHeight는 여전히 자기 조건에서 fit을
  // 명시적으로 검사하므로(아래) cover에서 boxSize가 non-null이어도 동작이 안 바뀐다.
  useEffect(() => {
    const el = posterRef.current;
    if (!el) {
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

  // 형압 콘텐츠 사각형(#509 재매핑) — boxSize(img 박스, contain이면 frameInsetY만큼 이미 줄어든
  // 크기)와 frameInsetY로 root(포스터 박스) 높이를 되돌린 뒤, posterContentFrac이 fit/align까지
  // 반영해 "자연 이미지가 root 박스의 어디에 해당하는지"를 분율로 낸다. EmbossOverlay가 이 값으로
  // 자연 분율 스탬프를 지금 박스 분율로 투영한다(projectEmbossStamps). boxSize/natAspect가 아직
  // 없으면(첫 페인트 전) null — EmbossOverlay는 그동안 마스크를 안 그린다(SSR 불변식 유지).
  const effFrameInsetY = fit === 'contain' ? frameInsetY : 0;
  const embossContentFrac =
    boxSize && boxSize.w > 0 && boxSize.h > 0 && natAspect
      ? posterContentFrac(boxSize.w, boxSize.h + effFrameInsetY * 2, effFrameInsetY, boxSize.h, natAspect, fit, 0.5, align === 'top' ? 0 : 0.5)
      : null;

  return (
    <div
      aria-hidden="true"
      // data-poster-root(#439): 캡처 시 html-to-image의 foreignObject 경로가 iOS Safari에서
      // 큰 raster를 떨어뜨리므로, captureToImage가 이 포스터 서브트리(배경색 div + 포스터 <img>들)를
      // 통째로 제외하고 대신 canvas 2D로 직접 합성한다. 이 div의 background(#0a0a0a)까지 함께
      // 빠져야 그 자리가 '투명 구멍'으로 남아 합성한 포스터가 비쳐 보인다.
      // 포스터가 없으면 이 속성을 안 단다 — captureToImage가 이 서브트리를 html-to-image에서
      // 제외하고 canvas로 재합성하는 건 "여기 포스터 래스터가 들어온다"는 전제이고, 재합성할
      // 이미지가 없으면 그 자리가 배경도 없는 구멍으로 남는다. 속성이 없으면 평범한 배경 div라
      // 캡처가 그냥 그린다.
      data-poster-root={src ? 'true' : undefined}
      // 저장 경로(captureToImage.compositeOverlay)가 이 서브트리를 제외하고 canvas로 재합성하므로,
      // 오버레이의 material/coating·강도를 DOM 속성으로 실어보내 캡처가 상태 없이 DOM만으로 재현하게
      // 한다(#434 c1, #471, #475 c2 — 재질→코팅 순 2회 합성). 레시피 밖 값(material=original,
      // coating=none)은 해당 data-* 를 안 실어 compositeOverlay가 그 축을 건너뛴다.
      data-material={material && material !== 'original' && TEXTURE_RECIPES[material] ? material : undefined}
      data-material-intensity={materialIntensity}
      data-coating={coating && coating !== 'none' && TEXTURE_RECIPES[coating] ? coating : undefined}
      data-coating-intensity={coatingIntensity}
      // 형압(#509) — 같은 DOM-속성 규율로 저장 경로(compositeEmbossOverlay)에 마스크를 실어보낸다.
      // 스탬프가 없으면 안 실어 저장 경로가 그 축을 건너뛴다(material/coating과 동일 게이트 패턴).
      data-emboss-stamps={embossStamps && embossStamps.length ? JSON.stringify(embossStamps) : undefined}
      // 올가미(2단계) 다각형도 같은 규율 — 별도 data-* 로 실어 stamps와 독립적으로 게이트한다.
      data-emboss-paths={embossPaths && embossPaths.length ? JSON.stringify(embossPaths) : undefined}
      data-emboss-intensity={embossIntensity}
      // 볼록 압인(#732 d2 · #735) — 하이라이트와 나란한 두 번째 마스크 벌, 같은 data-속성 규율.
      data-relief-stamps={reliefStamps && reliefStamps.length ? JSON.stringify(reliefStamps) : undefined}
      data-relief-paths={reliefPaths && reliefPaths.length ? JSON.stringify(reliefPaths) : undefined}
      data-relief-intensity={reliefIntensity}
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
      {fit === 'contain' && src && (
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
        {src && (
          <img
            {...posterImgProps}
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
        )}
      </div>
      {/* z-order(#475 c2/c3): 재질 결(아래) → 코팅 광택(위). 코팅은 재질 CSS filter가 이미 적용된
          <img> 위에 얹히므로 "재질 최종색 위에 코팅 blend"(c3)가 DOM 순서 그대로 성립한다. */}
      {material && material !== 'original' && <TextureOverlay texture={material} intensity={materialIntensity} />}
      {coating && coating !== 'none' && <TextureOverlay texture={coating} intensity={coatingIntensity} />}
      {/* 형압(#509)·볼록 압인(#732 d2)은 재질·코팅 위(z-order 최상단)에 얹는다 — 실물 형압 다이는
          코팅(라미네이팅) 아래 종이 자체를 누르지만, 이 오버레이는 "융기부가 코팅 위로도 비쳐
          보이는" 단순화한 룩이라 가장 위가 자연스럽다(코팅 유무와 무관하게 항상 눈에 띔, c5 동시
          적용 요구와 부합). 볼록 압인을 먼저 그리는 이유(#735) — 종이가 물리적으로 눌린 모양(형압)이
          먼저 서고 그 위에 광원 반사(하이라이트)가 얹히는 순서가 실물과 같다. 같은 embossContentFrac
          을 재사용하는 이유는 두 효과가 같은 포스터 콘텐츠 사각형 위에 그려지기 때문 — 효과별로
          갈릴 이유가 없다. */}
      {((reliefStamps && reliefStamps.length > 0) || (reliefPaths && reliefPaths.length > 0)) && (
        <EmbossOverlay
          stamps={reliefStamps ?? []}
          paths={reliefPaths ?? []}
          intensity={reliefIntensity}
          contentFrac={embossContentFrac}
          bitmapSvg={reliefBitmapSvg}
          blend={RELIEF_RECIPE.blend}
        />
      )}
      {((embossStamps && embossStamps.length > 0) || (embossPaths && embossPaths.length > 0)) && (
        <EmbossOverlay
          stamps={embossStamps ?? []}
          paths={embossPaths ?? []}
          intensity={embossIntensity}
          contentFrac={embossContentFrac}
          bitmapSvg={embossBitmapSvg}
          blend={EMBOSS_RECIPE.blend}
        />
      )}
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

  // 코팅 광택(#434) — 저장 경로와 **같은 비트맵 한 장**을 그린다(#506 c1). 예전엔 여기가 CSS
  // linear-gradient 문자열이고 저장이 손으로 짠 sin/cos 투영이라 같은 레시피를 각자 유도했다.
  // intensity는 굽기가 아니라 레이어 알파로 곱한다(#506 c2) — 슬라이더를 끌어도 재굽기가 없고,
  // stop alpha에 곱하던 옛 방식과 최종 source alpha가 같아 합성 결과가 그대로다.
  return <GradientOverlay recipe={recipe} intensity={intensity} />;
}

// SSR/renderToStaticMarkup엔 레이아웃이 없어 useLayoutEffect가 경고만 남기므로 그때만 useEffect로 떨어뜨린다.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * gradient 오버레이. 굽기에 박스 종횡비가 필요해(`gradientLineEndpoints` 주석) 자기 rect을 재는데,
 * 페인트 **전에** 잡아 첫 프레임 깜빡임을 없앤다. 종횡비는 **raw로 넘긴다** — 반올림은
 * `gradientBitmapSvg`가 소유한다(여기서 따로 반올림하면 저장 경로와 캐시 키가 갈린다).
 *
 * **ResizeObserver를 쓰지 않는다.** TicketRenderer가 무드 트리를 자연 픽셀로 그리고 바깥에서
 * transform scale만 걸므로 이 박스는 리플로우하지 않고, 무드·레이아웃이 바뀌면 어차피 리렌더가
 * 온다. 실제로 옵저버를 달았더니 happy-dom 전역에 관측자가 쌓여 후가공과 무관한 크롭 테스트가
 * 깨졌고, bun test의 파일 순서가 실행마다 달라 재현이 갈렸다(#506 코멘트 · CLAUDE.md 🧪 #611).
 * 그래서 deps 없이 매 렌더 측정하되, 값이 같으면 setState를 건너뛰어 루프를 막는다.
 */
function GradientOverlay({
  recipe,
  intensity,
}: {
  recipe: Extract<TextureRecipe, { kind: 'gradient' }>;
  intensity: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const next = r.height / r.width;
    setAspect((prev) => (prev === next ? prev : next));
  });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...(aspect
          ? {
              backgroundImage: `url("${gradientBitmapSvg(recipe, aspect)}")`,
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }
          : null),
        mixBlendMode: recipe.blend,
        opacity: intensity,
      }}
    />
  );
}

/**
 * 형압/볼록 압인 베벨 오버레이(#509 · #732 d2) — GradientOverlay와 동일 패턴(박스 aspect를
 * bitmapSvg에 넘겨 저장 경로와 같은 비트맵을 그린다). ResizeObserver를 안 쓰는 이유도 GradientOverlay
 * 주석과 동일 — 무드 트리는 자연 픽셀 고정이라 리플로우하지 않는다.
 *
 * stamps는 자연 이미지 분율(#509 재매핑)이라 굽기 전 contentFrac(Poster가 계산해 넘긴다)으로
 * 지금 박스 분율로 투영한다(projectEmbossStamps) — compositeMaskOverlay(captureToImage.ts)가
 * export에서 쓰는 것과 같은 변환이라 미리보기=저장물이 유지된다. contentFrac이 아직 없으면(첫
 * 페인트 전) 마스크를 안 그린다.
 *
 * bitmapSvg/blend를 프롭으로 받아 하이라이트(embossBitmapSvg/EMBOSS_RECIPE)와 형압
 * (reliefBitmapSvg/RELIEF_RECIPE) 두 효과가 컴포넌트 하나를 공유한다(#735) — 레시피가 다를 뿐
 * 측정·투영·굽기 파이프라인은 동일하다.
 */
function EmbossOverlay({
  stamps,
  paths,
  intensity,
  contentFrac,
  bitmapSvg,
  blend,
}: {
  stamps: EmbossStamp[];
  paths: EmbossPath[];
  intensity: number;
  contentFrac: EmbossContentFrac | null;
  bitmapSvg: (stamps: EmbossStamp[], paths: EmbossPath[], rawAspect: number) => string;
  blend: TextureBlend;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const next = r.height / r.width;
    setAspect((prev) => (prev === next ? prev : next));
  });

  const boxStamps = contentFrac ? projectEmbossStamps(stamps, contentFrac) : null;
  const boxPaths = contentFrac ? projectEmbossPaths(paths, contentFrac) : null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        ...(aspect && boxStamps && boxPaths
          ? {
              backgroundImage: `url("${bitmapSvg(boxStamps, boxPaths, aspect)}")`,
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
            }
          : null),
        mixBlendMode: blend,
        opacity: intensity,
      }}
    />
  );
}

interface BarcodeProps extends HTMLAttributes<HTMLDivElement> {
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
  ...rest
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
      {...rest}
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

const KK_PATTERN = '31122112132113112212311213212112'.split('').map(Number);

/** 필름 계열(35mm · 35mm Wide) 공용 색 토큰 — v5 시안 하드코딩(#524 c8). themeColor 파생 아님. */
export const FILM_AMBER = '#a97433';
/** 스트립 본체(필름 베이스). */
export const FILM_BASE = '#0b0a09';
/** 스트립 바깥 암부(절단면 너머). */
export const FILM_DARK = '#050403';
export const FILM_INK = '#e9e7e2';
export const FILM_HOLE = '#e9e8e4';
/** 컷(프레임) 박스 공통 — 검은 바탕 + 안쪽 1px 암선 + 바깥 1px amber 헤어라인. */
export const CUT_SHADOW = 'inset 0 0 0 1px rgba(0,0,0,.9), 0 0 0 1px rgba(120,96,64,.18)';
/**
 * Criterion(Revue) 색 토큰 — v5 시안 하드코딩(#524 c8). 옐로는 시안이 정확히 5곳
 * (헤더 스퀘어 · 상단 룰 · ★ · 따옴표 쌍 · 콜로폰 짧은 룰)에만 쓴다. LayoutPicker 실루엣이
 * 같은 토큰을 참조하므로 무드 색을 고치면 썸네일도 같이 따라온다.
 */
export const CRITERION_YELLOW = '#f2c200';
/** 흰 종이 베이스. */
export const CRITERION_PAPER = '#fdfdfc';

/** 크레딧 컷 위 암부 그라디언트(포스터를 brightness(.34)로 깐 뒤 조판 대비 확보). */
const CREDIT_SCRIM = 'linear-gradient(180deg,rgba(5,4,3,.78) 0%,rgba(5,4,3,.9) 55%,rgba(5,4,3,.95) 100%)';

/**
 * 필름 키코드(KL 23 롤 로트+풋) — 시안 스크립트는 Math.random()으로 렌더마다 새로 만들지만
 * html-to-image가 캡처 시점에 DOM을 다시 그려 프리뷰와 결과물이 갈린다(#524 c2). 티켓 문자열
 * 시드로 결정론화해 같은 티켓이면 항상 같은 코드가 나오게 한다.
 */
export function buildFilmKeycode(seed: string): string {
  const h = seedFromString(seed || 'FILME');
  const roll = String(h % 10000).padStart(4, '0');
  const lot = String(Math.floor(h / 10000) % 10000).padStart(4, '0');
  const foot = ((h >>> 8) % 8) + 1;
  return `KL 23 ${roll} ${lot}+0${foot}`;
}

/** 프레임 번호 라벨(236+i → 118, 118A, 119…) — 시안 FilmStripBand·레일 공통. */
function frameLabel(i: number): string {
  const f = 236 + i;
  return f % 2 === 0 ? String(f >> 1) : `${f >> 1}A`;
}

/** KEYKODE 바코드 바(밴드 전용) — 잉크/여백 교대 폭 패턴. */
function keycodeBars(accent: string): ReactNode[] {
  let ink = true;
  return KK_PATTERN.map((w, i) => {
    const seg = <span key={i} style={{ width: w * 1.5, height: 8, background: ink ? accent : 'transparent', flexShrink: 0 }} />;
    ink = !ink;
    return seg;
  });
}

/** 엣지 스크롤 코드 셀(밴드·레일 공용) — 런을 EDGE_REPEAT회 반복해 전 구간을 채운다.
 *  FONT_LCD(Share Tech Mono)엔 한글 글리프가 없어 code 단위로 FONT_KR 폴백을 건다(#393). */
const EDGE_REPEAT = 4;
function edgeCells(codes: string[], accent: string): ReactNode[] {
  const cells: ReactNode[] = [];
  for (let r = 0; r < EDGE_REPEAT; r++)
    codes.forEach((code, i) => {
      cells.push(
        <span key={`${r}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, color: accent, fontWeight: 600, letterSpacing: 2.5 }}>
          <span style={containsHangul(code) ? { fontFamily: FONT_KR } : undefined}>{code}</span>
          <span style={{ margin: '0 15px', opacity: 0.5 }}>◆</span>
        </span>
      );
    });
  return cells;
}

/**
 * 천공 지터 테이블(#498) — 실물 필름은 펀치·수축으로 구멍 크기와 간격이 미세하게 어긋나는데 시안의
 * 완전 등간격(`space-between` + 동일 shape)은 공장제처럼 보였다. `Math.random`은 금지 — html-to-image가
 * 캡처 시점에 DOM을 다시 그려 프리뷰와 결과물이 갈린다(#524 c2와 같은 규약). `seedFromString`으로 key와
 * 인덱스만 받아 결정론적으로 만든다.
 *
 * `gap`은 각 홀의 양옆 margin(px)이라 `space-between`이 나눠줄 여유 폭을 홀마다 다르게 갉아 간격이
 * 흐트러진다. 밴드·레일의 프레임번호 열은 천공 열과 같은 테이블을 써야 두 열이 계속 맞물린다.
 */
function sprocketJitter(key: string, count: number, w: number, h: number) {
  const j = (axis: string, i: number, amp: number) => (seedFromString(`${key}${axis}${i}`) % (amp * 2 + 1)) - amp;
  return Array.from({ length: count }, (_, i) => ({ w: w + j('w', i, 2), h: h + j('h', i, 2), gap: j('g', i, 3) }));
}

/**
 * 35mm 필름 스트립 밴드(에픽 #281 → v5 재설계 #524). 밴드는 **3행**이다 — 천공 / 프레임번호 /
 * (KEYKODE 바+키코드 + 엣지 스크롤 코드 ×4, ◆ 구분) + 그레인. accent는 무드가 넘긴다. pos로 상/하단을
 * 뒤집는다 — 천공·프레임번호는 바깥 모서리, 엣지 행은 안쪽 모서리.
 *
 * v5 델타: 홀 치수·개수를 props로 열고(35mm Wide는 51×36 ×18, #498이 확정한 확대치), `bleed`로
 * 천공·프레임번호 행을 밴드 밖으로 흘려 좌우 절단면에서 반쯤 잘리게, `edgePrint=false`로 하단
 * 밴드는 프레임번호만 남긴다.
 *
 * #557: KEYKODE가 독립 4행째로 서 있었는데 92px 밴드엔 그 세로 예산이 없었다 —
 * `6 + 36(holeH) + 3 + 16.5(프레임) + 15(KEYKODE) + 18(엣지) + 6 = 100.5 > 92`라 KEYKODE 행 끝(77)이
 * 엣지 행 시작(68)을 9px 밀고 들어와 캡처 결과물까지 글자가 포개졌다. 적자가 8.5px라 오프셋을 어떻게
 * 재배분해도 4행으로는 안 풀린다. **KEYKODE를 엣지 행 안으로 넣어 3행으로 줄인다** — 실물 35mm도
 * 키코드와 엣지 인쇄가 같은 가장자리를 따라 이어 찍히고, 같은 flex 행의 형제라 키코드 길이나 바 패턴이
 * 바뀌어도 밀림 폭이 저절로 따라와 상수로 박아둔 x 오프셋처럼 어긋나지 않는다. 밴드 높이(92)·캔버스
 * 레이아웃·하단 밴드(edgePrint=false)·FilmRail은 안 건드린다(KEYKODE의 좌측 시작만 엣지 행 padding을
 * 따라 16→14px).
 */
export const FilmStripBand = memo(function FilmStripBand({
  pos,
  accent,
  codes,
  base = '#0a0a0a',
  height = 92,
  holeW,
  holeH,
  holeR,
  count,
  bleed,
  edgePrint = true,
  keycode,
}: {
  pos: 'top' | 'bottom';
  accent: string;
  /** 엣지 스크롤 코드 — edgePrint=false면 안 쓴다(그래서 optional). */
  codes?: string[];
  base?: string;
  height?: number;
  holeW: number;
  holeH: number;
  holeR: number;
  count: number;
  /** 천공·프레임번호 행을 밴드 좌우 밖으로 흘리는 폭(px) — 절단면에서 구멍이 반쯤 잘린다. */
  bleed: number;
  /** false면 KEYKODE·엣지 스크롤을 빼고 천공+프레임번호만(시안 5b 하단 밴드). */
  edgePrint?: boolean;
  /** edgePrint일 때만 쓰인다 — buildFilmKeycode로 티켓별 결정론 값을 넘긴다. */
  keycode?: string;
}) {
  const outer: 'top' | 'bottom' = pos;
  const inner: 'top' | 'bottom' = pos === 'top' ? 'bottom' : 'top';

  // 시드 키가 'band'로 고정 — 상/하 밴드는 같은 필름 스트립의 양 가장자리라 프레임 118의 천공이
  // 위아래 같은 x에 서야 한다. pos를 키로 주면 두 밴드가 다른 해시열을 얻어 스트립이 세로로 비틀린
  // 것처럼 보인다(FilmRail이 좌/우를 'rail'로 통일한 것과 같은 이유, #556 리뷰 P1).
  const jitter = sprocketJitter('band', count, holeW, holeH);
  const holes = jitter.map((j, i) => (
    <div key={i} style={{ width: j.w, height: j.h, margin: `0 ${j.gap}px`, borderRadius: holeR, background: FILM_HOLE, flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.5), inset 0 2px 4px rgba(0,0,0,.6)' }} />
  ));
  const frameNums = jitter.map((j, i) => (
    <span key={i} style={{ width: j.w, margin: `0 ${j.gap}px`, textAlign: 'center', fontFamily: FONT_LCD, fontSize: 11, fontWeight: 400, letterSpacing: 0.6, color: accent, flexShrink: 0 }}>{frameLabel(i)}</span>
  ));

  const bleedMargin = `0 ${-bleed}px`;
  // 세로 예산(#557): 바깥 모서리에서 BAND_PAD → 천공(holeH) → 3 → 프레임번호, 안쪽 모서리에서
  // BAND_PAD → 엣지 행. 3행이라 92px 안에 6.5px 여유를 남기고 선다.
  // ⚠️ 그 6.5px는 FONT_LCD 폴백 체인의 line-height:normal이 만드는 값이라 상수가 아니다 —
  // 아래 프레임 11px·엣지 12px fontSize를 올리거나 폰트 스택을 갈면 여유가 음수로 떨어져 두
  // 행이 다시 포개진다. 테스트는 코드가 소유한 오프셋만 고정하고 행 높이는 폰트 메트릭이라
  // happy-dom이 line box를 안 계산해 static markup으로는 원리적으로 못 잰다. 폰트·크기를
  // 건드리는 PR은 실브라우저에서 밴드를 눈으로 한 번 확인할 것.
  // 천공 행 높이를 holeH로 고정 — 지터로 커진 홀은 alignItems:center 덕에 위아래 1px씩만 넘치고,
  // 아래 행들의 오프셋 산수는 지터 진폭을 몰라도 된다(진폭을 바꿔도 프레임번호 행이 안 따라 어긋난다).
  const BAND_PAD = 6;
  const holesStyle: CSSProperties = { position: 'absolute', left: 0, right: 0, height: holeH, margin: bleedMargin, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' };
  holesStyle[outer] = BAND_PAD;
  const frameStyle: CSSProperties = { position: 'absolute', left: 0, right: 0, margin: bleedMargin, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', opacity: 0.88, pointerEvents: 'none' };
  frameStyle[outer] = BAND_PAD + holeH + 3;
  const edgeStyle: CSSProperties = { position: 'absolute', left: 0, right: 0, display: 'flex', alignItems: 'center', padding: '0 14px', fontFamily: FONT_LCD, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', opacity: 0.92, pointerEvents: 'none' };
  edgeStyle[inner] = BAND_PAD;
  const rootStyle: CSSProperties = { position: 'absolute', left: 0, right: 0, height, background: base, overflow: 'hidden' };
  rootStyle[outer] = 0;

  // 밴드 전체가 순수 장식 크롬(천공·프레임번호·KEYKODE·엣지 스크롤은 편집 필드가 아님) — 엣지 텍스트가 제목·
  // 서명을 복제하므로 aria-hidden으로 스크린리더가 티켓 필드처럼 중복해 읽지 않게 한다(#289 리뷰 P2).
  return (
    <div aria-hidden="true" style={rootStyle}>
      <div style={holesStyle}>{holes}</div>
      <div style={frameStyle}>{frameNums}</div>
      {/* 하단 밴드(edgePrint=false)는 이 조각을 아예 안 만든다 — 예전엔 kkBars 32개 + 엣지 셀
          4×codes를 만들고 버렸다. */}
      {edgePrint && (
        <div style={edgeStyle}>
          {/* KEYKODE는 엣지 스크롤의 앞 형제(#557) — 별도 행이 아니라 같은 줄 왼쪽에 서고, 뒤따르는
              엣지 코드는 이 블록 폭만큼 자동으로 밀린다. */}
          {/* opacity를 다시 얹지 않는다 — 엣지 행의 0.92와 곱해져 0.83으로 떨어진다(구 0.9 대비 8% 어둡다). */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginRight: 22 }}>
            <span style={{ display: 'flex', alignItems: 'flex-end' }}>{keycodeBars(accent)}</span>
            <span style={{ fontFamily: FONT_LCD, fontSize: 10, fontWeight: 400, letterSpacing: 1.6, color: accent }}>{keycode}</span>
          </span>
          {edgeCells(codes ?? [], accent)}
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, mixBlendMode: 'overlay', backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.06) 0 1px, rgba(0,0,0,.07) 1px 3px), repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, rgba(0,0,0,.05) 1px 3px)' }} />
    </div>
  );
});

/** 레일 가장자리↔천공 컬럼 간격 · 천공 컬럼 폭 · 천공↔프레임번호 컬럼 간격. */
const RAIL_PAD = 8;
const RAIL_HOLE_W = 36;
const RAIL_NUM_GAP = 6;

/**
 * 35mm 세로 레일(v5 시안 5a) — FilmStripBand를 90° 돌린 형태. 100px 폭 안에 천공(36×51) +
 * 프레임번호 세로 컬럼, 좌측 레일에만 엣지 프린트 세로 스크롤(실물도 편측 인쇄).
 * 천공/번호 컬럼은 위·아래로 24px 흘려 절단면에서 반쯤 잘린다.
 */
export const FilmRail = memo(function FilmRail({
  side,
  accent,
  codes,
  width = 100,
  count = 19,
}: {
  side: 'left' | 'right';
  accent: string;
  /** 좌측 레일 세로 엣지 프린트 코드. 우측 레일은 넘기지 않는다(편측 인쇄). */
  codes?: string[];
  width?: number;
  count?: number;
}) {
  const holeShadow = `inset 0 0 0 1px rgba(0,0,0,.55), inset ${side === 'left' ? 2 : -2}px 0 5px rgba(0,0,0,.5)`;
  // 좌우 레일이 같은 테이블을 쓴다 — 실물 천공은 한 번에 양쪽을 뚫으므로 같은 프레임번호가 양 끝에서
  // 같은 높이에 서야 한다. side로 갈라두면 중간쯤에서 최대 24px 어긋나 스트립이 비틀린 것처럼 보인다.
  const jitter = sprocketJitter('rail', count, RAIL_HOLE_W, 51);
  const colStyle = (offset: number, w: number): CSSProperties => ({
    position: 'absolute',
    [side]: offset,
    top: -24,
    bottom: -24,
    width: w,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  });
  return (
    <div aria-hidden="true" style={{ position: 'absolute', [side]: 0, top: 0, bottom: 0, width, overflow: 'hidden' }}>
      {/* alignItems는 천공 컬럼에만 건다 — 밴드가 천공 행 높이를 holeH로 고정한 것(#557)의
          세로판이다. 지터로 커진 홀이 컬럼 폭을 한쪽으로만 넘쳐 RAIL_NUM_GAP을 갉는 대신
          좌우로 반씩 넘치므로, 아래 프레임번호 컬럼 오프셋이 지터 진폭을 몰라도 된다.
          프레임번호 컬럼은 span 폭이 auto라 stretch(기본값)로 둬야 13px을 채워 세로 중앙에 선다. */}
      <div style={{ ...colStyle(RAIL_PAD, RAIL_HOLE_W), alignItems: 'center' }}>
        {jitter.map((j, i) => (
          <div key={i} style={{ width: j.w, height: j.h, margin: `${j.gap}px 0`, borderRadius: 9, background: FILM_HOLE, flexShrink: 0, boxShadow: holeShadow }} />
        ))}
      </div>
      <div style={colStyle(RAIL_PAD + RAIL_HOLE_W + RAIL_NUM_GAP, 13)}>
        {jitter.map((j, i) => (
          <span
            key={i}
            style={{ height: j.h, margin: `${j.gap}px 0`, display: 'flex', alignItems: 'center', writingMode: 'vertical-rl', ...(side === 'right' ? { transform: 'rotate(180deg)' } : null), fontFamily: FONT_LCD, fontSize: 11, letterSpacing: 0.6, color: accent, opacity: 0.88, flexShrink: 0 }}
          >
            {frameLabel(i)}
          </span>
        ))}
      </div>
      {codes && (
        // 밴드와 같은 edgeCells를 쓴다 — code 단위 FONT_KR 폴백(#393)이 레일에서도 그대로 산다.
        <div style={{ position: 'absolute', left: 68, top: -40, bottom: -40, width: 16, writingMode: 'vertical-rl', fontFamily: FONT_LCD, fontSize: 12, fontWeight: 600, letterSpacing: 2.5, color: accent, opacity: 0.92, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {edgeCells(codes, accent)}
        </div>
      )}
    </div>
  );
});

/**
 * 컷 머리 프레임 라벨(v5 시안 5a/5b 공용) — `FRAME 119` + amber 헤어라인. 두 무드가 축(top/left)과
 * 룰 폭만 달라 스타일 전체를 복붙하고 있었다. 순수 장식이라 aria-hidden.
 */
export function CutFrameLabel({ text, ruleWidth, style }: { text: string; ruleWidth: number; style: CSSProperties }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', display: 'flex', alignItems: 'center', gap: 12, ...style }}>
      <span style={{ fontFamily: FONT_LCD, fontSize: 13, letterSpacing: 2.5, color: FILM_AMBER }}>{text}</span>
      <span style={{ width: ruleWidth, height: 1, background: FILM_AMBER, opacity: 0.3 }} />
    </div>
  );
}

/** 필름 베이스 그레인 — 세로 스트립은 0deg, 가로 스트립은 90deg. */
export function FilmGrain({ axis }: { axis: 'vertical' | 'horizontal' }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(${axis === 'vertical' ? 0 : 90}deg, rgba(255,255,255,.016) 0 1px, rgba(0,0,0,.06) 1px 3px)` }} />
  );
}

/** 스트립 절단면 22px 그라디언트 한 쌍 — 세로 무드는 상/하, 가로 무드는 좌/우에서 잘린다. */
export function FilmCutEdges({ axis, inset }: { axis: 'vertical' | 'horizontal'; inset: number }) {
  const band = (side: 'top' | 'bottom' | 'left' | 'right', deg: number): CSSProperties =>
    axis === 'vertical'
      ? { position: 'absolute', left: 0, right: 0, [side]: inset, height: 22, background: `linear-gradient(${deg}deg, rgba(0,0,0,.72), rgba(0,0,0,0))`, pointerEvents: 'none' }
      : { position: 'absolute', top: 0, bottom: 0, [side]: inset, width: 22, background: `linear-gradient(${deg}deg, rgba(0,0,0,.72), rgba(0,0,0,0))`, pointerEvents: 'none' };
  return axis === 'vertical' ? (
    <>
      <div aria-hidden="true" style={band('top', 180)} />
      <div aria-hidden="true" style={band('bottom', 0)} />
    </>
  ) : (
    <>
      <div aria-hidden="true" style={band('left', 90)} />
      <div aria-hidden="true" style={band('right', 270)} />
    </>
  );
}

/**
 * 크레딧 컷(v5 시안 5a/5b 공용, #524) — 위 컷과 **같은 포스터를 상단정렬 cover**로 깔아 프레임
 * 중간에서 잘리게 하고(의도된 절단), 암부 그라디언트 위에 엔딩 크레딧을 조판한다. 구분선 0개.
 *
 * 두 무드가 이 블록을 통째로 공유하고 치수만 갈리므로(compact=35mm Wide) 조판을 여기 한 번만 둔다.
 * 병합 라벨(Exhibited·Screened·The Film)은 fieldPieces로 분해해 필드별 독립 탭 타깃 + 개별
 * ghost를 유지한다(#524 c3).
 */
export function FilmCreditCut({
  movieInfo: d,
  components,
  croppedImageUrl,
  fieldVisibility: fv,
  ghost,
  onField,
  compact = false,
  cutWidth,
}: MoodProps & { compact?: boolean; cutWidth: number }) {
  const { watchDateClean, releaseClean, reissueClean } = resolveTicketData(d);
  const titleVal = gate(fv?.title, d.title);
  const titleOgVal = gate(fv?.titleOg, d.titleOg);
  const actorsVal = truncateActors(gate(fv?.actors, d.actors));
  const signatureVal = gate(fv?.signature, d.signature);
  const ratingVisible = (fv?.rating ?? true) && d.rating > 0;

  const fontsReady = useFontsReady();
  const titleMax = compact ? 28 : 30;
  // 패딩은 이 컴포넌트가 소유한다 — 호출자가 좌우 패딩을 다시 빼서 넘기면 소스가 둘로 갈려,
  // 패딩을 손대는 순간 제목 자동 축소가 조용히 틀린 폭으로 맞춰진다.
  const padX = compact ? 30 : 36;
  // 2줄 클램프라 가용폭×2를 maxWidth로 넘겨 가장 긴 한 줄 기준으로 축소한다(#318 관례).
  const titleFontSize = fitFontSizeToWidth(titleVal, (cutWidth - padX * 2) * 2, { fontFamily: FONT_KR, fontWeight: 500, minSize: 17, maxSize: titleMax }, fontsReady);

  const labelStyle: CSSProperties = { textAlign: 'right', fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: 2.6, textTransform: 'uppercase', color: 'rgba(233,231,226,.45)' };
  const valueStyle: CSSProperties = { textAlign: 'left', fontSize: 17, fontWeight: 500, letterSpacing: -0.1, lineHeight: 1.25, fontFamily: FONT_KR };

  const exhibited = fieldPieces(
    [
      { field: 'theater', value: gate(fv?.theater, d.theater), ghost: showFieldGhost(fv?.theater, d.theater, ghost), label: 'THEATER' },
      { field: 'screen', value: gate(fv?.screen, d.screen), ghost: showFieldGhost(fv?.screen, d.screen, ghost), label: 'SCREEN' },
      { field: 'seat', value: gate(fv?.seat, d.seat), ghost: showFieldGhost(fv?.seat, d.seat, ghost), label: 'SEAT' },
    ],
    onField,
    { surface: 'dark' }
  );
  const screened = fieldPieces(
    [
      { field: 'watchDate', value: gate(fv?.watchDate, watchDateClean), ghost: showFieldGhost(fv?.watchDate, watchDateClean, ghost), label: 'DATE' },
      { field: 'watchTime', value: gate(fv?.watchTime, d.watchTime), ghost: showFieldGhost(fv?.watchTime, d.watchTime, ghost), label: 'TIME' },
    ],
    onField,
    { surface: 'dark' }
  );
  // The Film = 러닝타임 · 평점 · 개봉일 병합(시안). 재개봉은 값이 있을 때만 조각을 더한다(#524 c6) —
  // 편집 자리는 releaseDate 시트(reissue는 그 안에서)라 탭 타깃도 releaseDate로 둔다.
  const reissueVal = gate(fv?.reissue, reissueClean);
  const film = fieldPieces(
    [
      { field: 'runtime', value: gate(fv?.runtime, d.runtime), ghost: showFieldGhost(fv?.runtime, d.runtime, ghost), label: 'RUNTIME' },
      { field: 'rating', value: ratingVisible ? `★ ${d.rating.toFixed(1)}` : '', ghost: showFieldGhost(fv?.rating, d.rating > 0, ghost), label: 'RATED' },
      { field: 'releaseDate', value: gate(fv?.releaseDate, releaseClean), ghost: showFieldGhost(fv?.releaseDate, releaseClean, ghost), label: 'RELEASED' },
      ...(reissueVal ? [{ field: 'releaseDate' as SheetTarget, value: reissueVal, label: 'REISSUE' }] : []),
    ],
    onField,
    { surface: 'dark' }
  );

  const gActors = showFieldGhost(fv?.actors, d.actors, ghost);
  const gSignature = showFieldGhost(fv?.signature, d.signature, ghost);
  const gTitle = showFieldGhost(fv?.title, d.title, ghost);
  const gTitleOg = showFieldGhost(fv?.titleOg, d.titleOg, ghost);

  // gap:10px는 병합 셀 분해 flex 컨테이너의 유일 시그니처(ghostMode #266 PR-C 불변식)라 분해 셀
  // (fieldPieces)에서만 쓰고, 단일 필드 행(Starring·Collected by)은 12로 회피한다.
  const row = (label: string, node: ReactNode, flexGap: number | false) => (
    <>
      <div style={labelStyle}>{label}</div>
      <div style={{ ...valueStyle, ...(flexGap ? { display: 'flex', alignItems: 'center', gap: flexGap, flexWrap: 'wrap' } : null) }}>{node}</div>
    </>
  );

  const hasStamp =
    stampWillRender(components.chainVisible, components.chain, components.chainLabel, ghost) ||
    stampWillRender(components.formatVisible, components.format, components.formatLabel, ghost);

  return (
    <>
      <Poster
        src={croppedImageUrl}
        fit="cover"
        align="top"
        background="#000"
        material={components.material}
        coating={components.coating}
        materialIntensity={components.materialIntensity}
        coatingIntensity={components.coatingIntensity}
        posterOpacity={(components.posterOpacity ?? defaultBrightnessForTexture(components.material ?? 'original', components.coating ?? 'none')) * 0.34}
      />
      {/* #219 componentOpacity: 크레딧 컷의 스크림·조판만 페이드(배경 포스터는 유지). 이 컷은
          자기 크롬을 스스로 페이드하므로 무드의 크롬 래퍼 **밖**에 둬야 한다(안에 넣으면 이중 적용). */}
      <div style={{ position: 'absolute', inset: 0, opacity: components.componentOpacity ?? 1 }}>
      <div style={{ position: 'absolute', inset: 0, background: CREDIT_SCRIM }} />
      <div style={{ position: 'absolute', inset: 0, padding: compact ? `32px ${padX}px 26px` : `28px ${padX}px 24px`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', color: FILM_INK }}>
        <div style={{ textAlign: 'center', textShadow: '0 2px 10px rgba(0,0,0,.7)' }}>
          {titleVal ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ fontSize: titleFontSize, fontWeight: 500, letterSpacing: 0.3, lineHeight: 1.15, fontFamily: FONT_KR, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{titleVal}</div>
            </FieldTap>
          ) : gTitle ? (
            <FieldTap field="title" onField={onField}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><FieldGhost text="TITLE" width="70%" height={34} surface="dark" state={gTitle} /></div>
            </FieldTap>
          ) : null}
          {titleOgVal ? (
            <FieldTap field="titleOg" onField={onField}>
              <div style={{ fontFamily: FONT_MONO, fontSize: compact ? 10 : 10.5, fontWeight: 600, letterSpacing: compact ? 3.8 : 4, textTransform: 'uppercase', color: 'rgba(233,231,226,.55)', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titleOgVal}</div>
            </FieldTap>
          ) : gTitleOg ? (
            <FieldTap field="titleOg" onField={onField}>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}><FieldGhost text="ORIGINAL TITLE" width={200} height={18} surface="dark" state={gTitleOg} /></div>
            </FieldTap>
          ) : null}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'center', columnGap: compact ? 22 : 24, rowGap: 22, alignItems: 'baseline' }}>
          {exhibited.hasAny && row('Exhibited', exhibited.node, exhibited.hasGhost && 10)}
          {screened.hasAny && row('Screened', screened.node, screened.hasGhost && 10)}
          {film.hasAny && row('The Film', film.node, film.hasGhost && 10)}
          {actorsVal
            ? row('Starring', <FieldTap field="actors" onField={onField}>{actorsVal}</FieldTap>, false)
            : gActors
            ? row('Starring', <FieldTap field="actors" onField={onField}><FieldGhost text="CAST" width={180} height={26} surface="dark" state={gActors} /></FieldTap>, 12)
            : null}
          {components.signatureImage
            ? row('Collected by', <FieldTap field="signature" onField={onField}><SignatureStamp image={components.signatureImage} height={26} scale={components.signatureScale ?? 1} surface="dark" /></FieldTap>, 12)
            : signatureVal
            ? row('Collected by', <FieldTap field="signature" onField={onField}><span style={{ ...userTextFont(signatureVal, components.signatureFont, 26), lineHeight: 1 }}>{signatureVal}</span></FieldTap>, false)
            : gSignature
            ? row('Collected by', <FieldTap field="signature" onField={onField}><FieldGhost text="SIGNATURE" width={140} height={26} surface="dark" state={gSignature} /></FieldTap>, 12)
            : null}
        </div>

        <div style={{ flex: 1 }} />

        {/* 푸터 — 시안의 "CINE ROYALE · 70MM" 자리(#524 c5). 상단 좌측 스탬프 슬롯이 사라지고
            체인·포맷이 여기로 온다. 로고 미업로드면 StampRow가 라벨 텍스트로 폴백해 시안과 같은 그림. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: compact ? 14 : 16, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {hasStamp && (
              <StampRow
                chain={components.chain}
                chainLabel={components.chainLabel}
                chainVisible={components.chainVisible}
                chainHeight={22}
                chainScale={components.chainScale ?? 1}
                format={components.format}
                formatLabel={components.formatLabel}
                formatVisible={components.formatVisible}
                formatSize={0.5}
                formatScale={components.formatScale ?? 1}
                surface="dark"
                ghost={ghost}
                onField={onField}
                dividerColor={FILM_INK}
                dividerOpacity={0.5}
              />
            )}
          </div>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: compact ? 7 : 8, opacity: 0.6, flexShrink: 0 }}>
            <span style={{ fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontWeight: 400, fontSize: compact ? 14 : 15 }}>made with</span>
            <MoodWordmark size={compact ? 13 : 14} color={FILM_INK} />
          </span>
        </div>
      </div>
      </div>
    </>
  );
}

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

let resolvedCssVarCache: Map<string, string> | undefined;

/**
 * Canvas 2D `font` 대입 문법은 `var()`를 못 읽는다 — 브라우저 실측(Chrome 152)으로 확인: 대입
 * 자체가 조용히 무시되고 `ctx.font`는 직전 값 그대로 남는다(측정 캔버스는 모듈 스코프로 재사용돼
 * 직전 호출의 폰트가 새 호출에 새는 형태로 드러난다). `FONT_SANS`처럼 `var(--font-sans)`가 앞에
 * 붙은 패밀리를 이 함수로 실제 등록 패밀리명(예: `"pretendard", "pretendard Fallback"`)으로
 * 치환해서 넘긴다 — 변수가 `<main>`(`_app.tsx`)에서 정의되므로 `document.body`/`documentElement`가
 * 아니라 `<main>`에서 읽는다. `<main>`이 없는 자리(테스트 DOM, `renderToStaticMarkup`은 애초에
 * `getMeasureCtx`에서 걸러진다)에선 빈 문자열이라 원래 토큰을 그대로 남기고, 그 결과는 이전과
 * 같은 "무시됨" 동작이라 회귀가 아니다.
 */
export function resolveCanvasFontFamily(fontFamily: string): string {
  if (typeof document === 'undefined' || !fontFamily.includes('var(--')) return fontFamily;
  return fontFamily.replace(/var\(--([\w-]+)\)/g, (token, name: string) => {
    if (!resolvedCssVarCache) resolvedCssVarCache = new Map();
    let resolved = resolvedCssVarCache.get(name);
    if (resolved === undefined) {
      const host = document.querySelector('main') ?? document.documentElement;
      resolved = getComputedStyle(host).getPropertyValue(`--${name}`).trim();
      resolvedCssVarCache.set(name, resolved);
    }
    return resolved || token;
  });
}

/**
 * 테스트 전용 — `resolvedCssVarCache`는 모듈 스코프 영구 캐시라(위 함수) `<main>` 없는 DOM에서
 * 먼저 도는 테스트가 빈 문자열을 캐시해버리면, bun이 테스트 파일 전체를 한 프로세스에서 돌리는
 * 특성상(#611과 같은 부류) 뒤이어 `<main>`을 실제로 세운 테스트까지 그 오염된 값을 그대로
 * 받는다. `resetCtxFilterProbeForTest`(captureToImage.ts)와 같은 규약.
 */
export function resetResolvedCssVarCacheForTest(): void {
  resolvedCssVarCache = undefined;
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
 * ponytail: letter-spacing은 측정에 반영하지 않는다(근거·부호별 방향은 아래
 * `MeasureFontOptions.letterSpacing`). **양수 자간 호출부**(TextStamp #590, Criterion 콜로폰
 * #566)는 `maxWidth`에서 `자간 × 글자수`를 직접 빼고 넘긴다. 완벽한 줄바꿈 시뮬레이션도 하지
 * 않는다 — 호출부가 "가용폭 × 클램프 줄 수"를 maxWidth로 넘겨 가장 긴 한 줄 기준으로 안전하게
 * 축소하는 근사를 쓴다.
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

  const resolvedFontFamily = resolveCanvasFontFamily(fontFamily);
  const widthAt = (size: number) => {
    ctx.font = `${fontWeight} ${size}px ${resolvedFontFamily}`;
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
        // `mid === lo`면 더 좁힐 수 없다 — **정수 mid + 소수 maxSize의 조합에서 무한루프였다**:
        // lo=16, hi=17.5면 mid가 계속 floor(16.75)=16이고 아래 첫 분기가 lo=16을 다시 써서
        // 폭이 영원히 안 줄었다(#575에서 발견 — Criterion 콜로폰 maxSize 17.5가 실제로 축소를
        // 요구하는 조합에서 브라우저 메인 스레드가 잠겼다). `mid === hi`는 mid < hi가 항상
        // 참이라 생길 수 없고, 반대 분기는 hi=mid=lo로 즉시 탈출하므로 여기만 막으면 된다.
        if (mid === lo) break;
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
 * fallback으로 떨군다. 불완전 hex가 잉크로 새면 `color:'#8E'`가 무효 CSS라 텍스트가 순간
 * 투명해진다(#177 리뷰 P1). ColorPicker의 헥스 텍스트 필드(타이핑/삭제 중 `'#8'` 같은
 * 불완전 hex를 emit하던 그 경로)는 #730에서 제거됐지만, 이 가드는 남겨둔다 — 유효 hex는
 * 그대로, 불완전 hex는 fallback으로 가독성을 지키는 값싼 방어라 다른 입력 경로가 생겨도 여전히 유효하다.
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

export interface MeasureFontOptions {
  fontFamily: string;
  fontWeight?: number;
  fontSize: number;
  /**
   * CSS letter-spacing(px). canvas `measureText`는 자간을 세지 않으므로 글자당 한 번씩 더한다
   * (#590 TextStamp가 예산에서 `자간 × 글자수`를 뺀 것과 같은 규약, 부호만 반대 방향).
   * 생략(0)하면 자간이 음수인 호출부는 측정치가 실렌더보다 넓어 보수적으로 잡힌다 — 오버플로
   * 방향의 오차가 없으니 그대로 둬도 된다. **양수 자간은 반드시 넘겨야 한다**(#566): 넘기지
   * 않으면 측정치가 실렌더보다 좁아, 예산 안이라고 판정한 문자열이 실제로는 넘쳐 ellipsis에
   * 걸린다.
   */
  letterSpacing?: number;
}

/**
 * 텍스트의 실제 렌더 폭(px)을 canvas `measureText`로 잰다(#566). 고정 크기 측정 전용이라
 * `fitFontSizeToWidth`(크기를 이진탐색하며 재는 쪽)와는 별개고, SSR·canvas 미지원이면 0을
 * 돌려준다(예산 계산의 중립값 — 호출부는 "빼는 게 없다"로 흘러 원본을 그대로 쓴다).
 *
 * 캐시는 없다 — 이 함수는 매 렌더 몇 번 불리는 순수 측정이고, 캐시가 있으면 폰트 로드 전
 * 폴백 메트릭이 박히는 문제(PR #345 P1)를 호출부마다 다시 다뤄야 한다.
 *
 * **주의**: `FONT_SANS`처럼 `var(--font-*)`가 들어간 패밀리는 canvas `font` 문법에서 무효라
 * 대입 자체가 조용히 무시되고 직전 폰트로 재게 된다(#751) — 그래서 이 함수는
 * `resolveCanvasFontFamily`로 실제 등록 패밀리명으로 먼저 치환한 뒤에만 `ctx.font`에 넘긴다.
 * `<main>`이 없어 치환이 안 되는 자리(테스트 DOM)는 여전히 이 무시됨 동작 그대로다. `FONT_DISPLAY`도
 * 같은 `var(--font-*)` 모양이라 이 함수를 거치면 안전하지만, 지금은 canvas 측정 경로(이 함수·
 * `fitFontSizeToWidth`) 어디에도 `FONT_DISPLAY`를 넘기는 호출부가 없다 — 실제로 그 경로를 타는
 * 값이 아니라, 같은 함정에 빠질 수 있는 패밀리의 예시일 뿐이다.
 */
export function measureTextWidth(text: string, { fontFamily, fontWeight = 400, fontSize, letterSpacing = 0 }: MeasureFontOptions): number {
  if (!text) return 0;
  const ctx = getMeasureCtx();
  if (!ctx) return 0;
  ctx.font = `${fontWeight} ${fontSize}px ${resolveCanvasFontFamily(fontFamily)}`;
  return ctx.measureText(text).width + letterSpacing * text.length;
}

const truncateActorsWidthCache = new Map<string, string>();

/**
 * `truncateActors`의 폭 인식 버전(#493) — 고정 인원수 대신 실제 렌더 폭(canvas measureText)
 * 기준으로 "외 N명"을 결정한다. fitFontSizeToWidth와 같은 캐시·SSR-fallback·fontsReady 정책을
 * 공유한다. #566에서 Stub 외에 Editorial(`avec`)·Criterion(콜로폰 `CAST`)까지 이 경로를 쓴다.
 */
export function truncateActorsToWidth(
  actors: string,
  maxWidth: number,
  font: MeasureFontOptions,
  fontsReady = true,
): string {
  if (!actors) return '';
  const parts = actors.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length <= 1) return parts.join(', ');
  const full = parts.join(', ');

  // 캐시 조회가 측정보다 앞이다 — 위 fitFontSizeToWidth와 같은 순서.
  const fontWeight = font.fontWeight ?? 400;
  const key = `${actors}|${maxWidth}|${font.fontFamily}|${fontWeight}|${font.fontSize}|${font.letterSpacing ?? 0}`;
  const cached = truncateActorsWidthCache.get(key);
  if (cached !== undefined) return cached;

  // 컨텍스트가 없을 땐 **캐시에 쓰지 않고** 원본을 돌려준다 — measureTextWidth의 0 폴백에
  // 맡기면 "안 넘친다"는 판정이 캐시에 박혀, context-lost가 회복돼도 안 다시 재게 된다
  // (getMeasureCtx가 2D 컨텍스트를 영구 캐시하지 않는 이유와 같은 우려).
  if (!getMeasureCtx()) return full;

  const widthOf = (s: string) => measureTextWidth(s, font);
  const withMore = (n: number) => `${parts.slice(0, n).join(', ')} 외 ${parts.length - n}명`;

  let result = full;
  if (widthOf(full) > maxWidth) {
    result = withMore(1);
    for (let n = 2; n < parts.length; n++) {
      const candidate = withMore(n);
      if (widthOf(candidate) > maxWidth) break;
      result = candidate;
    }
  }

  if (fontsReady) truncateActorsWidthCache.set(key, result);
  return result;
}
