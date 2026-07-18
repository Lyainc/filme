import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent } from 'react';

/**
 * 플로팅 툴바(#356, v8 시안 §4) — undo · redo | 항목목록 · 최대화 | 숨김.
 * 배치설정(방향/위치)은 #387에서 햄버거 메뉴로 이전 — prefs는 부모(MobileEditorShell)가
 * 소유하는 controlled 값이라 이 컴포넌트는 렌더·드래그·리클램프만 담당한다.
 *
 * - 버튼 44px(시안 31px은 앱 현행 44~48px 대비 회귀 — 이슈 표), dark-glass 배경
 *   (--surface-translucent 재사용: README §Design Tokens, 시안 불투명 코드는 모순으로 기각).
 * - 방향(가로/세로) × 배치(고정/이동) 두 축. 기본 세로·고정·좌측 헤더 직하(#364).
 * - 이동식은 44px 그립 드래그(시안 12px은 WCAG 2.2 SC 2.5.8 미달) + 햄버거 메뉴의
 *   좌/우 가장자리 스냅(드래그 없는 단일 포인터 대체 경로, WCAG 2.2 SC 2.5.7).
 * - 숨김 → 툴바 top-left 원점에 앵커된 원형 버튼으로 접힘(중심 앵커는 탭 위치로 튄다 — 이슈).
 * - 위치·방향·숨김은 filme:toolbar:v1로 자동 영속(문서 키 filme:phototicket:v1과 분리, #310과
 *   무충돌 — 이건 UI 취향이라 phototicket:theme 선례를 따른다). 영속 저장은 부모가 담당(#387).
 * - 겹침 규칙(이슈 "설계가 필요한 것"): 티켓과는 반투명 글래스로 위에 뜨는 걸 수용(옵션 b,
 *   기어/드래그/숨김으로 회피 가능). z-45 — 인플레이스 편집 백드롭(z-40) 위(편집 중에도 동작),
 *   FieldDrawer(z-50) 아래(드로어는 모달이라 위가 맞다). max 모드에선 셸이 툴바를 렌더하지
 *   않는다(탈출은 기존 티켓 탭).
 */

export type TbOrient = 'v' | 'h';
export type TbPlace = 'fixed' | 'movable';

export const TB_STORAGE_KEY = 'filme:toolbar:v1';
export const TB_EDGE = 8; // 이동식 클램프·스냅 여백 — 배치 스냅(#387)도 부모가 이 값으로 계산한다.

export interface TbPrefs {
  orient: TbOrient;
  place: TbPlace;
  x: number | null;
  y: number | null;
  hidden: boolean;
}

export const DEFAULT_PREFS: TbPrefs = { orient: 'v', place: 'fixed', x: null, y: null, hidden: false };

export function loadPrefs(): TbPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(TB_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? { ...DEFAULT_PREFS, ...p } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export const ICON = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

// 배치 메뉴(#387에서 햄버거로 이전) 라디오 옵션 — MobileEditorShell이 렌더한다.
export const TOOLBAR_MODES: { label: string; orient: TbOrient; place: TbPlace }[] = [
  { label: '세로형 · 고정식', orient: 'v', place: 'fixed' },
  { label: '세로형 · 이동식', orient: 'v', place: 'movable' },
  { label: '가로형 · 고정식', orient: 'h', place: 'fixed' },
  { label: '가로형 · 이동식', orient: 'h', place: 'movable' },
];

interface FloatingToolbarProps {
  prefs: TbPrefs;
  onPrefsChange: (updater: (prev: TbPrefs) => TbPrefs) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** 항목목록 — 필드 드로어 열기(#360 임시 헤더 버튼을 이 버튼이 대체). */
  onFieldList: () => void;
  onMaximize: () => void;
  /** 세로·고정 기본 위치가 이 아래로 오도록 실측하는 헤더 엘리먼트(#419). */
  headerEl?: HTMLElement | null;
  /** 가로·고정 배치가 이 위(티켓 콘텐츠)를 침범하지 않도록 실측하는 엘리먼트(#419). */
  contentTopEl?: HTMLElement | null;
}

// 실측 실패(마운트 전) 시 폴백 — 세로는 이슈가 명시한 최소 안전값(76~80px)으로 상향(#419, 이전 60px).
const TB_FALLBACK_TOP_V = 'calc(env(safe-area-inset-top, 0px) + 78px)';
const TB_FALLBACK_TOP_H = 'calc(env(safe-area-inset-top, 0px) + 70px)';
const TB_HEADER_MARGIN = 12; // 헤더 아래 여백
const TB_CONTENT_MARGIN = 10; // 티켓 콘텐츠 위 여백

export const FloatingToolbar = forwardRef<HTMLDivElement, FloatingToolbarProps>(function FloatingToolbar(
  { prefs, onPrefsChange, canUndo, canRedo, onUndo, onRedo, onFieldList, onMaximize, headerEl, contentTopEl },
  forwardedRef,
) {
  const { orient, place, hidden } = prefs;
  const pos = prefs.x != null && prefs.y != null ? { x: prefs.x, y: prefs.y } : null;
  // hidden 분기(button)와 일반 분기(div) 양쪽에 붙는 공용 ref — 부모(MobileEditorShell)가
  // 배치 스냅 계산(getBoundingClientRect)에 이 DOM을 참조한다(#387). hidden 상태에서도 스냅이
  // 조용히 no-op되지 않도록(claude-review PR #405 P1) 두 분기 모두에 연결한다.
  const rootRef = useRef<HTMLDivElement | HTMLButtonElement | null>(null);
  // div/button 두 엘리먼트 타입이 섞이는 유니언 ref라 콜백 형태로 붙인다(각 JSX의 ref prop이
  // 요구하는 구체 타입과 RefObject<union>은 직접 호환되지 않는다).
  const setRootEl = (el: HTMLDivElement | HTMLButtonElement | null) => {
    rootRef.current = el;
  };
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // 저장된 이동식 좌표는 뷰포트가 좁아지는 리사이즈·화면 회전에서 화면 밖으로 나갈 수 있고
  // (PR #361 리뷰 P2), 영속된 좌표라 저장 당시보다 좁은 뷰포트로 다시 열 수도 있다(#190)
  // — 마운트 시 1회 + resize마다 재클램프. 드래그 중 재실행은 이미 클램프된 좌표라 no-op.
  useEffect(() => {
    if (place !== 'movable' || !pos) return;
    const reclamp = () => {
      const el = rootRef.current;
      const w = el?.offsetWidth ?? 52;
      const h = el?.offsetHeight ?? 52;
      const x = Math.max(TB_EDGE, Math.min(window.innerWidth - w - TB_EDGE, pos.x));
      const y = Math.max(TB_EDGE, Math.min(window.innerHeight - h - TB_EDGE, pos.y));
      if (x !== pos.x || y !== pos.y) onPrefsChange((prev) => ({ ...prev, x, y }));
    };
    reclamp();
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [place, pos?.x, pos?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // 고정식 top 실측(#419) — 헤더/티켓 콘텐츠 ref의 실제 렌더 위치로 계산해 매직넘버 겹침을 없앤다.
  // 세로는 헤더 바로 아래, 가로는 티켓 콘텐츠(LOGO/FORMAT 스탬프 포함) 위쪽에 오도록 클램프.
  const [fixedTop, setFixedTop] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });
  useEffect(() => {
    if (place !== 'fixed') return;
    const measure = () => {
      const headerBottom = headerEl?.getBoundingClientRect().bottom ?? null;
      const contentTop = contentTopEl?.getBoundingClientRect().top ?? null;
      const toolbarH = rootRef.current?.offsetHeight ?? 52;
      setFixedTop({
        v: headerBottom != null ? headerBottom + TB_HEADER_MARGIN : null,
        h:
          headerBottom != null && contentTop != null
            ? Math.max(headerBottom + TB_HEADER_MARGIN, contentTop - toolbarH - TB_CONTENT_MARGIN)
            : null,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [place, orient, headerEl, contentTopEl]);

  const clampPos = (x: number, y: number) => {
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 52;
    const h = el?.offsetHeight ?? 52;
    return {
      x: Math.max(TB_EDGE, Math.min(window.innerWidth - w - TB_EDGE, x)),
      y: Math.max(TB_EDGE, Math.min(window.innerHeight - h - TB_EDGE, y)),
    };
  };

  const onGripDown = (e: PointerEvent<HTMLElement>) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { px: e.clientX, py: e.clientY, ox: rect.left, oy: rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: PointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const c = clampPos(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py));
    onPrefsChange((prev) => ({ ...prev, x: c.x, y: c.y }));
  };
  const onGripUp = () => {
    dragRef.current = null;
  };

  // 위치 스타일 — 이동식은 transform(translate)만 움직인다(left/top 애니메이트 금지 — 이슈 표).
  // 고정식은 headerEl/contentTopEl 실측(#419) — 세로는 헤더 바로 아래, 가로는 티켓 콘텐츠(LOGO/FORMAT
  // 스탬프 포함) 위쪽 클램프로 겹침을 없앤다. 실측 전(마운트 직후 1프레임)엔 안전한 폴백 값을 쓴다.
  const posStyle: React.CSSProperties =
    place === 'movable'
      ? pos
        ? { left: 0, top: 0, transform: `translate(${pos.x}px, ${pos.y}px)` }
        : { right: 14, top: 'calc(env(safe-area-inset-top, 0px) + 126px)' } // 이동식 기본: 우상단(시안)
      : orient === 'v'
        ? { left: 14, top: fixedTop.v ?? TB_FALLBACK_TOP_V }
        : {
            left: '50%',
            transform: 'translateX(-50%)',
            top: fixedTop.h ?? TB_FALLBACK_TOP_H,
          };

  const glass: React.CSSProperties = {
    background: 'var(--surface-translucent)',
    backdropFilter: 'blur(13px)',
    WebkitBackdropFilter: 'blur(13px)',
    boxShadow: '0 8px 20px -8px rgba(0,0,0,.5)',
  };

  if (hidden) {
    return (
      <button
        ref={setRootEl}
        type="button"
        onClick={() => onPrefsChange((prev) => ({ ...prev, hidden: false }))}
        aria-label="툴바 표시"
        className="fixed z-[45] flex h-11 w-11 items-center justify-center rounded-full border border-line text-fg-muted transition-colors hover:text-fg"
        style={{ ...posStyle, ...glass }}
      >
        <svg {...ICON}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    );
  }

  const horiz = orient === 'h';
  const btn =
    'flex h-11 w-11 items-center justify-center rounded-[10px] text-fg-muted transition-colors hover:text-fg disabled:text-fg-faint disabled:hover:text-fg-faint';
  const divider = horiz ? 'mx-0.5 h-[18px] w-px bg-line' : 'my-0.5 h-px w-[18px] bg-line';

  return (
    <div
      ref={setRootEl}
      role="toolbar"
      aria-label="편집 도구"
      aria-orientation={horiz ? 'horizontal' : 'vertical'}
      className={`fixed z-[45] flex items-center rounded-[13px] border border-line p-1 ${
        horiz ? 'flex-row' : 'flex-col'
      }`}
      style={{ ...posStyle, ...glass }}
    >
      {place === 'movable' && (
        <span
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          aria-hidden="true"
          className={`flex shrink-0 cursor-grab items-center justify-center ${
            horiz ? 'h-11 w-11' : 'h-11 w-11'
          }`}
          style={{ touchAction: 'none' }}
        >
          <span className={`flex gap-[3px] ${horiz ? 'flex-col' : 'flex-row'}`} aria-hidden="true">
            <span className="h-[3px] w-[3px] rounded-full bg-fg-faint" />
            <span className="h-[3px] w-[3px] rounded-full bg-fg-faint" />
            <span className="h-[3px] w-[3px] rounded-full bg-fg-faint" />
          </span>
        </span>
      )}

      {/* 라벨은 '실행 취소' — OCR 배너의 '되돌리기' 버튼과 접근명이 겹치면 SR·테스트 쿼리가
          충돌한다(useOcrUndo는 별도 유지가 이슈 결정이라 이름으로 구분). */}
      <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="실행 취소" className={btn}>
        <svg {...ICON}>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="다시 실행" className={btn}>
        <svg {...ICON}>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
        </svg>
      </button>

      <span className={divider} aria-hidden="true" />

      <button type="button" onClick={onFieldList} aria-haspopup="dialog" aria-label="티켓 항목 목록" className={btn}>
        <svg {...ICON} width={18} height={18}>
          <line x1="9" y1="6" x2="20" y2="6" />
          <line x1="9" y1="12" x2="20" y2="12" />
          <line x1="9" y1="18" x2="20" y2="18" />
          <circle cx="4.5" cy="6" r="0.5" fill="currentColor" />
          <circle cx="4.5" cy="12" r="0.5" fill="currentColor" />
          <circle cx="4.5" cy="18" r="0.5" fill="currentColor" />
        </svg>
      </button>
      <button type="button" onClick={onMaximize} aria-label="최대화" className={btn}>
        <svg {...ICON}>
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M16 3h3a2 2 0 0 1 2 2v3" />
          <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>

      <span className={divider} aria-hidden="true" />

      <button
        type="button"
        onClick={() => onPrefsChange((prev) => ({ ...prev, hidden: true }))}
        aria-label="툴바 숨기기"
        className={btn}
      >
        <svg {...ICON}>
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
      </button>
    </div>
  );
});
