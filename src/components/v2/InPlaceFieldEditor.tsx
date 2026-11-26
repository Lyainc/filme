import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { DateFormatToken, DateGranularity, MovieInfo, QuoteFont, TicketComponents } from '@/types';
import { userTextFont } from '@/components/moods/_shared';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/dateFormat';
import { handleRadioGroupKeyDown } from '@/utils/radioGroupKeyboard';
import { inputVariants, pressableVariants } from '@/components/ui/variants';
import { useKobisSearch } from '@/hooks/useKobisSearch';
import { useLogoCrop } from '@/hooks/useLogoCrop';
import { useRatingPicker } from '@/components/v2/pickers/RatingPicker';
import { useKeyboardBox } from '@/hooks/useInputKeyboard';
import { editLift } from '@/utils/inputKeyboard';
import { KeyboardPanel, focusInPlace, keepFocus } from './KeyboardPanel';
import { DateInput } from '@/components/ui/DateInput';
import VisibilityCheckbox from '@/components/ui/VisibilityCheckbox';
import { KobisResultList } from './FieldEditorBody';
import {
  FIELD_INFO_KEY,
  FIELD_LABELS,
  STAMP_KEYS,
  STAMP_LABELS,
  STAMP_LABEL_MAX,
  QUOTE_MAX_LENGTH,
  isStampTarget,
  type SheetTarget,
  IMAGE_ACCEPT,
} from '@/constants/fields';
import { DATE_FORMAT_TOKENS, GRANULARITY_OPTIONS } from '@/constants/dateTokens';

// 로고 크롭 모달 — dynamic(ssr:false)로 react-image-crop을 분리.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

type Photo = ReturnType<typeof usePhototicket>;

/**
 * ‹ › · Return 순회의 정본 순서(#354, 시안 editOrder). 실제 순회 목록은 현재 무드 DOM에 존재하는
 * data-field-tap만 걸러 만든다 — 무드가 렌더하지 않는 필드(MOOD_EXCLUDED_FIELDS + 조건부 미렌더)는
 * 탭 앵커 자체가 없어 구조적으로 빠진다. reissue는 FieldTap 타깃이 releaseDate라 여기 없음.
 */
const EDIT_ORDER: SheetTarget[] = [
  'title', 'titleOg', 'releaseDate', 'actors', 'rating', 'quote',
  'watchDate', 'watchTime', 'theater', 'screen', 'seat', 'runtime',
  'bookingNo', 'signature', 'chain', 'format',
];

/** 활성 필드의 지오메트리 — local(래퍼 좌표, 배율 나눈 값: 선택 표시 배치 · 리프트 계산) + wrapperTop(리프트 계산용). */
interface FieldRect {
  top: number;
  left: number;
  w: number;
  h: number;
  /** 래퍼 윗변의 viewport Y — translateY 성분을 뺀 값(리프트 자기참조 방지). origin이 top이라 배율은 윗변을 안 옮긴다. */
  wrapperTop: number;
}

/**
 * data-field-tap(#354)은 #646부터 FieldTap이 children 자신(실제 레이아웃 박스가 있는 노드)에
 * 직접 붙인다 — 앵커를 찾으면 그게 곧 측정 대상이다. 래퍼(wrapper)의 현재 transform(리프트 중간값 포함)은
 * computed matrix로 읽어 스케일은 나누고 translateY는 빼서, 트랜지션 중간에 측정돼도 좌표가 흔들리지 않는다.
 */
function measureField(wrapper: HTMLElement, ticket: HTMLElement, field: SheetTarget): FieldRect | null {
  // null은 "앵커가 DOM에 없음"(그 무드가 필드를 안 렌더)일 때만 — 선택 표시 렌더 게이트.
  // 0-크기 rect는 그대로 반환한다(레이아웃 미완·happy-dom 등, 다음 변경 관측에서 재측정).
  const tap = ticket.querySelector(`[data-field-tap="${field}"]`);
  if (!tap) return null;
  const wb = wrapper.getBoundingClientRect();
  const eb = tap.getBoundingClientRect();
  let scale = 1;
  let translateY = 0;
  const t = typeof getComputedStyle === 'function' ? getComputedStyle(wrapper).transform : 'none';
  if (t && t !== 'none' && typeof DOMMatrixReadOnly === 'function') {
    const m = new DOMMatrixReadOnly(t);
    if (m.a > 0) scale = m.a;
    translateY = m.f;
  }
  return {
    top: (eb.top - wb.top) / scale,
    left: (eb.left - wb.left) / scale,
    w: eb.width / scale,
    h: eb.height / scale,
    wrapperTop: wb.top - translateY,
  };
}

const rectEq = (a: FieldRect | null, b: FieldRect | null) =>
  a === b ||
  (!!a && !!b &&
    Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5 &&
    Math.abs(a.wrapperTop - b.wrapperTop) < 0.5);

/**
 * 한줄평·서명 폰트 9택(#558 4택 → #437). 값의 뜻과 실제 폰트는 `_shared.tsx`의 `userTextFont`가
 * 단일 소스이고 여기는 이름만 쥔다. 이름이 스타일명이 아니라 폰트 이름인 건 8종 중 5종이 손글씨
 * 계열이라 스타일어로는 서로 구분이 안 되기 때문이다('hand'는 값 그대로, 이름만 '자람').
 */
const FONT_OPTIONS: readonly { value: QuoteFont; label: string }[] = [
  { value: 'auto', label: '자동' },
  { value: 'gothic', label: '고딕' },
  { value: 'batang', label: '바탕' },
  { value: 'hand', label: '자람' },
  { value: 'ink', label: '잉크' },
  { value: 'eunyoung', label: '은영' },
  { value: 'brush', label: '붓' },
  { value: 'coolguy', label: '쿨가이' },
  { value: 'flower', label: '꽃길' },
];

/** 미리보기 기준 크기 — userTextFont의 #437 배율이 자람=1.0 기준이라 16이면 9택 글자면이 비슷하게 선다. */
const FONT_SAMPLE_PX = 16;
/** 입력이 비었을 때의 글꼴 견본(D14-2 A) — 한글 · 영문 글자면을 둘 다 보여 준다. */
const FONT_SAMPLE_FALLBACK = '영화의 순간 Film';

/** 패널 컨트롤 — 줄 44, 보이는 상자 36(D12). 글자 16px라 iOS가 포커스 때 확대하지 않는다(#274 · 요구 3). */
const PANEL_INPUT_CLS = cn(inputVariants({ surface: 'glass' }), 'h-9 w-full min-w-0 rounded-ctl px-3 text-title text-ink');
const ICON_BTN_CLS = cn(pressableVariants(), 'inline-flex h-touch w-touch shrink-0 items-center justify-center rounded-ctl text-ink-2 transition-colors hover:text-ink');
/** 옵션 칩(C-OPT) — 모서리 6 상자, 누르는 높이 44. 고른 칩만 면과 선이 선다. */
const OPT_CLS = cn(pressableVariants(), 'inline-flex h-touch shrink-0 items-center whitespace-nowrap rounded-ctl border px-3 text-body transition-colors');
const optState = (on: boolean) => (on ? 'border-hair-strong bg-s2 font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink');
/** 칩 한 줄(C-ACC) — 넘치면 가로 스크롤. */
const TOOLBAR_CLS = 'no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto';


const CHEVRON_PATH = { left: 'm15 18-6-6 6-6', right: 'm9 18 6-6-6-6', up: 'm6 15 6-6 6 6', down: 'm6 9 6 6 6-6' } as const;
function Chevron({ dir, size = 18, className }: { dir: keyof typeof CHEVRON_PATH; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={CHEVRON_PATH[dir]} />
    </svg>
  );
}

/** 배타 선택 칩 묶음 — toolbar 안의 radiogroup(APG). */
function OptionRadios<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={handleRadioGroupKeyDown} className="flex shrink-0 gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onPointerDown={keepFocus}
          onClick={() => onChange(o.value)}
          className={cn(OPT_CLS, optState(o.value === value), 'tabular-nums')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const FORMAT_OPTIONS = DATE_FORMAT_TOKENS.map((t) => ({ value: t.value, label: t.sample }));

/**
 * 패널 안 목록(APG listbox) — 글꼴(D14-2 A)과 개봉일 표기(D16 3-A)가 같이 쓴다. 키보드 자리에 열리고 포커스를 가져가
 * 키보드가 내려간다. 항목은 [미리보기][작은 이름][현재 항목 ✓]이고 접근 이름은 이름이다.
 */
function PanelListbox<V extends string>({
  label,
  options,
  value,
  maxHeight,
  triggerRef,
  onSelect,
  onClose,
}: {
  label: string;
  options: readonly { value: V; name: string; preview: ReactNode }[];
  value: V;
  maxHeight: number;
  /** 미리보기 버튼 — 이 버튼으로 옮겨 가는 blur는 닫지 않는다(버튼 탭이 토글을 맡는다). */
  triggerRef: RefObject<HTMLButtonElement | null>;
  onSelect: (v: V) => void;
  onClose: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const last = options.length - 1;
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const move = (n: number) => {
      e.preventDefault();
      setActive(n);
    };
    if (e.key === 'ArrowDown') move(Math.min(last, active + 1));
    else if (e.key === 'ArrowUp') move(Math.max(0, active - 1));
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(last);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(options[active].value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Tab') onClose();
  };
  return (
    <ul
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      aria-activedescendant={`${id}-${active}`}
      onKeyDown={onKeyDown}
      // 버튼으로 가는 blur까지 닫으면 곧이어 오는 버튼 click(토글)이 방금 닫힌 목록을 다시 열어 버튼이 안 닫힌다.
      onBlur={(e) => {
        if (e.relatedTarget && e.relatedTarget === triggerRef.current) return;
        onClose();
      }}
      className="m-0 mt-2 list-none overflow-y-auto border-t border-hair p-0 outline-none"
      style={{ maxHeight }}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <li
            key={o.value}
            id={`${id}-${i}`}
            role="option"
            aria-selected={selected}
            aria-label={o.name}
            // 포커스가 목록을 떠나면 blur로 닫히니, 선택 클릭 전에 blur가 먼저 도는 걸 막는다.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(o.value)}
            className={cn(
              'flex h-touch items-center gap-2 border-b border-hair px-1 text-ink',
              i === active && 'ring-2 ring-inset ring-[var(--pr-focus-ring)]'
            )}
          >
            <span className="min-w-0 flex-1 truncate">{o.preview}</span>
            <span className="shrink-0 text-caption text-ink-3">{o.name}</span>
            <span className="inline-flex w-5 shrink-0 justify-center">
              {selected && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 정밀도 세그먼트(D16 3-A) — 한 덩어리 상자 안 세 칸, radiogroup. 보이는 상자는 36, 누르는 높이는 44다.
 */
function GranularitySegment({ value, onChange }: { value: DateGranularity; onChange: (v: DateGranularity) => void }) {
  return (
    <div role="radiogroup" aria-label="개봉일 정밀도" onKeyDown={handleRadioGroupKeyDown} className="flex shrink-0">
      {GRANULARITY_OPTIONS.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onPointerDown={keepFocus}
            onClick={() => onChange(o.value)}
            className={cn(pressableVariants(), 'inline-flex h-touch shrink-0 items-center')}
          >
            <span
              className={cn(
                'inline-flex h-9 items-center whitespace-nowrap border-y border-hair-strong px-2.5 text-body',
                i === 0 ? 'rounded-l-ctl border-l' : 'border-l',
                i === GRANULARITY_OPTIONS.length - 1 && 'rounded-r-ctl border-r',
                on ? 'bg-s2 font-semibold text-ink' : 'text-ink-2'
              )}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 입력 중 티켓 위 선택 표시(C-SEL) — 재단 L자 넷, 이름표 없음(D12 · 결정 3-A). 래퍼 안이라 캡처 대상 밖이다. */
function SelectionMarks({ rect }: { rect: FieldRect }) {
  const corner = 'absolute h-[9px] w-[9px] border-accent';
  return (
    <div
      aria-hidden="true"
      data-field-selection=""
      style={{ position: 'absolute', left: rect.left - 5, top: rect.top - 5, width: rect.w + 10, height: rect.h + 10, zIndex: 60, pointerEvents: 'none' }}
    >
      <span className={cn(corner, 'left-0 top-0 border-l-2 border-t-2')} />
      <span className={cn(corner, 'right-0 top-0 border-r-2 border-t-2')} />
      <span className={cn(corner, 'bottom-0 left-0 border-b-2 border-l-2')} />
      <span className={cn(corner, 'bottom-0 right-0 border-b-2 border-r-2')} />
    </div>
  );
}

interface InPlaceFieldEditorProps {
  photo: Photo;
  /** 편집 중인 타깃. null 게이팅은 셸이 한다(이 컴포넌트는 편집 중에만 마운트). */
  field: SheetTarget;
  /** 리프트/스케일 transform이 걸리는 프리뷰 래퍼 — 선택 표시 portal 대상. */
  wrapperEl: HTMLElement | null;
  /** TicketRenderer를 감싼 안쪽 div — 측정·MutationObserver 대상(선택 표시 자신을 관찰하지 않게 분리). */
  ticketEl: HTMLElement | null;
  /**
   * ‹ › · Return 순회 — 순수 탐색이라 가시성을 건드리지 않는다(PR #359 리뷰 P1: 셸 handleField를
   * 재사용하면 경유한 숨김 필드가 전부 노출로 바뀐다).
   */
  onField: (field: SheetTarget) => void;
  onClose: () => void;
  /** 입력 중 티켓 배율(#826 S4, 셸이 무대에서 잰 min(1.18, 무대 폭 ÷ 맞춤 폭)) — 리프트 계산이 확대 뒤 필드 위치를 쓴다. */
  scale?: number;
  /** 편집 중 티켓 lift(px, ≤0) — 셸이 transform으로 적용. */
  onLift: (px: number) => void;
}

/**
 * 필드 입력 패널(#826 S3, D12 · D13 · D14). 정보 목록 행과 티켓 필드 탭이 같은 패널을 연다.
 *
 * - 자리(#826 S4): visualViewport로 잰 키보드 윗변에 틈 없이 붙는다(키보드가 없으면 프레임 바닥 + 안전 영역, 프레임 기준 fixed).
 *   티켓은 셸이 1.18배(상한)로 키우고, 여기서 고른 필드 아래 끝이 패널 윗변 30px 위에 오도록 위로만 옮긴다.
 * - 종료(K-08): 닫기 · 키보드 내림(포커스 이탈) · 바깥 탭(backdrop) · 뒤로(셸의 usePanelHistory). 결과는 셸 closeEditor 하나다.
 * - 첫 줄: [‹ 이전 항목][입력(16px, 안내 글자 = 필드 이름)][› 다음 항목][닫기](D15 2B). Return = 다음 항목, 마지막 필드에선 닫기.
 * - 둘째 줄: 옵션이 있는 필드만 — 표기 · 정밀도 · 재개봉(날짜), 별(평점), 글꼴 ‹ 미리보기 ›(한줄평 · 서명), 이미지로(로고 · 서명),
 *   KOBIS 결과(제목). 표시 토글은 정보 목록 눈으로만 바꾸고(D14-1) 재개봉일 하나만 예외로 여기 남는다.
 * - 티켓에는 선택 표시(재단 L자)만 그린다. 위치 계산은 rAF 루프 금지(#354) — MutationObserver(티켓 서브트리) +
 *   ResizeObserver(래퍼) + visualViewport 변경 시에만 1회 측정.
 */
export function InPlaceFieldEditor({ photo, field, wrapperEl, ticketEl, onField, onClose, scale = 1, onLift }: InPlaceFieldEditorProps) {
  const isStamp = isStampTarget(field);
  // 서명(#484 c6)은 StampTarget이 아니지만(c3 — 데이터가 MovieInfo에 산다) 이미지 업로드 UI는 chain/format과 같다.
  const isSignature = field === 'signature';
  const isImageField = isStamp || isSignature;
  const { components, movieInfo: info } = photo.state;
  const stampImage = isStamp
    ? String(components[STAMP_KEYS[field].image] ?? '')
    : isSignature
      ? components.signatureImage ?? ''
      : '';
  const label = isStamp ? STAMP_LABELS[field] : FIELD_LABELS[field];

  // ── 지오메트리: 필드 rect(래퍼 로컬 좌표) ──────────────────────────────────
  const [rect, setRect] = useState<FieldRect | null>(null);
  const rectRef = useRef<FieldRect | null>(null);

  const remeasure = useCallback(() => {
    if (!wrapperEl || !ticketEl) return;
    const next = measureField(wrapperEl, ticketEl, field);
    if (rectEq(rectRef.current, next)) return;
    rectRef.current = next;
    setRect(next);
  }, [wrapperEl, ticketEl, field]);

  useLayoutEffect(() => {
    // 필드 전환 시 무조건 상태 동기화 — remeasure의 epsilon 게이트를 우회해 이전 필드 위치에 표시가 남는 걸 막는다.
    const next = wrapperEl && ticketEl ? measureField(wrapperEl, ticketEl, field) : null;
    rectRef.current = next;
    setRect(next);
    if (!wrapperEl || !ticketEl) return;
    // 변경 시 1회 측정: 타이핑(characterData)·ghost 노드 스왑(childList)·fitFontSizeToWidth의
    // style 변경(attributes)은 MutationObserver가, 프리뷰 리사이즈는 ResizeObserver가 잡는다.
    const mo = new MutationObserver(remeasure);
    mo.observe(ticketEl, { subtree: true, childList: true, characterData: true, attributes: true });
    const ro = new ResizeObserver(remeasure);
    ro.observe(wrapperEl);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, [remeasure, wrapperEl, ticketEl, field]);

  // ── 키보드: visualViewport로 잰 키보드 높이(패널 bottom) + 가시 높이(목록 가용 높이) — resize · scroll 때만(#354) ──
  const kb = useKeyboardBox();
  const inset = kb?.inset ?? 0;

  // 패널 안 목록(KOBIS · 글꼴) 가용 높이 — 키보드 위 가시영역에 비례(#476). 가시영역이 아주 좁으면(랜드스케이프) 화면 위로
  // 넘치지 않게 visibleHeight - 16으로 막는다.
  const listMaxHeight = kb ? Math.min(360, Math.max(176, kb.visibleHeight * 0.7), kb.visibleHeight - 16) : 250;

  // ── 리프트(#826 S4 constraint-5): 고른 필드 아래 끝이 확대 뒤 패널 윗변 30px 위에 오도록 위로만 민다. 필드 전환 · 키보드
  // 높이 · 배율이 바뀔 때만 다시 재고 타이핑(rect 갱신)마다 흔들지 않는다 — wrapperTop이 리프트 성분을 뺀 값이라 자기참조
  // 발산이 없다. 패널 윗변은 그 순간의 패널 rect다(필드마다 줄 수가 달라 높이가 다르다).
  const panelRef = useRef<HTMLDivElement>(null);
  const hasRect = rect != null;
  useEffect(() => {
    const r = rectRef.current;
    const panel = panelRef.current;
    if (!r || !panel) return;
    onLift(editLift(r.wrapperTop, r.top + r.h, scale, panel.getBoundingClientRect().top));
  }, [field, hasRect, inset, scale]);

  // ── 값 바인딩 ──────────────────────────────────────────────────────────────
  const infoKey = isStamp ? undefined : FIELD_INFO_KEY[field];
  const value = isStamp
    ? String(components[STAMP_KEYS[field].label] ?? '')
    : infoKey
      ? String(info[infoKey] ?? '')
      : '';

  // KOBIS 검색(제목) — 공용 훅(#242 drift 방지).
  const kobis = useKobisSearch({ apply: photo.beginMovieSelection });
  // 편집기는 필드가 바뀌어도 살아 있다 — 제목을 떠나면 목록을 닫아 돌아왔을 때 지난 검색이 다시 뜨지 않게 한다.
  useEffect(() => {
    if (field !== 'title') kobis.setOpen(false);
  }, [field]);

  const setValue = (v: string) => {
    if (isStamp) {
      photo.updateComponents({ [STAMP_KEYS[field].label]: v } as Partial<TicketComponents>);
    } else if (infoKey) {
      photo.updateMovieInfo({ [infoKey]: v } as Partial<MovieInfo>);
      if (field === 'title') kobis.scheduleSearch(v.trim());
    }
  };

  // 로고 · 서명 이미지(이미지로 · 교체) — useLogoCrop 자유 비율 크롭. 서명(#484 c6)은 TicketComponents.signatureImage.
  const setStampImage = (url: string) => {
    if (isStamp) photo.updateComponents({ [STAMP_KEYS[field].image]: url } as Partial<TicketComponents>);
    else if (isSignature) photo.updateComponents({ signatureImage: url });
  };
  const logo = useLogoCrop(setStampImage);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const pickImage = () => logoInputRef.current?.click();
  // revoke는 여기서 안 한다 — usePhototicket.updateComponents가 히스토리(#356) 참조 여부를 보고 판정한다(#673).
  const removeImage = () => setStampImage('');

  // ── 글꼴(한줄평 · 서명, D14-2 A) — 이미지 서명이면 글자 서명이 안 그려져 글꼴 줄이 없다. ──
  const fontKey = field === 'quote' ? 'quoteFont' : field === 'signature' ? 'signatureFont' : null;
  const showFont = fontKey !== null && !(isSignature && !!stampImage);
  const currentFont: QuoteFont = (fontKey && components[fontKey]) || 'auto';
  const fontIndex = Math.max(0, FONT_OPTIONS.findIndex((o) => o.value === currentFont));
  // 패널 목록(글꼴 · 개봉일 표기) — 글꼴은 한줄평 · 서명에만, 표기는 개봉일에만 있어 열림 하나로 충분하다. 필드가 바뀌면 렌더 중에
  // 닫는다(effect가 아니라 이전 필드와 비교) — 열린 채로 다른 필드에 갔다 돌아왔을 때 목록이 혼자 다시 열리지 않게.
  const [listOpen, setListOpen] = useState(false);
  const [listField, setListField] = useState(field);
  if (listField !== field) {
    setListField(field);
    setListOpen(false);
  }
  const toggleList = () => setListOpen((o) => !o);
  const closeList = () => setListOpen(false);
  const fontBtnRef = useRef<HTMLButtonElement>(null);
  const formatBtnRef = useRef<HTMLButtonElement>(null);
  const fontSample = (field === 'quote' ? info.quote : info.signature)?.trim() || FONT_SAMPLE_FALLBACK;
  const setFont = (font: QuoteFont) => {
    if (fontKey) photo.updateComponents({ [fontKey]: font } as Partial<TicketComponents>);
  };
  const stepFont = (dir: 1 | -1) => setFont(FONT_OPTIONS[(fontIndex + dir + FONT_OPTIONS.length) % FONT_OPTIONS.length].value);
  const selectFont = (font: QuoteFont) => {
    setFont(font);
    closeList();
    fontBtnRef.current?.focus();
  };

  // ── 개봉일 표기(D16 3-A) — 이름이 아니라 지금 표기로 쓴 날짜를 버튼과 목록에 보인다. 날짜가 비면 표기의 견본. ──
  const releaseGran = info.releaseDateGranularity || 'date';
  const releaseToken = info.releaseDateFormat || 'kr-compact';
  const releasePreview = (t: (typeof DATE_FORMAT_TOKENS)[number]) => formatDate(info.releaseDate, t.value, releaseGran) || t.sample;
  const currentFormat = DATE_FORMAT_TOKENS.find((t) => t.value === releaseToken) ?? DATE_FORMAT_TOKENS[0];
  // 정밀도가 '연'이면 네 표기가 모두 연도 하나('2014')로 같아 표기를 골라도 티켓이 안 바뀐다 — 버튼을 끈다.
  const formatInert = releaseGran === 'year';
  const selectFormat = (releaseDateFormat: DateFormatToken) => {
    photo.updateMovieInfo({ releaseDateFormat });
    closeList();
    formatBtnRef.current?.focus();
  };

  // ── 평점(D16 4-A): 키보드 없이 첫 줄 [− 숫자 +] 스테퍼 + 둘째 줄 패널 폭 별, 숫자를 누르면 소수 입력. 표시 토글은 정보 목록 눈 몫. ──
  const setRating = useCallback((r: number) => photo.updateMovieInfo({ rating: r }), [photo.updateMovieInfo]);

  // ── ‹ › · Return: 현재 무드 DOM에 실제 존재하는 필드만 순회 ─────────────────────
  // 앵커 스캔은 한 번 — 필드마다 querySelector를 돌리면 타이핑 렌더마다 16번 훑는다. 무드가 늦게 로드돼
  // 앵커가 나중에 생기므로 메모하지 않고 렌더마다 읽는다.
  const drawn = new Set(Array.from(ticketEl?.querySelectorAll<HTMLElement>('[data-field-tap]') ?? [], (el) => el.dataset.fieldTap));
  const order = EDIT_ORDER.filter((f) => drawn.has(f));
  const isLast = order.length > 0 && order[order.length - 1] === field;
  const step = (dir: 1 | -1) => {
    if (!order.length) return;
    const i = order.indexOf(field);
    // 지금 필드가 순회 목록에 없으면(무드가 안 그린 필드) 목록 밖에서 출발한다 — ›는 처음, ‹는 끝.
    if (i < 0) onField(dir === 1 ? order[0] : order[order.length - 1]);
    else onField(order[(i + dir + order.length) % order.length]);
  };
  // 키보드 Return(D13 ①) — 다음 항목, 마지막 필드에선 닫기. 한글 조합 확정 Enter는 건너뛴다(조합 중 Return은 글자 확정).
  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (isLast) onClose();
    else step(1);
  };
  const enterKeyHint = isLast ? 'done' : 'next';
  const rating = useRatingPicker({ value: info.rating, onValueChange: setRating, resetKey: field, onEnter, enterKeyHint, panel: true });

  // ── 첫 줄 입력 자리 ──────────────────────────────────────────────────────────
  let slot: ReactNode;
  if (field === 'rating') {
    slot = rating.number;
  } else if (isImageField && stampImage) {
    // 이미지가 있으면 글자보다 이미지가 그려진다(_shared.tsx 규칙) — 글자 입력 대신 이미지 행(제거 · 교체).
    slot = (
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <img src={stampImage} alt={`${label} 이미지`} className="h-8 w-auto min-w-0 max-w-[72px] object-contain" />
        <span className="flex-1" />
        <button type="button" onPointerDown={keepFocus} onClick={removeImage} className={cn(OPT_CLS, optState(false))}>
          제거
        </button>
        <button type="button" onPointerDown={keepFocus} onClick={pickImage} className={cn(OPT_CLS, 'border-hair-strong text-ink')}>
          교체
        </button>
      </div>
    );
  } else if (field === 'releaseDate') {
    slot = (
      <DateInput
        value={info.releaseDate || ''}
        granularity={info.releaseDateGranularity || 'date'}
        onChange={(releaseDate) => photo.updateMovieInfo({ releaseDate })}
        ariaLabel="개봉일"
        className={PANEL_INPUT_CLS}
        autoFocus
        onKeyDown={onEnter}
        enterKeyHint={enterKeyHint}
      />
    );
  } else if (field === 'watchDate') {
    slot = (
      <input
        ref={focusInPlace}
        type="date"
        value={info.watchDate || ''}
        onChange={(e) => photo.updateMovieInfo({ watchDate: e.target.value })}
        onKeyDown={onEnter}
        enterKeyHint={enterKeyHint}
        aria-label="관람일"
        className={PANEL_INPUT_CLS}
      />
    );
  } else {
    slot = (
      <input
        key={field}
        ref={focusInPlace}
        type={field === 'watchTime' ? 'time' : 'text'}
        // runtime(러닝타임)만 정수 전용(#684) — bookingNo는 OCR 스키마가 구분자 보존을 요구해 제외.
        // 값이 순수 숫자(또는 빈 값)일 때만 numeric — KOBIS 자동 채움은 "169 MIN"처럼 문자가 섞여
        // 있어(kobisLookup.ts extractKobisActorsRuntime) 그 값을 고치는 중엔 문자 키패드가 필요하다(#685).
        inputMode={field === 'runtime' && /^\d*$/.test(value) ? 'numeric' : undefined}
        enterKeyHint={enterKeyHint}
        // 출연은 티켓이 truncateActors로 "외 N명"까지 자르지만 입력값은 잘리지 않은 원문이다(#447).
        value={value}
        placeholder={label}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onEnter}
        // 한글 IME 조합 커밋 시 trailing change 없이 값만 반영되는 IME가 있어(#82) 커밋 값으로 재검색.
        onCompositionEnd={(e) => {
          if (field === 'title') {
            const v = e.currentTarget.value.trim();
            if (v) kobis.scheduleSearch(v);
          }
        }}
        aria-label={label}
        maxLength={isStamp ? STAMP_LABEL_MAX : field === 'signature' ? 20 : field === 'quote' ? QUOTE_MAX_LENGTH : undefined}
        className={PANEL_INPUT_CLS}
      />
    );
  }

  // ── 둘째 줄부터(옵션이 있는 필드만) ───────────────────────────────────────────
  const rows: ReactNode[] = [];
  if (field === 'title' && kobis.open) {
    if (kobis.loading) {
      rows.push(<p key="k" role="status" className="py-2 text-body text-ink-2">검색 중…</p>);
    } else if (kobis.noResults) {
      rows.push(<p key="k" role="status" className="py-2 text-body text-ink-2">{kobis.error}</p>);
    } else if (kobis.error) {
      // 실패는 [무슨 일] 한 문장 + 다음 행동은 그 자리 버튼(#826 결정 8).
      rows.push(
        <div key="k" className="flex min-h-touch items-center gap-2">
          <p role="alert" className="flex-1 text-body text-warn">{kobis.error}</p>
          {info.title.trim() && (
            <button type="button" onPointerDown={keepFocus} onClick={() => kobis.runSearch(info.title.trim())} className={cn(OPT_CLS, 'border-hair-strong text-ink')}>
            다시 검색
          </button>
          )}
        </div>
      );
    } else if (kobis.results.length > 0) {
      // 보이는 높이는 3행까지(행당 ~82.5px 실측, #476) — 넘치면 목록 안에서 스크롤한다. 고르면 open이 닫혀 한 줄로 돌아온다.
      rows.push(
        <KobisResultList
          key="k"
          results={kobis.results}
          onSelect={kobis.selectMovie}
          className="max-h-[248px] border-t border-hair"
          style={{ maxHeight: Math.min(248, listMaxHeight) }}
        />
      );
    }
  } else if (field === 'rating') {
    rows.push(<div key="stars">{rating.stars}</div>);
  } else if (field === 'watchDate') {
    const token = info.watchDateFormat || 'kr-compact';
    rows.push(
      <div key="fmt" role="toolbar" aria-label="관람일 옵션" className={TOOLBAR_CLS}>
        <OptionRadios<DateFormatToken> label="관람일 표기" options={FORMAT_OPTIONS} value={token} onChange={(watchDateFormat) => photo.updateMovieInfo({ watchDateFormat })} />
      </div>
    );
  } else if (field === 'releaseDate') {
    // 옵션 한 줄(D16 3-A): 정밀도 세그먼트 · 표기 미리보기(누르면 목록) · 재개봉 토글. 재개봉을 켜면 재개봉일 줄이 하나 더 생긴다.
    rows.push(
      <div key="opt" role="toolbar" aria-label="개봉일 옵션" className={cn(TOOLBAR_CLS, 'gap-2')}>
        <GranularitySegment value={releaseGran} onChange={(releaseDateGranularity) => photo.updateMovieInfo({ releaseDateGranularity })} />
        <button
          ref={formatBtnRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={listOpen}
          aria-label={`개봉일 표기, 지금 ${currentFormat.name}`}
          disabled={formatInert}
          title={formatInert ? '연만 쓰면 표기가 같아요' : undefined}
          onPointerDown={keepFocus}
          onClick={toggleList}
          className={cn(pressableVariants(), 'inline-flex h-touch min-w-0 shrink items-center disabled:opacity-40')}
        >
          <span className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-ctl border border-hair-strong bg-s2 px-2.5 text-body text-ink">
            <span className="tabular-nums truncate">{releasePreview(currentFormat)}</span>
            <Chevron dir={listOpen ? 'up' : 'down'} size={12} className="shrink-0 text-ink-3" />
          </span>
        </button>
        {/* 재개봉은 배타 선택이 아니라 독립 토글이라 라디오 밖 버튼이다(C-ACC). */}
        <button
          type="button"
          aria-pressed={!!info.isReissue}
          onPointerDown={keepFocus}
          onClick={() => photo.updateMovieInfo({ isReissue: !info.isReissue })}
          className={cn(OPT_CLS, optState(!!info.isReissue), 'ml-auto')}
        >
          재개봉
        </button>
      </div>
    );
    if (info.isReissue) {
      // 재개봉일은 정보 목록에 행이 없어 표시 토글이 여기 남는 유일한 예외다(D14-1 · constraint-7).
      rows.push(
        <div key="reissue" className="flex min-h-touch items-center gap-2">
          <div className="min-w-0 flex-1">
            <DateInput
              value={info.reissueDate || ''}
              granularity={releaseGran}
              onChange={(reissueDate) => photo.updateMovieInfo({ reissueDate })}
              ariaLabel="재개봉일"
              className={PANEL_INPUT_CLS}
            />
          </div>
          <span className="tabular-nums shrink-0 text-caption text-ink-3">{formatDate(info.reissueDate, releaseToken, releaseGran) || '—'}</span>
          <span className="inline-flex w-touch shrink-0 justify-center">
            <VisibilityCheckbox
              checked={photo.state.fieldVisibility.reissue}
              onChange={(v) => photo.updateFieldVisibility({ reissue: v })}
              label="재개봉일"
            />
          </span>
        </div>
      );
    }
  } else if (showFont || (isImageField && !stampImage)) {
    rows.push(
      <div key="opt" role="toolbar" aria-label={`${label} 옵션`} className="flex min-w-0 items-center gap-1">
        {showFont && (
          <>
            <button type="button" aria-label="이전 글꼴" onPointerDown={keepFocus} onClick={() => stepFont(-1)} className={cn(ICON_BTN_CLS, 'text-ink-3')}>
              <Chevron dir="left" />
            </button>
            <button
              ref={fontBtnRef}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={listOpen}
              aria-label={`${label} 글꼴, 지금 ${FONT_OPTIONS[fontIndex].label}`}
              onPointerDown={keepFocus}
              onClick={toggleList}
              className={cn(pressableVariants(), 'inline-flex h-touch min-w-0 flex-1 items-center justify-center px-1 text-ink')}
            >
              {/* 이름이 아니라 입력한 글을 그 서체로 쓴다(D14-2 A) — 이름은 접근 이름에만 둔다. */}
              <span className="truncate" style={userTextFont(fontSample, currentFont, FONT_SAMPLE_PX)}>{fontSample}</span>
            </button>
            <button type="button" aria-label="다음 글꼴" onPointerDown={keepFocus} onClick={() => stepFont(1)} className={cn(ICON_BTN_CLS, 'text-ink-3')}>
              <Chevron dir="right" />
            </button>
          </>
        )}
        {isImageField && (
          <button type="button" onPointerDown={keepFocus} onClick={pickImage} className={cn(OPT_CLS, optState(false), !showFont && 'ml-auto')}>
            이미지로
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {wrapperEl && rect && createPortal(<SelectionMarks rect={rect} />, wrapperEl)}
      {/* 티켓 래퍼로 가는 포커스(필드 전환)와 크롭 모달(이미지로 · 교체)이 가져간 포커스는 키보드 내림이 아니다(K-08 (b)). */}
      <KeyboardPanel
        label={label}
        inset={inset}
        onClose={onClose}
        panelRef={panelRef}
        isInside={(el) => !!wrapperEl?.contains(el)}
        suspended={() => !!logo.rawSrc}
        data={{ 'data-field-panel': field }}
      >
        <div className="flex h-touch items-center gap-2">
          <button type="button" aria-label="이전 항목" onPointerDown={keepFocus} onClick={() => step(-1)} className={cn(ICON_BTN_CLS, '-ml-1')}>
            <Chevron dir="left" />
          </button>
          <div className="flex min-w-0 flex-1 items-center">{slot}</div>
          <button type="button" aria-label="다음 항목" onPointerDown={keepFocus} onClick={() => step(1)} className={ICON_BTN_CLS}>
            <Chevron dir="right" />
          </button>
          {/* '닫기'(D15 2B) — 상단 줄 '완료'(티켓 완성)와 뜻이 겹치지 않게 마스터 입력 머리의 말을 쓴다. 입력값은 치는 즉시
              저장돼 닫아도 잃는 게 없어 주 동작 색(accent)이 아니라 테두리 버튼이다. */}
          <button
            type="button"
            onPointerDown={keepFocus}
            onClick={onClose}
            className={cn(pressableVariants(), 'inline-flex h-touch shrink-0 items-center')}
          >
            <span className="inline-flex h-9 items-center rounded-ctl border border-hair-strong px-3 text-body font-medium text-ink">닫기</span>
          </button>
        </div>
        {rows.length > 0 && <div className="mt-1 space-y-1">{rows}</div>}
        {showFont && listOpen && (
          <PanelListbox<QuoteFont>
            label={`${label} 글꼴`}
            options={FONT_OPTIONS.map((o) => ({
              value: o.value,
              name: o.label,
              // 항목마다 같은 글을 그 서체로(D14-2 A) — 서체끼리 비슷한 손글씨 계열을 이름 대신 글자면으로 가린다.
              preview: <span style={userTextFont(fontSample, o.value, FONT_SAMPLE_PX)}>{fontSample}</span>,
            }))}
            value={currentFont}
            maxHeight={listMaxHeight}
            triggerRef={fontBtnRef}
            onSelect={selectFont}
            onClose={closeList}
          />
        )}
        {field === 'releaseDate' && listOpen && !formatInert && (
          <PanelListbox<DateFormatToken>
            label="개봉일 표기"
            // 목록이 열렸을 때만 만든다 — 다른 필드의 타이핑 렌더마다 formatDate 4번을 돌리지 않게.
            options={DATE_FORMAT_TOKENS.map((t) => ({ value: t.value, name: t.name, preview: <span className="tabular-nums">{releasePreview(t)}</span> }))}
            value={releaseToken}
            maxHeight={listMaxHeight}
            triggerRef={formatBtnRef}
            onSelect={selectFormat}
            onClose={closeList}
          />
        )}
      </KeyboardPanel>
      {/* 이미지 업로드 파이프라인(로고 · 서명) — 숨김 input + 자유비 크롭(useLogoCrop). */}
      {isImageField && (
        <>
          {/* sr-only여도 tabbable이라 aria-hidden 금지(axe aria-hidden-focus). */}
          <input
            ref={logoInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            aria-label={`${label} 이미지 파일`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.type.startsWith('image/')) logo.openFile(file);
              e.target.value = '';
            }}
            className="sr-only"
          />
          {logo.rawSrc && (
            <ImageCropModal
              imageSrc={logo.rawSrc}
              // 같은 useLogoCrop을 극장 · 포맷 로고와 서명이 함께 쓰므로 지금 편집 중인 필드로 제목을 고른다.
              target={isSignature ? 'signature' : 'logo'}
              onClose={logo.handleCancel}
              onComplete={logo.handleComplete}
              isProcessing={logo.isCropping}
              cropFailed={logo.cropFailed}
              accept={IMAGE_ACCEPT}
              onPickFile={logo.openFile}
            />
          )}
        </>
      )}
    </>
  );
}
