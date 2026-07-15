import { useEffect, useRef, useState, type PointerEvent } from 'react';

/**
 * 플로팅 툴바(#356, v8 시안 §4) — undo · redo | 항목목록 · 최대화 | 기어(배치) · 숨김.
 *
 * - 버튼 44px(시안 31px은 앱 현행 44~48px 대비 회귀 — 이슈 표), dark-glass 배경
 *   (--surface-translucent 재사용: README §Design Tokens, 시안 불투명 코드는 모순으로 기각).
 * - 방향(가로/세로) × 배치(고정/이동) 두 축. 기본 세로·고정·좌측 헤더 직하(#364).
 * - 이동식은 44px 그립 드래그(시안 12px은 WCAG 2.2 SC 2.5.8 미달) + 기어 메뉴의
 *   좌/우 가장자리 스냅(드래그 없는 단일 포인터 대체 경로, WCAG 2.2 SC 2.5.7).
 * - 숨김 → 툴바 top-left 원점에 앵커된 원형 버튼으로 접힘(중심 앵커는 탭 위치로 튄다 — 이슈).
 * - 위치·방향·숨김은 filme:toolbar:v1로 자동 영속(문서 키 filme:phototicket:v1과 분리, #310과
 *   무충돌 — 이건 UI 취향이라 phototicket:theme 선례를 따른다).
 * - 겹침 규칙(이슈 "설계가 필요한 것"): 티켓과는 반투명 글래스로 위에 뜨는 걸 수용(옵션 b,
 *   기어/드래그/숨김으로 회피 가능). z-45 — 인플레이스 편집 백드롭(z-40) 위(편집 중에도 동작),
 *   FieldDrawer(z-50) 아래(드로어는 모달이라 위가 맞다). max 모드에선 셸이 툴바를 렌더하지
 *   않는다(탈출은 기존 티켓 탭).
 */

type TbOrient = 'v' | 'h';
type TbPlace = 'fixed' | 'movable';

const TB_STORAGE_KEY = 'filme:toolbar:v1';
const EDGE = 8; // 이동식 클램프·스냅 여백

interface TbPrefs {
  orient: TbOrient;
  place: TbPlace;
  x: number | null;
  y: number | null;
  hidden: boolean;
}

const DEFAULT_PREFS: TbPrefs = { orient: 'v', place: 'fixed', x: null, y: null, hidden: false };

function loadPrefs(): TbPrefs {
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

const ICON = {
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

const MODES: { label: string; orient: TbOrient; place: TbPlace }[] = [
  { label: '세로형 · 고정식', orient: 'v', place: 'fixed' },
  { label: '세로형 · 이동식', orient: 'v', place: 'movable' },
  { label: '가로형 · 고정식', orient: 'h', place: 'fixed' },
  { label: '가로형 · 이동식', orient: 'h', place: 'movable' },
];

interface FloatingToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** 항목목록 — 필드 드로어 열기(#360 임시 헤더 버튼을 이 버튼이 대체). */
  onFieldList: () => void;
  onMaximize: () => void;
}

export function FloatingToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onFieldList,
  onMaximize,
}: FloatingToolbarProps) {
  // 렌더는 저장값으로 시작해도 SSR 불일치가 없다 — 셸이 mounted 이후에만 이 컴포넌트를
  // 렌더하므로(usePhototicket의 effect 복원과 달리) lazy 초기화로 충분하다.
  const [prefs, setPrefs] = useState<TbPrefs>(loadPrefs);
  const { orient, place, hidden } = prefs;
  const pos = prefs.x != null && prefs.y != null ? { x: prefs.x, y: prefs.y } : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuSide, setMenuSide] = useState<'start' | 'end'>('start');
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // 자동 영속 — 드래그가 매 move마다 setPrefs하므로 300ms 디바운스로 localStorage 쓰기를 묶는다.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(TB_STORAGE_KEY, JSON.stringify(prefs));
      } catch {
        // 영속 실패(쿼터·프라이빗 모드)는 무시 — best-effort.
      }
    }, 300);
    return () => clearTimeout(t);
  }, [prefs]);

  // 저장된 이동식 좌표는 뷰포트가 좁아지는 리사이즈·화면 회전에서 화면 밖으로 나갈 수 있고
  // (PR #361 리뷰 P2), 영속된 좌표라 저장 당시보다 좁은 뷰포트로 다시 열 수도 있다(#190)
  // — 마운트 시 1회 + resize마다 재클램프. 드래그 중 재실행은 이미 클램프된 좌표라 no-op.
  useEffect(() => {
    if (place !== 'movable' || !pos) return;
    const reclamp = () => {
      const el = rootRef.current;
      const w = el?.offsetWidth ?? 52;
      const h = el?.offsetHeight ?? 52;
      const x = Math.max(EDGE, Math.min(window.innerWidth - w - EDGE, pos.x));
      const y = Math.max(EDGE, Math.min(window.innerHeight - h - EDGE, pos.y));
      if (x !== pos.x || y !== pos.y) setPrefs((prev) => ({ ...prev, x, y }));
    };
    reclamp();
    window.addEventListener('resize', reclamp);
    return () => window.removeEventListener('resize', reclamp);
  }, [place, pos?.x, pos?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  // 배치 서브메뉴는 바깥 탭 외에 Escape로도 닫힌다(PR #361 리뷰 P2).
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const clampPos = (x: number, y: number) => {
    const el = rootRef.current;
    const w = el?.offsetWidth ?? 52;
    const h = el?.offsetHeight ?? 52;
    return {
      x: Math.max(EDGE, Math.min(window.innerWidth - w - EDGE, x)),
      y: Math.max(EDGE, Math.min(window.innerHeight - h - EDGE, y)),
    };
  };

  const applyMode = (o: TbOrient, p: TbPlace) => {
    // 모드 전환은 프리셋 기본 위치로 리셋(x/y null) — 방향이 바뀌면 이전 좌표는 클램프 밖일 수 있다.
    setPrefs((prev) => ({ ...prev, orient: o, place: p, x: null, y: null }));
    setMenuOpen(false);
  };

  const snapTo = (side: 'left' | 'right') => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = side === 'left' ? EDGE : window.innerWidth - rect.width - EDGE;
    setPrefs((prev) => ({ ...prev, x, y: rect.top }));
    setMenuOpen(false);
  };

  const toggleMenu = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setMenuSide(rect.left + rect.width / 2 > window.innerWidth / 2 ? 'end' : 'start');
    setMenuOpen((v) => !v);
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
    setPrefs((prev) => ({ ...prev, x: c.x, y: c.y }));
  };
  const onGripUp = () => {
    dragRef.current = null;
  };

  // 위치 스타일 — 이동식은 transform(translate)만 움직인다(left/top 애니메이트 금지 — 이슈 표).
  // 고정식 프리셋은 CSS 값이라 리사이즈에 자동 대응. 세로·고정 기본은 헤더(56px) 바로 아래 —
  // 이전 30vh는 화면 세로 중간대라 fit 스테이지(#370)로 커진 티켓의 중심부와 겹쳤다(#364,
  // v8 "raised well above center"). safe-area 기준 고정값이라 Safari 동적 툴바(vh 변동)와 무관.
  const posStyle: React.CSSProperties =
    place === 'movable'
      ? pos
        ? { left: 0, top: 0, transform: `translate(${pos.x}px, ${pos.y}px)` }
        : { right: 14, top: 'calc(env(safe-area-inset-top, 0px) + 126px)' } // 이동식 기본: 우상단(시안)
      : orient === 'v'
        ? { left: 14, top: 'calc(env(safe-area-inset-top, 0px) + 70px)' }
        : {
            left: '50%',
            transform: 'translateX(-50%)',
            top: 'calc(env(safe-area-inset-top, 0px) + 70px)',
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
        type="button"
        onClick={() => setPrefs((prev) => ({ ...prev, hidden: false }))}
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
      ref={rootRef}
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
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="툴바 배치 설정"
        className={btn}
      >
        <svg {...ICON} strokeWidth={1.9} width={17} height={17}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          setPrefs((prev) => ({ ...prev, hidden: true }));
        }}
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

      {menuOpen && (
        <>
          {/* 밖 탭으로 닫기 — 같은 스택 컨텍스트 안에서 메뉴가 뒤에 오므로 메뉴 위 조작은 산다. */}
          <div className="fixed inset-0" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          {/* 배치 서브메뉴 — 툴바 자신에 부착(바텀시트 아님, 이슈 결정). 세로형은 옆, 가로형은 아래로
              열고, 툴바가 화면 오른쪽 절반이면 반대쪽 정렬로 화면 밖 넘침을 피한다. */}
          <div
            role="menu"
            aria-label="툴바 배치"
            className="absolute w-48 rounded-card border border-line bg-surface-elevated p-2 shadow-card"
            style={
              horiz
                ? { top: 'calc(100% + 8px)', ...(menuSide === 'end' ? { right: 0 } : { left: 0 }) }
                : menuSide === 'end'
                  ? { right: 'calc(100% + 8px)', top: 0 }
                  : { left: 'calc(100% + 8px)', top: 0 }
            }
          >
            {MODES.map((m) => {
              const on = orient === m.orient && place === m.place;
              return (
                <button
                  key={m.label}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => applyMode(m.orient, m.place)}
                  className={`flex h-11 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-[12px] font-semibold ${
                    on ? 'bg-accent-soft text-accent' : 'text-fg'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-[7px] w-[7px] shrink-0 rounded-full ${on ? 'bg-accent' : 'bg-border-strong'}`}
                  />
                  {m.label}
                </button>
              );
            })}
            {place === 'movable' && (
              <div className="mt-1 flex gap-1 border-t border-line pt-1.5">
                {/* 드래그 없는 위치 조정 대체 경로(WCAG 2.2 SC 2.5.7) — 좌/우 가장자리 스냅.
                    텍스트 버튼 대신 아이콘화(#364) — 접근명·역할은 유지해 2.5.7을 계속 만족한다. */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => snapTo('left')}
                  aria-label="왼쪽 가장자리로 이동"
                  title="왼쪽 가장자리로 이동"
                  className="flex h-11 flex-1 items-center justify-center rounded-[9px] text-fg-muted transition-colors hover:text-fg"
                >
                  <svg {...ICON}>
                    <path d="M3 19V5" />
                    <path d="m13 6-6 6 6 6" />
                    <path d="M7 12h14" />
                  </svg>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => snapTo('right')}
                  aria-label="오른쪽 가장자리로 이동"
                  title="오른쪽 가장자리로 이동"
                  className="flex h-11 flex-1 items-center justify-center rounded-[9px] text-fg-muted transition-colors hover:text-fg"
                >
                  <svg {...ICON}>
                    <path d="M21 5v14" />
                    <path d="m11 18 6-6-6-6" />
                    <path d="M17 12H3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
