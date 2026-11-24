import type { CSSProperties, FocusEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutId } from '@/types';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { readDraftSavedAt } from '@/hooks/usePhototicket';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { LAYOUTS } from '@/utils/layouts';
import { Chevron } from './AppFooter';
import { LandingAttachSheet } from './LandingAttachSheet';
import type { AttachScreenshotState } from './LandingAttachSheet';
import { LandingNoticeSheet } from './LandingNoticeSheet';
import { Wordmark } from './Wordmark';

/** 자동 전환 간격 — 마스터 L-01 '4초마다'(#826 S5 constraint-4). */
const CAROUSEL_INTERVAL_MS = 4000;
/** 자리 이동에 걸리는 시간. 간격(4초) 안에서 끝나야 다음 칸이 겹치지 않는다. */
const CAROUSEL_TRANSITION_MS = 1240;
/** 이 시간을 넘겨 누르고 있으면 "길게 누름"이다. 그 뒤 손을 떼도 무드로 진입하지 않는다. */
const LONG_PRESS_MS = 350;
/** 이만큼 가로로 끌면 스와이프다 — 넘길 때마다 원점을 다시 잡아 한 제스처로 여러 칸이 넘어간다. */
const SWIPE_STEP_PX = 28;
/** 랜딩 안내가 위치 표시 자리에 머무는 시간 — 카드의 자체 토스트 수명과 같다(OcrUploadCard). */
export const LANDING_NOTICE_MS = 3000;
/** 오버레이가 걷힐 때 전환(마스터 12-tokens-space dur-2 · ease, constraint-7). */
const OVERLAY_EXIT_MS = 240;
const OVERLAY_EXIT = `${OVERLAY_EXIT_MS}ms cubic-bezier(.2,.7,.2,1)`;
/** 세로 티켓 비율 — 갤러리 카드는 무드와 무관하게 전부 이 비율로 선다(아래 GALLERY_ROTATED). */
const CARD_ASPECT = '960 / 1534';

/**
 * 히어로 갤러리에 세우는 무드 — `LAYOUTS` 전체가 아니다(사용자 피드백 2026-08-08, 마스터 L-01 '현행 유지').
 *
 * 캔버스가 가로인 두 무드(`editorial` 1534×960, `35mm-landscape`)가 세로 카드 사이에 섞이면 같은 카드 폭에서
 * 높이만 62%로 주저앉아 리듬이 깨진다. 둘을 다르게 처리하는 이유는 대체 가능성이다: 35mm 와이드는 같은 필름
 * 계열인 35mm(세로)가 이미 있어 빼도 표현이 안 사라지지만, 에디토리얼은 유일한 편집 디자인이라 빼는 대신
 * 세로로 돌려 세운다. 돌리는 건 전시용일 뿐 무드 자체(`LAYOUTS`의 `orientation`·크롭 프리셋 #529)는 그대로다.
 */
type GalleryLayoutId = Exclude<LayoutId, '35mm-landscape'>;
type GalleryLayout = (typeof LAYOUTS)[number] & { id: GalleryLayoutId };
export const GALLERY_LAYOUTS = LAYOUTS.filter(
  (l): l is GalleryLayout => l.id !== '35mm-landscape'
);
/**
 * 갤러리 전경 이미지(#613) — `public/assets/landing/`의 실제 무드 렌더 결과물. 무드 조판이 바뀌면 여기도
 * 다시 구워야 한다(README 참고). `Record<GalleryLayoutId, string>`(Partial 아님, PR #759 P1)이라 새 무드나
 * 키 오타를 컴파일러가 잡는다.
 */
const HERO_IMAGES: Record<GalleryLayoutId, string> = {
  minimal: '/assets/landing/hero-minimal.webp',
  criterion: '/assets/landing/hero-criterion.webp',
  '35mm': '/assets/landing/hero-35mm.webp',
  editorial: '/assets/landing/hero-editorial.webp',
  stub: '/assets/landing/hero-stub.webp',
};
/** 갤러리에서만 90° 돌려 세로로 세우는 무드. 시계 방향(90deg)이라 editorial의 오른쪽 붉은 stub 밴드가
 *  아래에 선다(사용자 요청). 반시계로 돌리면 밴드가 위로 올라가니 실물 확인 없이 부호를 뒤집지 말 것. */
const GALLERY_ROTATED: ReadonlySet<LayoutId> = new Set<LayoutId>(['editorial']);

/** 옆 카드 배율과 가운데 카드 가장자리까지의 거리 — translateX의 %는 자기 폭 기준이라 카드 폭(높이에서 나옴)을 몰라도
 *  CSS만으로 정해진다. 옆 카드(0.82배) 가장자리가 가운데 카드에서 16px 이상 떨어진다(S9 constraint-4). */
const SIDE_SCALE = 0.82;
const SIDE_STEP = 'calc(91% + 18px)';

/** 카드 높이 — 전시(container-type:size) 높이에서 위 여백 · 진행 막대 자리(44px)를 뺀 값과, 전시 폭에서 양옆 엿보기 자리
 *  (각 56px: 간격 18 + 옆 카드 38)를 뺀 폭의 세로 환산값 중 작은 쪽. 세로로 긴 프레임(393×852)에서 높이만 따르면 카드
 *  폭이 프레임만큼 넓어져 옆 카드 · 재단 표시가 밀려나던 걸 막는다(S9 constraint-3 · 4, 헤드리스 캡처 2026-11-24). */
export const CARD_H = 'min(calc(100cqh - 44px), calc((100cqw - 112px) * 1534 / 960))';
/** 카드 윗변 — 워드마크 줄 바로 아래(소유자 결정 D24 '워드마크 영역 바로 아래에 티켓을 크게'). 세로로 긴 프레임에서 남는
 *  높이는 카드 아래(버튼 쪽)로 간다. 시트 상태와 무관하게 같다. */
const CARD_TOP = '12px';


/**
 * 가운데에서 d칸 떨어진 카드의 자리(S9 constraint-3 · 4, 마스터 D25-12). 모든 카드가 같은 높이(전시 높이 − 위 여백 −
 * 진행 막대 자리)와 비율을 갖고, 옆 카드는 0.82배 · 불투명도 0.5로 엿보인다. **filter · brightness는 건드리지 않는다** —
 * 다크에서 검은 띠가 됐던 D23 피드백. 두 칸 떨어진 카드는 불투명도 0이지만 tab 순서에 남는다(S5 constraint-5).
 * 시트가 열린 동안 옆 카드는 숨는다(constraint-10).
 */
function slotStyle(d: number, sheetOpen: boolean): CSSProperties {
  const base: CSSProperties = { left: '50%', top: CARD_TOP, height: CARD_H };
  if (d === 0) {
    return { ...base, transform: 'translateX(-50%)', opacity: 1, zIndex: 3, boxShadow: 'var(--pr-ticket-shadow)' };
  }
  const far = Math.abs(d) > 1;
  const hidden = far || sheetOpen;
  const k = (d < 0 ? -1 : 1) * (far ? 2 : 1);
  return {
    ...base,
    transform: `translateX(calc(-50% + ${k} * ${SIDE_STEP})) scale(${SIDE_SCALE})`,
    opacity: hidden ? 0 : 0.5,
    zIndex: far ? 0 : 1,
    boxShadow: 'none',
    pointerEvents: hidden ? 'none' : undefined,
  };
}

/**
 * 랜딩이 OCR 카드에 빌려주는 자리(#826 S5 constraint-11 → S9 constraint-11) — 카드는 셸이 쥔 한 벌이 children으로 들어오는
 * 구조라(#614/#624) 랜딩이 context로 "안내 자리"와 "인식 중" 통로를 직접 내준다. S9부터 그 글자는 전시 아래가 아니라
 * 첨부 시트의 '티켓 스크린샷' 행 상태 줄에 뜬다. 랜딩이 걷힌 뒤(편집 화면에서 연 인식)는 셸의 notify가 먼저라 이 자리를 안 쓴다.
 */
export const LandingSlotContext = createContext<{
  setNotice: (message: string | null) => void;
  setBusy: (busy: boolean) => void;
} | null>(null);

/** 가운데(고른) 카드의 재단 표시(S9 constraint-5) — 카드 바깥 8px에 --pr-accent L자 네 개. 장식이라 aria-hidden. */
function CropMarks() {
  const arm = {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: 'var(--pr-accent)',
    borderStyle: 'solid',
    borderWidth: 0,
  } as const;
  return (
    <span data-testid="mood-crop-marks" aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span style={{ ...arm, top: -8, left: -8, borderTopWidth: 2, borderLeftWidth: 2 }} />
      <span style={{ ...arm, top: -8, right: -8, borderTopWidth: 2, borderRightWidth: 2 }} />
      <span style={{ ...arm, bottom: -8, left: -8, borderBottomWidth: 2, borderLeftWidth: 2 }} />
      <span style={{ ...arm, bottom: -8, right: -8, borderBottomWidth: 2, borderRightWidth: 2 }} />
    </span>
  );
}

/**
 * 무드 전시(S5 L-01 → S9 D25-12) — 큰 가운데 카드 한 장 + 좌우 한 장씩 엿보임. **카드 탭은 진입이 아니라 고르기다**
 * (S9 constraint-5): 옆 카드를 탭하면 가운데로 오고, 가운데 카드 탭은 아무 일도 없다. 시작은 아래 버튼 둘뿐이다.
 *
 * 정지 수단(S5 constraint-4 그대로 + 시트): 전시를 누르고 있는 동안, 키보드 포커스가 전시 안에 있는 동안, 첨부 · 이용 고지
 * 시트가 열린 동안(`paused`), OS 동작 줄이기(3열 격자). 포커스 정지는 "키보드로 들어온 포커스"만 친다 — 판정은 직전 입력
 * 모달리티(keydown vs pointerdown)다(마우스 클릭 뒤 남은 포커스로 영영 멈추지 않게).
 *
 * 손짓: **탭** = 고르기, **길게 누름**(`LONG_PRESS_MS` 초과) = 멈춰 있기만(떼도 고르지 않음), **스와이프**(`SWIPE_STEP_PX`
 * 초과) = 끄는 방향으로 넘김(임계값마다 원점 재설정). 판정이 `gesture` **ref**에 사는 이유는 `click`이 `pointerup` 뒤에
 * 오기 때문이다 — state면 리렌더 전에 click이 지나가 스와이프 끝자락에서 엉뚱한 카드가 골라진다. `touch-action: pan-y`도 같은 묶음.
 *
 * 카드는 한 벌, 5개 전부 tab 순서에 있는 버튼(접근명 = 무드 이름, aria-pressed = 고른 카드). 전시는 overflow hidden이라
 * 바깥 카드에 포커스가 가면 브라우저가 컨테이너를 스크롤해 배치가 밀리니 onScroll이 0으로 되돌린다.
 * `prefers-reduced-motion`이면 자동 전환 · 진행 막대 없이 3열 격자(고른 카드에 재단 표시, S9 constraint-6).
 */
function MoodCarousel({
  active,
  onSelect,
  paused,
  sheetOpen,
  livePreview,
}: {
  active: number;
  onSelect: (index: number) => void;
  /** 시트가 열린 동안 true — 자동 전환을 멈춘다. */
  paused: boolean;
  sheetOpen: boolean;
  livePreview: ReactNode | null;
}) {
  const prefersReducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  const [pressed, setPressed] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const gesture = useRef({ x: 0, swiped: false, longPressed: false });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pointerDownRef = useRef(false);
  const keyboardModality = useRef(true);
  // 자동 전환 · 스와이프가 항상 최신 고른 값에서 이어 가도록 ref로 든다.
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const onInput = (e: Event) => {
      keyboardModality.current = e.type === 'keydown';
    };
    window.addEventListener('keydown', onInput, true);
    window.addEventListener('pointerdown', onInput, true);
    return () => {
      window.removeEventListener('keydown', onInput, true);
      window.removeEventListener('pointerdown', onInput, true);
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || pressed || focusPaused || paused) return;
    const id = setInterval(
      () => onSelect((activeRef.current + 1) % GALLERY_LAYOUTS.length),
      CAROUSEL_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [prefersReducedMotion, pressed, focusPaused, paused, onSelect]);

  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const step = (delta: number) => {
    const next = (activeRef.current + delta + GALLERY_LAYOUTS.length) % GALLERY_LAYOUTS.length;
    activeRef.current = next; // 같은 move 안에서 이어지는 스텝이 이전 값을 읽지 않게
    onSelect(next);
  };

  const release = (e: PointerEvent) => {
    // 캡처를 여기서 안 풀면 click의 타깃이 이 컨테이너로 재지정돼(Pointer Events 스펙) 카드 onClick이 영영 안 불린다.
    e.currentTarget.releasePointerCapture(e.pointerId);
    clearTimeout(pressTimer.current);
    pointerDownRef.current = false;
    setPressed(false);
  };

  const gestureProps = {
    onPointerDown: (e: PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      gesture.current = { x: e.clientX, swiped: false, longPressed: false };
      pointerDownRef.current = true;
      setPressed(true);
      clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => {
        gesture.current.longPressed = true;
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      if (!pointerDownRef.current) return;
      const dx = e.clientX - gesture.current.x;
      if (Math.abs(dx) < SWIPE_STEP_PX) return;
      clearTimeout(pressTimer.current);
      gesture.current.swiped = true;
      gesture.current.x = e.clientX;
      step(dx < 0 ? 1 : -1);
    },
    onPointerUp: release,
    onPointerCancel: (e: PointerEvent) => {
      gesture.current.swiped = true;
      release(e);
    },
  };

  const focusProps = {
    onFocus: (e: FocusEvent<HTMLElement>) => {
      const index = Number((e.target as HTMLElement).dataset.index);
      if (!Number.isNaN(index) && !pointerDownRef.current) onSelect(index);
      if (keyboardModality.current) setFocusPaused(true);
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (!next || !e.currentTarget.contains(next)) setFocusPaused(false);
    },
  };

  /** 중앙에서 몇 칸 떨어졌는지 — 다섯 장이라 -2..+2로 접힌다(원형 거리). */
  const distance = (index: number) => {
    const n = GALLERY_LAYOUTS.length;
    let d = index - active;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  const card = (layout: GalleryLayout, index: number, carousel: boolean) => {
    const rotated = GALLERY_ROTATED.has(layout.id);
    const d = distance(index);
    const selected = index === active;
    // 격자(동작 줄이기)에서도 고른 칸이 실시간 티켓을 받는다(S9 constraint-10 — 예외 없음, requirement-gap 1라운드).
    const live = selected && livePreview != null;
    return (
      <button
        key={layout.id}
        type="button"
        data-index={index}
        data-slot={carousel ? d : undefined}
        aria-pressed={selected}
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          // 넘기려던 손짓이나 길게 누름은 고르기가 아니다. 가드는 pointerdown을 거친 클릭에만 건다(키보드 활성화는
          // detail 0 — stale swiped가 Enter를 조용히 막지 않게, PR #653 7차 P1).
          if (e.detail !== 0 && (gesture.current.swiped || gesture.current.longPressed)) return;
          onSelect(index);
        }}
        aria-label={layout.label}
        className={cn(
          'block border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          carousel ? 'absolute rounded-[3px]' : 'relative w-full rounded-[3px] outline outline-1 outline-hair-strong',
        )}
        style={
          carousel
            ? {
                ...slotStyle(d, sheetOpen),
                aspectRatio: CARD_ASPECT,
                transitionProperty: 'transform, opacity',
                transitionDuration: `${CAROUSEL_TRANSITION_MS}ms`,
                transitionTimingFunction: 'cubic-bezier(.22,.61,.36,1)',
              }
            : { aspectRatio: CARD_ASPECT }
        }
      >
        {selected && <CropMarks />}
        <div className="relative h-full w-full overflow-hidden rounded-[3px]">
          {live ? (
            // 실시간 티켓(S9 constraint-10) — 셸이 TicketRenderer 한 벌을 넘긴다. 카드 박스가 크기를 준다.
            <div data-testid="landing-live-preview" className="h-full w-full">{livePreview}</div>
          ) : (
            // 돌린 무드는 회전 전 박스를 원본 방향(가로) 비율로 잡아 가운데에 놓고 90° 돌린다.
            <div
              style={
                rotated
                  ? {
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: `${(1534 / 960) * 100}%`,
                      height: `${(960 / 1534) * 100}%`,
                      transform: 'translate(-50%, -50%) rotate(90deg)',
                    }
                  : { width: '100%', height: '100%' }
              }
            >
              <img src={HERO_IMAGES[layout.id]} alt="" draggable={false} className="block h-full w-full object-cover" />
            </div>
          )}
        </div>
      </button>
    );
  };

  if (prefersReducedMotion) {
    return (
      <section
        data-testid="mood-gallery"
        aria-label="무드 전시(동작 줄이기)"
        className="grid min-h-0 flex-1 grid-cols-3 content-start gap-3 overflow-y-auto px-4 py-3"
      >
        {GALLERY_LAYOUTS.map((layout, i) => card(layout, i, false))}
      </section>
    );
  }

  return (
    <section
      data-testid="mood-gallery"
      aria-roledescription="carousel"
      aria-label="무드 전시"
      className="relative min-h-0 flex-1 overflow-hidden"
      // container-type:size — 카드 크기(CARD_H)가 전시의 cqh · cqw를 읽는다.
      style={{ touchAction: 'pan-y', containerType: 'size' }}
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0;
        e.currentTarget.scrollTop = 0;
      }}
      {...gestureProps}
      {...focusProps}
    >
      {GALLERY_LAYOUTS.map((layout, i) => card(layout, i, true))}
      {/* 다섯 칸 진행 막대(S9 constraint-3) — 지금 칸만 길고 --pr-ink. 장식이라 aria-hidden. */}
      <div
        data-testid="mood-gallery-progress"
        aria-hidden="true"
        className="absolute inset-x-0 z-10 flex items-center justify-center gap-1"
        // 카드 바로 아래 12px — 카드가 세로 가운데로 내려와도 막대가 따라 붙는다.
        style={{ top: `calc(${CARD_TOP} + ${CARD_H} + 14px)` }}
      >
        {GALLERY_LAYOUTS.map((l, i) => (
          <span key={l.id} className={cn('h-[3px]', i === active ? 'w-[18px] bg-ink' : 'w-[6px] bg-hair-strong')} />
        ))}
      </div>
    </section>
  );
}

/** 복원 행 날짜(D18-1 A) — 로컬 시간대 'M월 D일', 올해가 아니면 'YYYY년 M월 D일'. 마침표가 없어야
 *  라벨 규칙(COPY_TONE_GUIDE 축 2) 단언을 그대로 통과한다. */
export function formatSavedDate(savedAt: number, now: number = Date.now()): string {
  const d = new Date(savedAt);
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return d.getFullYear() === new Date(now).getFullYear() ? md : `${d.getFullYear()}년 ${md}`;
}

function ScanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.75h.75v.75h-.75v-.75zM16.75 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75H13.5V13.5zM13.5 19.5h.75v.75H13.5V19.5zM19.5 13.5h.75v.75h-.75V13.5zM19.5 19.5h.75v.75h-.75V19.5zM16.5 16.5h.75v.75h-.75V16.5z" />
    </svg>
  );
}

/**
 * 랜딩(#614 → #635 → #615 → #727 → #826 S5 → S9 D25-12) — 서비스의 진입 화면. 두 모드를 한 컴포넌트가 든다.
 *
 *  - `overlay`: 편집 셸 위를 덮는 `fixed` 레이어. **draft 유무와 무관하게 뜬다**(#727 c1).
 *  - `hidden`:  사용자가 랜딩을 떠났거나 max(#328). display:none이지 unmount가 아니다 — children(OcrUploadCard)
 *               단일 인스턴스 계약(#614/#624). 걷힐 때는 240ms 사라지고(동작 줄이기면 즉시), 그동안 탭을 받지 않는다.
 *
 * 배치(S9 constraint-3): 워드마크 줄(오른쪽 끝 '이용 고지') · 무드 전시(남은 세로) · 이어서 만들기 · 주 버튼 · '직접 입력'.
 * 아래는 판 없이 같은 --pr-stage 면이다. **고른 무드 상태를 랜딩이 쥐고**(기본 첫 카드) 두 버튼에 그 무드를 넘긴다 —
 * 카드 탭은 고르기뿐이다(constraint-5). 주 버튼은 파일 선택이 아니라 첨부 시트를 연다(constraint-8, 열림은 셸이 쥔다 — `sheet`).
 *
 * `fixed`의 컨테이닝 블록은 뷰포트가 아니라 `PhoneFrame`이다(contain:paint, #607). 시트가 열린 동안 아래 버튼 묶음은
 * display:none이고 시트가 같은 자리(맨 아래)에 서며, 닫히면 포커스를 주 버튼으로 돌려준다(APG Dialog).
 */
export function Landing({
  mode,
  onRestore,
  restoreTitle,
  onDirect,
  onOpenSheet,
  sheet,
  onPickScreenshot,
  onPickPoster,
  onMake,
  onCloseSheet,
  livePreview,
  children,
}: {
  mode: 'overlay' | 'hidden';
  /** 복원 진입점 "이어서 만들기"(#727 c5) — 저장된 draft를 그대로 들고 편집으로. */
  onRestore: () => void;
  /** 복원 행의 제목(#727 c6) — 비면 '제목 없는 티켓'(마스터 L-02). */
  restoreTitle: string;
  /** '직접 입력'(S9 constraint-7) — 고른 무드로 새 문서 + 편집 화면(정보 모드). */
  onDirect: (layout: LayoutId) => void;
  /** 주 버튼 '티켓 스크린샷으로 자동입력'(S9 constraint-8) — 파일 선택이 아니라 첨부 시트를 연다. 고른 무드를 넘긴다. */
  onOpenSheet: (layout: LayoutId) => void;
  /** 첨부 시트 상태 — null이면 닫힘. 셸이 쥔다. */
  sheet: null | {
    screenshot: AttachScreenshotState;
    posterThumb: string | null;
    canMake: boolean;
  };
  onPickScreenshot: () => void;
  onPickPoster: () => void;
  onMake: () => void;
  onCloseSheet: () => void;
  /** 시트가 열린 동안 가운데 카드 자리에 서는 실시간 티켓(셸의 TicketRenderer 한 벌). null이면 정적 견본. */
  livePreview: ReactNode | null;
  /** OCR 슬롯 — 셸이 소유한 단일 OcrUploadCard 인스턴스(숨은 입력 + role=status 리전). */
  children: ReactNode;
}) {
  const overlay = mode === 'overlay';
  const prefersReducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slot = useMemo(() => ({ setNotice, setBusy }), []);
  const [active, setActive] = useState(0);
  const selectedLayout = GALLERY_LAYOUTS[active].id;
  const [noticeOpen, setNoticeOpen] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const noticeBtnRef = useRef<HTMLButtonElement>(null);
  const sheetOpen = sheet !== null;
  const modalOpen = sheetOpen || noticeOpen;
  // 시트 · 고지 시트가 닫히면 연 버튼으로 포커스를 돌려준다(APG Dialog) — 버튼은 시트가 걷힌 같은 커밋에서 다시 보인다.
  const wasSheet = useRef(false);
  useEffect(() => {
    if (wasSheet.current && !sheetOpen) ctaRef.current?.focus();
    wasSheet.current = sheetOpen;
  }, [sheetOpen]);
  const wasNotice = useRef(false);
  useEffect(() => {
    if (wasNotice.current && !noticeOpen) noticeBtnRef.current?.focus();
    wasNotice.current = noticeOpen;
  }, [noticeOpen]);

  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (overlay) setSavedAt(readDraftSavedAt());
  }, [overlay]);
  // 걷히는 240ms 동안만 머리 · 전시를 남긴다 — 바로 언마운트하면 사라지는 동안 아래만 위로 튀어 보인다.
  const [leaving, setLeaving] = useState(false);
  const wasOverlay = useRef(overlay);
  useEffect(() => {
    const left = wasOverlay.current && !overlay;
    wasOverlay.current = overlay;
    if (!left || prefersReducedMotion) {
      setLeaving(false);
      return;
    }
    setLeaving(true);
    const id = setTimeout(() => setLeaving(false), OVERLAY_EXIT_MS);
    return () => clearTimeout(id);
  }, [overlay, prefersReducedMotion]);
  const showMarketing = overlay || leaving;
  // 포스터 드롭을 걷은 자리(D18-2) — 아무도 막지 않으면 파일을 떨어뜨린 브라우저가 그 파일로 이동해 메모리의 편집을 날린다.
  useEffect(() => {
    const blockFileDrop = (e: DragEvent) => {
      const dt = e.dataTransfer;
      if (dt && (Array.from(dt.types ?? []).includes('Files') || (dt.files?.length ?? 0) > 0)) e.preventDefault();
    };
    window.addEventListener('dragover', blockFileDrop);
    window.addEventListener('drop', blockFileDrop);
    return () => {
      window.removeEventListener('dragover', blockFileDrop);
      window.removeEventListener('drop', blockFileDrop);
    };
  }, []);

  // 인식 안내(S9 constraint-11) — 카드가 보낸 안내는 '티켓 스크린샷' 행 상태 줄에 오류로, 카드의 인식 중 신호는 busy로 싣는다.
  const screenshot: AttachScreenshotState | null = sheet
    ? notice
      ? { kind: 'error', message: notice }
      : busy && sheet.screenshot.kind !== 'busy'
        ? { kind: 'busy' }
        : sheet.screenshot
    : null;

  return (
    <div
      data-testid="landing"
      // 'hidden'과 'flex'를 동시에 얹으면 Tailwind 유틸 순서에 판정이 걸리므로 배타로 쓴다.
      className={overlay ? 'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-stage' : 'hidden'}
      style={{
        paddingTop: overlay ? 'env(safe-area-inset-top, 0px)' : undefined,
        // 걷힐 때 전환(S5 constraint-7) — display를 allow-discrete로 같이 전환해 화면만 240ms 동안 사라진다. 그동안 탭은
        // 루트에서 막고 카드 슬롯만 아래에서 되살린다.
        ...(overlay
          ? { opacity: 1 }
          : { position: 'fixed', inset: 0, zIndex: 50, opacity: 0, pointerEvents: 'none' }),
        transition: prefersReducedMotion ? 'none' : `opacity ${OVERLAY_EXIT}, display ${OVERLAY_EXIT}`,
        transitionBehavior: prefersReducedMotion ? undefined : 'allow-discrete',
      }}
    >
      {showMarketing && (
        // 워드마크 줄 하나(S9 constraint-3) — 헤드라인 · 서브카피 없음. 셸 헤더가 오버레이에 가려지므로 브랜드를 여기서 세운다.
        // 시트(첨부 · 이용 고지)가 열린 동안 뒤 요소는 inert — aria-modal만으로는 화면 읽기 · Tab이 뒤로 새고, 격자에서 고른
        // 무드가 시트의 스냅샷 무드와 어긋날 수 있다(code-review PR #848).
        <div inert={modalOpen} className="flex h-touch shrink-0 items-center justify-between px-4">
          <Wordmark />
          <button
            ref={noticeBtnRef}
            data-testid="landing-notice-open"
            type="button"
            onClick={() => setNoticeOpen(true)}
            className={cn(pressableVariants(), 'inline-flex min-h-touch items-center text-[12px] leading-4 text-ink-3')}
          >
            이용 고지
          </button>
        </div>
      )}

      {showMarketing && (
        <div inert={modalOpen} className="flex min-h-0 flex-1 flex-col">
          <MoodCarousel
            active={active}
            onSelect={setActive}
            paused={sheetOpen || noticeOpen}
            sheetOpen={sheetOpen}
            livePreview={sheetOpen ? livePreview : null}
          />
        </div>
      )}

      {/* 아래 버튼 묶음(S9 constraint-3) — 판 없이 같은 --pr-stage 면. 시트가 열린 동안은 숨고 시트가 그 자리에 선다. */}
      <div
        data-testid="landing-bottom"
        inert={noticeOpen}
        className={cn('relative z-[5] flex shrink-0 flex-col gap-2 px-4 pt-3', sheetOpen && 'hidden')}
        style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* 복원 진입점(#727 c5 → 마스터 L-02) — 한 버튼, 안에 두 줄(이어서 만들기 / 제목)과 날짜 · ›.
            **표시 판정이 React가 아니라 CSS다**(#727 c9, globals.css) — draft 복원이 effect로 미뤄져 있어 React로 그리면 행이
            뒤늦게 끼어들며 주 버튼이 밀려 오탭이 난다. 서버 HTML에 행을 담아두고 blocking 스크립트가 찍는 `has-draft`로
            드러내 자리 이동이 0이다. 그 규칙이 display:flex를 주므로 안쪽 배치도 flex다. */}
        <button
          type="button"
          data-testid="landing-restore"
          data-touch="56"
          onClick={onRestore}
          className={cn(
            pressableVariants({ transition: 'cta' }),
            'min-h-[56px] w-full items-center gap-2 rounded-ctl border border-hair-strong bg-transparent pl-3 pr-1 text-left text-ink',
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-caption leading-4 text-ink-2">이어서 만들기</span>
            <span className="truncate text-[15px] font-semibold leading-[22px]">
              {restoreTitle || '제목 없는 티켓'}
            </span>
          </span>
          {savedAt !== null && (
            <span data-testid="landing-restore-date" className="whitespace-nowrap text-caption text-ink-2 tabular-nums">
              {formatSavedDate(savedAt)}
            </span>
          )}
          <span className="inline-grid h-touch w-touch place-items-center text-ink-2">
            <Chevron />
          </span>
        </button>

        <button
          ref={ctaRef}
          type="button"
          data-testid="landing-cta"
          onClick={() => onOpenSheet(selectedLayout)}
          className={cn(
            pressableVariants({ transition: 'cta' }),
            'flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-ctl border border-transparent bg-accent text-body font-semibold text-accent-ink hover:bg-accent-hover',
          )}
        >
          <ScanIcon />
          티켓 스크린샷으로 자동입력
        </button>
        {/* 직접 입력(S9 constraint-7) — 고른 무드로 새 문서. 옛 '포스터 없이 직접 입력'과 같은 경로라 testid를 유지한다. */}
        <button
          type="button"
          data-testid="landing-skip-poster"
          onClick={() => onDirect(selectedLayout)}
          className={cn(
            pressableVariants({ transition: 'cta' }),
            'min-h-[48px] w-full rounded-ctl border border-hair-strong bg-transparent text-body font-medium text-ink',
          )}
        >
          직접 입력
        </button>
      </div>

      {/* OCR 슬롯 — 모드가 갈려도 트리 위치가 고정이라 카드가 remount되지 않는다(#614/#624). 카드 슬롯만은 루트의
          pointer-events:none을 되살린다 — 숨은 파일 input은 랜딩이 걷힌 뒤에도 정보 모드 버튼 · 메뉴 행이 여는 한 벌이다
          (#826 S2 constraint-17). contents라 배치에는 끼지 않는다. */}
      <div data-testid="landing-card-slot" className="contents" style={{ pointerEvents: 'auto' }}>
        <LandingSlotContext.Provider value={slot}>{children}</LandingSlotContext.Provider>
      </div>

      {overlay && sheet && screenshot && (
        <LandingAttachSheet
          screenshot={screenshot}
          posterThumb={sheet.posterThumb}
          canMake={sheet.canMake}
          onPickScreenshot={onPickScreenshot}
          onPickPoster={onPickPoster}
          onMake={onMake}
          onClose={onCloseSheet}
        />
      )}
      {overlay && noticeOpen && <LandingNoticeSheet onClose={() => setNoticeOpen(false)} />}
    </div>
  );
}
