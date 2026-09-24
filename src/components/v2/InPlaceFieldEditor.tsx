import dynamic from 'next/dynamic';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { usePhototicket } from '@/hooks/usePhototicket';
import type { MovieInfo, TicketComponents } from '@/types';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { useKobisSearch } from '@/hooks/useKobisSearch';
import { useLogoCrop } from '@/hooks/useLogoCrop';
import RatingPicker from '@/components/wizard/RatingPicker';
import { EyeIcon } from '@/components/ui/VisibilityCheckbox';
import { DateSheet, INPUT_CLS, KobisResultList } from './FieldEditorBody';
import {
  FIELD_INFO_KEY,
  FIELD_LABELS,
  STAMP_KEYS,
  STAMP_LABELS,
  STAMP_LABEL_MAX,
  QUOTE_MAX_LENGTH,
  isStampTarget,
  type SheetTarget,
} from '@/constants/fields';
import { isRequiredField } from '@/constants/fieldVisibility';

// 로고 크롭 모달 — StampSheet와 동일하게 dynamic(ssr:false)로 react-image-crop을 분리.
const ImageCropModal = dynamic(() => import('@/components/ImageCropModal'), { ssr: false });

type Photo = ReturnType<typeof usePhototicket>;

/**
 * prev/next 순회의 정본 순서(#354, 시안 editOrder). 실제 순회 목록은 현재 무드 DOM에 존재하는
 * data-field-tap만 걸러 만든다 — 무드가 렌더하지 않는 필드(MOOD_EXCLUDED_FIELDS + 조건부 미렌더)는
 * 탭 앵커 자체가 없어 구조적으로 빠진다. reissue는 FieldTap 타깃이 releaseDate라 여기 없음.
 */
const EDIT_ORDER: SheetTarget[] = [
  'title', 'titleOg', 'releaseDate', 'actors', 'rating', 'quote',
  'watchDate', 'watchTime', 'theater', 'screen', 'seat', 'runtime',
  'bookingNo', 'signature', 'chain', 'format',
];

/** 활성 필드의 지오메트리 — local(래퍼 좌표, 오버레이 배치용) + vpCenter(리프트 계산용, 리프트 성분 제거). */
interface FieldRect {
  top: number;
  left: number;
  w: number;
  h: number;
  /** 필드 세로 중심의 viewport Y — 래퍼 transform의 translateY 성분을 제거한 값(리프트 자기참조 방지). */
  vpCenter: number;
}

/**
 * data-field-tap(#354)은 #646부터 FieldTap이 children 자신(실제 레이아웃 박스가 있는 노드)에
 * 직접 붙인다 — 앵커를 찾으면 그게 곧 측정 대상이라 firstElementChild 인다이렉션이 필요 없다.
 * 래퍼(wrapper)의 현재 transform(리프트 중간값 포함)은 computed matrix로 읽어 스케일은 나누고
 * translateY는 빼서, 트랜지션 중간에 측정돼도 좌표가 흔들리지 않는다.
 */
function measureField(
  wrapper: HTMLElement,
  ticket: HTMLElement,
  field: SheetTarget
): FieldRect | null {
  // null은 "앵커가 DOM에 없음"(그 무드가 필드를 안 렌더)일 때만 — 오버레이 렌더 게이트.
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
    // ponytail: scale(1.08)이 origin(top center) 기준으로 세로 위치를 최대 ~2% 미는 건 무시 —
    // 리프트는 "키보드 위로 띄우기"라 ±20px 오차가 체감 안 된다.
    vpCenter: eb.top + eb.height / 2 - translateY,
  };
}

// 위치와 크기가 달라진 경우에만 입력 오버레이를 옮긴다.
const rectEq = (a: FieldRect | null, b: FieldRect | null) =>
  a === b ||
  (!!a && !!b &&
    Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5 &&
    Math.abs(a.vpCenter - b.vpCenter) < 0.5);

interface InPlaceFieldEditorProps {
  photo: Photo;
  /** 편집 중인 타깃. null 게이팅은 셸이 한다(이 컴포넌트는 편집 중에만 마운트). */
  field: SheetTarget;
  /** 리프트/스케일 transform이 걸리는 프리뷰 래퍼 — 오버레이(input·필드바) portal 대상. */
  wrapperEl: HTMLElement | null;
  /** TicketRenderer를 감싼 안쪽 div — 측정·MutationObserver 대상(오버레이 자신을 관찰하지 않게 분리). */
  ticketEl: HTMLElement | null;
  /**
   * prev/next 순회 — 순수 탐색이라 가시성을 건드리지 않는다(PR #359 리뷰 P1: 셸 handleField를
   * 재사용하면 경유한 숨김 필드가 전부 노출로 바뀐다). 숨김 필드 재켜기는 FieldTap 직접 재탭
   * (handleField)과 필드바 눈 토글만의 몫.
   */
  onField: (field: SheetTarget) => void;
  onClose: () => void;
  /** 편집 중 티켓 lift(px, ≤0) — 셸이 transform으로 적용. */
  onLift: (px: number) => void;
}

/**
 * 온티켓 인플레이스 필드 에디터(#354, 시안 §5).
 *
 * - 활성 필드에 16px Pretendard 입력칸을 얹는다. 긴 값은 네이티브 가로 스크롤로 편집한다.
 * - 필드바(prev · 로고 칩 · 노출 토글 · next · 완료)는 활성 필드 옆에 앵커링, 위 공간이 없으면 아래로.
 * - aid 패널(fixed, 키보드 위): 제목→KOBIS 결과, 평점→별점(RatingPicker), 날짜→DateSheet,
 *   이미지 스탬프→미리보기+제거. 페이드만(슬라이드 없음).
 * - 위치 계산은 rAF 루프 금지(#354) — MutationObserver(티켓 서브트리) + ResizeObserver(래퍼) +
 *   visualViewport 변경 시에만 1회 측정.
 */
export function InPlaceFieldEditor({ photo, field, wrapperEl, ticketEl, onField, onClose, onLift }: InPlaceFieldEditorProps) {
  const isStamp = isStampTarget(field);
  // 서명(#484 c6)은 StampTarget이 아니지만(c3 — 데이터가 MovieInfo에 산다) 이미지 업로드 UI는
  // chain/format과 동일하게 열려야 한다 — isStamp와 별개로 UI 분기만 공유하는 플래그.
  const isSignature = field === 'signature';
  const isImageField = isStamp || isSignature;
  const components = photo.state.components;
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
    // 필드 전환 시 무조건 상태 동기화 — remeasure의 epsilon 게이트를 우회해 stale rect(이전 필드
    // 위치에 오버레이가 남는 것)를 방지한다.
    const next = wrapperEl && ticketEl ? measureField(wrapperEl, ticketEl, field) : null;
    rectRef.current = next;
    setRect(next);
    if (!wrapperEl || !ticketEl) return;
    // 변경 시 1회 측정: 타이핑(characterData)·ghost 노드 스왑(childList)·fitFontSizeToWidth의
    // style 변경(attributes)은 MutationObserver가, 프리뷰 리사이즈는 ResizeObserver가 잡는다.
    // 오버레이는 래퍼에 portal되지만 관찰 대상은 티켓 div라 자기 갱신 루프가 없다.
    const mo = new MutationObserver(remeasure);
    mo.observe(ticketEl, { subtree: true, childList: true, characterData: true, attributes: true });
    const ro = new ResizeObserver(remeasure);
    ro.observe(wrapperEl);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, [remeasure, wrapperEl, ticketEl, field]);

  // ── visualViewport: 키보드 높이(aid 패널 bottom) + 가시 높이(리프트 목표) ──
  const [vvBox, setVvBox] = useState<{ h: number; bottom: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      if (vv) setVvBox({ h: vv.height, bottom: Math.max(0, window.innerHeight - vv.height - vv.offsetTop) });
      else setVvBox({ h: window.innerHeight, bottom: 0 });
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, []);

  // aid 패널(KOBIS 결과 목록) 가용 높이 — 키보드 위 가시영역(vvBox.h)에 비례해 늘린다(#476).
  // 새 측정 루프가 아니라 위 visualViewport effect가 이미 갱신하는 vvBox만 읽는다(#354 rAF 금지).
  // 0.7 배율은 실측(390×844, 키보드 높이 vv.h≈508 기준) 결과 행(제목+메타 2줄, 행당 ~82.5px)이
  // 3개 이상 완전히 들어가도록 역산한 값 — 0.6은 2.8행에 그쳐 3번째 행이 잘렸다(ac1). 세 번째
  // 항(vvBox.h - 16)은 가시영역 자체가 250px보다 좁은 화면(랜드스케이프 등)에서 하한이 vvBox.h를
  // 넘어 패널이 화면 위로 넘치는 걸 막는다(PR #478 리뷰 P1).
  const aidMaxHeight = vvBox ? Math.min(360, Math.max(176, vvBox.h * 0.7), vvBox.h - 16) : 250;

  // ── 리프트: 활성 필드 중심을 가시 영역 상단 35% 지점으로(키보드 위). 필드/키보드 변경 시에만
  // 재계산하고 타이핑(rect 갱신)마다 흔들지 않는다 — vpCenter가 리프트 성분을 제거한 값이라
  // 자기참조 발산이 없다. 위로만 민다(min 0).
  const hasRect = rect != null;
  useEffect(() => {
    const r = rectRef.current;
    if (!r) return;
    const visH = vvBox?.h ?? window.innerHeight;
    const target = Math.max(96, visH * 0.35);
    onLift(Math.min(0, Math.round(target - r.vpCenter)));
  }, [field, hasRect, vvBox?.h]);

  // ── 값 바인딩 ──────────────────────────────────────────────────────────────
  const infoKey = isStamp ? undefined : FIELD_INFO_KEY[field];
  const value = isStamp
    ? String(components[STAMP_KEYS[field].label] ?? '')
    : infoKey
      ? String(photo.state.movieInfo[infoKey] ?? '')
      : '';

  // KOBIS 검색(제목 aid) — TitleSheet와 동일한 공용 훅(#242 drift 방지).
  const kobis = useKobisSearch({
    apply: photo.beginMovieSelection,
  });

  const setValue = (v: string) => {
    if (isStamp) {
      photo.updateComponents({ [STAMP_KEYS[field].label]: v } as Partial<TicketComponents>);
    } else if (infoKey) {
      photo.updateMovieInfo({ [infoKey]: v } as Partial<MovieInfo>);
      if (field === 'title') kobis.scheduleSearch(v.trim());
    }
  };

  // 로고 업로드(필드바 이미지 칩) — StampSheet와 동일한 useLogoCrop 흐름. 서명(#484 c6)은
  // TicketComponents.signatureImage로 직접 쓴다(STAMP_KEYS에는 없음 — c3).
  const setStampImage = (url: string) => {
    if (isStamp) photo.updateComponents({ [STAMP_KEYS[field].image]: url } as Partial<TicketComponents>);
    else if (isSignature) photo.updateComponents({ signatureImage: url });
  };
  const logo = useLogoCrop(setStampImage);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const removeStampImage = () => {
    // revoke는 여기서 안 한다 — usePhototicket.updateComponents가 히스토리(#356) 참조 여부를 보고
    // 판정한다(#673).
    setStampImage('');
  };

  // ── 노출 토글 ──────────────────────────────────────────────────────────────
  const visible = isStamp ? !!components[STAMP_KEYS[field].visible] : photo.state.fieldVisibility[field];
  const toggleVisible = () => {
    if (isStamp) {
      photo.updateComponents({ [STAMP_KEYS[field].visible]: !visible } as Partial<TicketComponents>);
    } else {
      photo.updateFieldVisibility({ [field]: !visible });
    }
  };
  // rating은 aid(RatingPicker)가 자체 토글을, 필수 필드(title)는 숨기면 제목 없는 티켓이 되므로
  // 눈을 감춘다 — 필드 드로어 자물쇠·데스크톱 아코디언과 동일 규칙(#260).
  const showEye = field !== 'rating' && !(!isStamp && isRequiredField(field));

  // ── prev/next: 현재 무드 DOM에 실제 존재하는 필드만 순회 ─────────────────────
  const step = (dir: 1 | -1) => {
    if (!ticketEl) return;
    const order = EDIT_ORDER.filter((f) => ticketEl.querySelector(`[data-field-tap="${f}"]`));
    if (!order.length) return;
    const i = order.indexOf(field);
    onField(order[(i + dir + order.length) % order.length]);
  };

  // ── 인플레이스 input: 텍스트류만. 날짜/평점은 aid가 편집기라 input 없이 하이라이트만.
  // actors도 마찬가지(#447) — 티켓은 truncateActors로 "A, B, C 외 N명"을 표시 전용으로 자르는데,
  // 투명 오버레이 input의 value는 항상 원본 풀 텍스트라 박스는 잘린 표시 폭인데 caret은 풀 텍스트
  // 기준으로 움직여 어긋난다. 티켓 truncate는 그대로 두고(의도된 표시) 편집만 아래 aid 패널의
  // 일반 opaque input으로 분리 — rating/date와 동일한 기존 패턴 재사용. ──
  const hasInput =
    field !== 'rating' &&
    field !== 'watchDate' &&
    field !== 'releaseDate' &&
    field !== 'actors' &&
    !(isImageField && !!stampImage);

  const inputWidth = rect ? Math.min(Math.max(rect.w + 16, 160), wrapperEl?.offsetWidth || rect.w + 16) : 0;
  const inputHeight = rect ? Math.max(44, rect.h + 12) : 44;
  const inputLeft = rect ? Math.max(0, Math.min(rect.left - 8, (wrapperEl?.offsetWidth || inputWidth) - inputWidth)) : 0;

  // ── 필드바 배치: 필드 위 10px, 티켓 상단에 붙으면 아래로. 좌우는 래퍼 안으로 클램프. ──
  const barRef = useRef<HTMLDivElement>(null);
  const [barPos, setBarPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || !rect || !wrapperEl) {
      setBarPos(null);
      return;
    }
    const bw = bar.offsetWidth;
    const bh = bar.offsetHeight;
    const ww = wrapperEl.offsetWidth;
    const left = Math.max(-8, Math.min(ww - bw + 8, rect.left + rect.w / 2 - bw / 2));
    let top = rect.top - bh - 10;
    if (top < 8) top = rect.top + (hasInput ? inputHeight - 6 : rect.h) + 10;
    setBarPos({ left, top });
  }, [rect, field, wrapperEl, isStamp, showEye, hasInput, inputHeight]);

  const barBtnCls = cn(
    pressableVariants(),
    'inline-flex h-touch w-touch shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg'
  );

  const overlay = rect && (
    <>
      {/* 텍스트 입력은 UI 서체로 읽고 편집한다. 출력 티켓의 서체와 조판은 별도로 유지한다. */}
      {hasInput ? (
        <input
          key={`inplace-${field}`}
          autoFocus
          type={field === 'watchTime' ? 'time' : 'text'}
          // runtime(러닝타임)만 정수 전용(#684) — bookingNo는 OCR 스키마가 구분자 보존을 요구해 제외.
          // 값이 순수 숫자(또는 빈 값)일 때만 numeric — KOBIS 자동 채움은 "169 MIN"처럼 문자가 섞여
          // 있어(kobisLookup.ts extractKobisActorsRuntime) 그 값을 고치는 중엔 문자 키패드가 필요하다
          // (#685 fresh-eyes 리뷰). FieldEditorBody TextSheet와 같은 판정.
          inputMode={field === 'runtime' && /^\d*$/.test(value) ? 'numeric' : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          // 한글 IME 조합 커밋 시 trailing change 없이 값만 반영되는 IME가 있어(#82) 커밋 값으로 재검색.
          onCompositionEnd={(e) => {
            if (field === 'title') {
              const v = e.currentTarget.value.trim();
              if (v) kobis.scheduleSearch(v);
            }
          }}
          aria-label={label}
          maxLength={
            isStamp
              ? STAMP_LABEL_MAX
              : field === 'signature'
                ? 20
                : field === 'quote'
                  ? QUOTE_MAX_LENGTH
                  : undefined
          }
          style={{
            position: 'absolute',
            left: inputLeft,
            top: rect.top - 6,
            width: inputWidth,
            height: inputHeight,
            padding: '0 8px',
            zIndex: 60,
            border: '1px solid var(--accent)',
            borderRadius: 8,
            background: 'var(--surface-elevated)',
            color: 'var(--fg)',
            caretColor: 'var(--accent)',
            fontSize: 16,
            fontFamily: 'var(--font-sans)',
            fontWeight: 400,
            textAlign: 'left',
            outlineColor: 'var(--focus-ring)',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: rect.left - 8,
            top: rect.top - 6,
            width: rect.w + 16,
            height: rect.h + 12,
            zIndex: 60,
            borderRadius: 6,
            // 칩용 불투명 배경을 덮지 않고 원래 티켓의 날짜·평점·이미지를 보여준다.
            background: 'transparent',
            outline: '2px solid var(--focus-ring)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* 필드바 — 버튼 44px(h-touch w-touch). 시안 30px를 막았던 #354의 근거는 "앱 현행 44~48px 대비
          회귀"(일관성)였는데, 그 일관성 논거 자체는 #508이 플로팅 툴바를 32px로 내리며 번복했다.
          그래도 여기 44px은 **유지**한다 — 근거가 일관성에서 다음 둘로 갈아탔다(#553):
          (1) 이 바는 편집 중에만 뜨는 absolute 오버레이라, 줄여도 세로 예산을 한 픽셀도 안 돌려준다.
              32px을 산 대가(세로 공간)를 여기선 못 받으므로 AAA(SC 2.5.5 44px)를 포기할 이유가 없다.
          (2) 편집 중 주 조작면이 이 바다 — 필드 순회·노출 토글·완료를 연속으로 누르는 자리라
              정확도 요구가 상시 보조 툴바보다 높다.
          그래서 툴바 32 / 필드바 44는 어긋남이 아니라 의도된 위계다(FloatingToolbar.tsx 헤더가
          같은 판정을 반대편에서 기록). 두 값을 같이 고정하는 회귀는 이 파일의 테스트 맨 끝
          describe('탭 타깃 위계…')에 있다. */}
      <div
        ref={barRef}
        role="toolbar"
        aria-label="필드 편집 도구"
        className="absolute flex items-center gap-0.5 rounded-full border border-line bg-surface-elevated px-1"
        style={{
          left: barPos?.left ?? 0,
          top: barPos?.top ?? 0,
          zIndex: 70,
          boxShadow: 'var(--shadow-pop, 0 8px 20px -8px rgba(0,0,0,.4))',
          visibility: barPos ? 'visible' : 'hidden',
        }}
      >
        <button
          type="button"
          aria-label="이전 항목"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => step(-1)}
          className={barBtnCls}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />
        {isImageField && (
          <button
            type="button"
            aria-label="로고 이미지"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => logoInputRef.current?.click()}
            className={barBtnCls}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.6" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </button>
        )}
        {showEye && (
          <button
            type="button"
            role="switch"
            aria-checked={visible}
            aria-label="티켓 노출"
            onPointerDown={(e) => e.preventDefault()}
            onClick={toggleVisible}
            className={barBtnCls}
          >
            {/* 눈 아이콘은 채운 동공 필수 — 윤곽만으론 이 크기에서 눈으로 안 읽힌다(#354 시안 §5).
                아이콘 자체는 VisibilityCheckbox의 EyeIcon과 공유(#355). */}
            <EyeIcon open={visible} />
          </button>
        )}
        <button
          type="button"
          aria-label="다음 항목"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => step(1)}
          className={barBtnCls}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="편집 완료"
          onPointerDown={(e) => e.preventDefault()}
          onClick={onClose}
          className={cn(pressableVariants(), 'inline-flex h-touch w-touch shrink-0 items-center justify-center rounded-full')}
          style={{ background: 'linear-gradient(135deg, var(--accent-hover), var(--accent))', color: 'var(--accent-ink)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>
      </div>
    </>
  );

  // ── aid 패널 콘텐츠(키보드 위, 페이드만) ──────────────────────────────────
  let aid: ReactNode = null;
  if (field === 'title' && kobis.open) {
    aid = kobis.loading ? (
      <div className="text-mono px-4 py-4 text-center text-micro uppercase tracking-widest text-fg-muted">Loading…</div>
    ) : kobis.error ? (
      <div role="alert" className="text-mono px-4 py-4 text-center text-micro uppercase tracking-widest text-danger">
        {kobis.error}
      </div>
    ) : kobis.results.length > 0 ? (
      <KobisResultList results={kobis.results} onSelect={kobis.selectMovie} style={{ maxHeight: aidMaxHeight }} />
    ) : null;
  } else if (field === 'actors') {
    // 티켓 truncate(외 N명)는 표시 전용으로 그대로 두고, 편집은 풀 텍스트 opaque input으로(#447).
    aid = (
      <div className="p-4">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={label}
          className={INPUT_CLS}
        />
      </div>
    );
  } else if (field === 'rating') {
    aid = (
      <div className="p-4">
        <RatingPicker
          value={photo.state.movieInfo.rating}
          onValueChange={(rating) => photo.updateMovieInfo({ rating })}
          visible={photo.state.fieldVisibility.rating}
          onVisibleChange={(v) => photo.updateFieldVisibility({ rating: v })}
        />
      </div>
    );
  } else if (field === 'watchDate' || field === 'releaseDate') {
    aid = (
      <div className="p-4">
        <DateSheet field={field} photo={photo} />
      </div>
    );
  } else if (isImageField && stampImage) {
    aid = (
      <div className="flex items-center gap-3 p-4">
        <img src={stampImage} alt={`${label} 이미지`} className="h-8 w-auto object-contain" />
        <button
          type="button"
          onClick={removeStampImage}
          className={cn(pressableVariants(), 'ml-auto rounded-chip border border-line px-3 py-1.5 text-caption font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent')}
        >
          이미지 제거
        </button>
      </div>
    );
  }

  return (
    <>
      {/* 밖 탭으로 닫기 — 티켓(래퍼 z-[41])과 필드바·aid는 이 위라 필드 전환/도구 조작은 그대로 된다. */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      {wrapperEl && createPortal(overlay, wrapperEl)}
      {aid && (
        <div
          className="fixed inset-x-3 z-50 overflow-hidden rounded-card border border-line bg-surface-elevated"
          style={{
            bottom: (vvBox?.bottom ?? 0) + 12,
            boxShadow: 'var(--shadow-pop, 0 8px 24px -8px rgba(0,0,0,.4))',
            // 슬라이드 없이 페이드만(#354 시안 §5) — reduced-motion은 전역 가드가 duration을 죽인다.
            animation: 'screen-in .18s ease-out',
          }}
        >
          {aid}
        </div>
      )}
      {/* 로고 업로드 파이프라인(스탬프+서명 전용) — 숨김 input + 자유비 크롭(useLogoCrop, StampSheet와 동형). */}
      {isImageField && (
        <>
          {/* sr-only여도 tabbable이라 aria-hidden 금지(axe aria-hidden-focus) — FieldDrawer.tsx:297와 동일 판단. */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
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
              title="로고 크롭"
              onClose={logo.handleCancel}
              onComplete={logo.handleComplete}
              isProcessing={logo.isCropping}
            />
          )}
        </>
      )}
    </>
  );
}
