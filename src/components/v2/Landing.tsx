import type { CSSProperties, FocusEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutId } from '@/types';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { readDraftSavedAt } from '@/hooks/usePhototicket';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { LAYOUTS } from '@/utils/layouts';
import { AppFooter, Chevron } from './AppFooter';
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

/**
 * 가운데에서 d칸 떨어진 카드의 자리(마스터 master.css `.c-gal .main/.peek`, #826 S5 constraint-3).
 * 전부 전시 폭 대비 %라 프레임 폭이 바뀌어도 비율이 그대로다. 좌우 카드는 바깥 가장자리가 전시 폭의
 * 22%만큼 밖으로 나가 잘려 엿보인다(왼쪽 left −22%, 오른쪽 left 100 − 34 + 22 = 88%).
 *
 * 두 칸 떨어진 카드는 불투명도 0으로 숨기지만 display·visibility는 그대로라 접근성 트리와 tab 순서에
 * 남는다(constraint-5) — 키보드 사용자가 포커스로 그 카드를 가운데로 부를 수 있어야 해서다. 대신
 * pointer-events none으로 보이는 카드의 탭을 가로채지 않는다.
 */
function slotStyle(d: number): CSSProperties {
  const top = 'calc(50% - 10px)';
  if (d === 0) {
    return {
      left: '50%',
      top,
      width: '52%',
      transform: 'translate(-50%, -50%)',
      opacity: 1,
      zIndex: 3,
      boxShadow: 'var(--pr-ticket-shadow)',
    };
  }
  const far = Math.abs(d) > 1;
  const left = d < 0 ? (far ? '-60%' : '-22%') : far ? '126%' : '88%';
  return {
    left,
    top,
    width: '34%',
    transform: 'translateY(-50%)',
    opacity: far ? 0 : 0.32,
    zIndex: far ? 0 : 1,
    boxShadow: 'none',
    pointerEvents: far ? 'none' : undefined,
  };
}

/**
 * 랜딩이 OCR 카드에 빌려주는 자리(#826 S5 constraint-11) — 카드는 셸이 쥔 한 벌이 children으로 들어오는
 * 구조라(#614/#624) 셸을 거치지 않고 랜딩이 context로 "안내 자리"와 "인식 중" 통로를 직접 내준다.
 * 카드는 이 자리가 있으면 자기 아래 토스트 대신 여기로 안내를 보내고, 랜딩은 그 글자를 전시 아래 위치 표시
 * 자리(주 CTA 바로 위)에 띄운다. 랜딩이 걷힌 뒤(편집 화면에서 연 인식)는 셸의 notify가 먼저라 이 자리를
 * 안 쓴다 — 그때 랜딩은 display:none이다.
 */
export const LandingSlotContext = createContext<{
  setNotice: (message: string | null) => void;
  setBusy: (busy: boolean) => void;
} | null>(null);

/** 랜딩 안내 — 위치 표시 자리에 3000ms 뜨는 오류 변형(--pr-warn, 결정 5). 같은 글자는 카드의 상시 마운트
 *  role=status 리전이 읽어 주므로 이 시각 요소는 aria-hidden이다(두 번 읽히지 않게). */
function LandingNotice({ message, className }: { message: string; className?: string }) {
  return (
    <div
      data-testid="landing-notice"
      aria-hidden="true"
      className={cn(
        'absolute inset-x-4 bottom-1.5 z-10 flex items-start gap-2 rounded-ctl border border-[color-mix(in_srgb,var(--pr-warn)_60%,transparent)] bg-s2 px-3 py-2.5 text-left text-body leading-5 text-ink shadow-[0_6px_16px_-10px_rgba(0,0,0,.5)] animate-fade-in',
        className,
      )}
    >
      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-[3px] bg-warn" />
      <span className="min-w-0 flex-1 break-keep">{message}</span>
    </div>
  );
}

/**
 * 무드 전시(마스터 L-01 '무대 기둥 전시', #826 S5) — 기둥 위 가운데 카드 한 장 + 좌우 한 장씩.
 *
 * **정지 버튼이 없다**(바뀐 요구 1, 소유자 결정 2026-11-17 — #778의 정지·재개 버튼을 대체). 4초마다 한 칸
 * 넘어가고, 정지 수단은 셋이다: 전시를 **누르고 있는 동안**, **키보드 포커스가 전시 안에 있는 동안**,
 * 그리고 OS 동작 줄이기(아예 3열 격자로 바뀐다). 마우스를 올리는 것만으로는 멈추지 않는다 — 데스크톱
 * 전용 동작이라 D18-2(모바일에서 지원 안 되는 기능 제거)로 걷었다. 포커스 정지는 iOS 외부 키보드 ·
 * VoiceOver 경로라 남긴다.
 *
 * 포커스 정지는 "키보드로 들어온 포커스"만 친다 — 마우스 클릭 · 스와이프 뒤 버튼에 남은 포커스로 멈추면 한 번
 * 탭한 사용자에게는 전시가 영영 멈춘다. 판정은 `:focus-visible`과 같은 기준인 직전 입력 모달리티(keydown vs
 * pointerdown)다 — 선택자 자체는 프로그램 포커스에서 브라우저 · 테스트 환경마다 갈려 쓰지 않는다. 처음 값은
 * "키보드"다: 키 입력도 포인터도 없이 포커스가 옮겨 오는 화면 읽기(VoiceOver 탐색)는 멈춰야 하는 쪽이다.
 *
 * 손짓은 시간과 거리로 가른다:
 *  - **탭** — 그 무드로 바로 시작(`onEnterMood`). 보이는 카드(가운데 · 좌우)면 어느 것이든.
 *  - **길게 누름**(`LONG_PRESS_MS` 초과) — 누르는 동안 멈춰 있고, 떼도 진입하지 않는다.
 *  - **스와이프**(`SWIPE_STEP_PX` 초과) — 끄는 방향으로 넘어가고, 임계값마다 원점을 다시 잡아 여러 칸.
 *
 * 판정이 `gesture` **ref**에 사는 이유는 `click`이 `pointerup` 뒤에 오기 때문이다 — state면 리렌더를
 * 기다리는 사이 click이 먼저 지나가 스와이프 끝자락에서 엉뚱한 무드로 진입한다. 컨테이너의
 * `touch-action: pan-y`도 같은 묶음이다: 안 주면 브라우저가 가로 끌기를 스크롤로 가로채 `pointermove`가 안 온다.
 *
 * 카드는 한 벌뿐이고 5개 전부 tab 순서에 있는 버튼이다(constraint-5) — 포커스가 간 카드가 가운데로 온다.
 * 전시는 overflow hidden이라 바깥으로 나간 카드에 포커스가 가면 브라우저가 그 컨테이너를 몰래 스크롤해
 * 배치가 밀린다 — onScroll이 스크롤 위치를 0으로 되돌린다.
 *
 * **`prefers-reduced-motion`이면 레이아웃이 바뀐다** — 자동 전환 · 기둥 · 위치 표시 없이 3열 격자로 전부를
 * 보이고(L-01.2) 넘치면 전시 안에서만 세로 스크롤한다.
 */
function MoodCarousel({
  onEnterMood,
  notice,
}: {
  onEnterMood: (id: LayoutId) => void;
  notice: string | null;
}) {
  const prefersReducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  // 지금 가운데 선 무드.
  const [active, setActive] = useState(0);
  // 전시를 누르고 있는 동안 true — 떼거나 취소되면 다시 돈다.
  const [pressed, setPressed] = useState(false);
  // 키보드 포커스가 전시 안에 있는 동안 true.
  const [focusPaused, setFocusPaused] = useState(false);
  // 이번 제스처가 무엇이었는지. 다음 pointerdown에서 리셋한다(위 주석 — ref여야 click보다 먼저 정해진다).
  const gesture = useRef({ x: 0, swiped: false, longPressed: false });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // 누르는 중인지 — 포커스가 포인터 누름에서 왔으면 그 카드를 가운데로 당기지 않는다(스와이프 시작 자리가 튐).
  const pointerDownRef = useRef(false);
  // 직전 입력이 포인터가 아니었는지(포커스 정지 판정, 위 주석).
  const keyboardModality = useRef(true);

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
    if (prefersReducedMotion || pressed || focusPaused) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % GALLERY_LAYOUTS.length),
      CAROUSEL_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [prefersReducedMotion, pressed, focusPaused]);

  // 타이머가 남은 채로 언마운트되면 사라진 컴포넌트의 state를 건드린다.
  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const step = (delta: number) =>
    setActive((i) => (i + delta + GALLERY_LAYOUTS.length) % GALLERY_LAYOUTS.length);

  const release = (e: PointerEvent) => {
    // 캡처를 여기서 안 풀면 pointerup 뒤 브라우저가 만드는 click의 타깃이 캡처한 이 컨테이너로 재지정돼
    // (Pointer Events 스펙) 안쪽 카드 <button>의 onClick이 평범한 클릭에서도 영영 안 불린다.
    e.currentTarget.releasePointerCapture(e.pointerId);
    clearTimeout(pressTimer.current);
    pointerDownRef.current = false;
    setPressed(false);
  };

  const gestureProps = {
    onPointerDown: (e: PointerEvent) => {
      // 밖으로 끌고 나가 놓아도 pointerup/cancel을 받으려고 캡처한다 — 안 잡으면 누름 정지가 다음 누름까지 눌러앉는다.
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
      // 끄는 중엔 길게 누름으로 안 친다 — 손가락이 움직였으면 그건 넘기려는 것이다.
      clearTimeout(pressTimer.current);
      gesture.current.swiped = true;
      gesture.current.x = e.clientX;
      step(dx < 0 ? 1 : -1);
    },
    onPointerUp: release,
    onPointerCancel: (e: PointerEvent) => {
      gesture.current.swiped = true; // 취소된 제스처로는 진입시키지 않는다
      release(e);
    },
  };

  const focusProps = {
    onFocus: (e: FocusEvent<HTMLElement>) => {
      const index = Number((e.target as HTMLElement).dataset.index);
      if (!Number.isNaN(index) && !pointerDownRef.current) setActive(index);
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
    return (
      <button
        key={layout.id}
        type="button"
        data-index={index}
        data-slot={carousel ? d : undefined}
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          // 넘기려던 손짓이나 길게 누름은 진입이 아니다. 단 이 가드는 pointerdown을 거친 클릭에만 건다 —
          // 키보드 활성화(Enter/Space)는 detail이 0이라 구분되고, gesture는 다음 pointerdown에서만 리셋되므로
          // 안 걸러주면 스와이프 한 번 뒤 키보드 Enter가 stale swiped=true를 읽어 조용히 막힌다(PR #653 7차 P1).
          if (e.detail !== 0 && (gesture.current.swiped || gesture.current.longPressed)) return;
          onEnterMood(layout.id);
        }}
        aria-label={`${layout.label} 무드로 바로 시작`}
        className={cn(
          'block border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          carousel
            ? 'absolute rounded-[3px]'
            : 'w-full rounded-[3px] outline outline-1 outline-hair-strong',
        )}
        style={
          carousel
            ? {
                ...slotStyle(d),
                aspectRatio: CARD_ASPECT,
                transitionProperty: 'left, transform, opacity',
                transitionDuration: `${CAROUSEL_TRANSITION_MS}ms`,
                transitionTimingFunction: 'cubic-bezier(.22,.61,.36,1)',
              }
            : { aspectRatio: CARD_ASPECT }
        }
      >
        {/* 이미지 하나가 카드다 — 이름은 aria-label로만 싣는다(사용자 피드백, #615 코멘트). */}
        <div className="relative h-full w-full overflow-hidden rounded-[3px]">
          {/* 돌린 무드는 회전 전 박스를 원본 방향(가로) 비율로 잡아 가운데에 놓고 90° 돌린다 — 카드 폭 대비
              가로는 1534/960, 세로는 960/1534라 돌리면 바깥 세로 카드를 정확히 채운다. */}
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
            <img
              src={HERO_IMAGES[layout.id]}
              alt=""
              draggable={false}
              className="block h-full w-full object-cover"
            />
          </div>
        </div>
      </button>
    );
  };

  if (prefersReducedMotion) {
    // 안내는 격자 스크롤 영역 밖, 전시 아래 끝(아래 판 바로 위)에 고정한다 — 격자를 스크롤해도 따라가지 않는다
    // (constraint-11 가정: 위치 표시가 없는 격자에서도 같은 '주 CTA 바로 위' 원칙).
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <section
          data-testid="mood-gallery"
          aria-label="무드 전시(동작 줄이기)"
          className="grid min-h-0 flex-1 grid-cols-3 content-start gap-3 overflow-y-auto px-4 py-3"
        >
          {GALLERY_LAYOUTS.map((layout, i) => card(layout, i, false))}
        </section>
        {notice && <LandingNotice message={notice} />}
      </div>
    );
  }

  return (
    <section
      data-testid="mood-gallery"
      aria-roledescription="carousel"
      aria-label="무드 전시"
      className="relative min-h-0 flex-1 overflow-hidden"
      style={{ touchAction: 'pan-y' }}
      onScroll={(e) => {
        e.currentTarget.scrollLeft = 0;
        e.currentTarget.scrollTop = 0;
      }}
      {...gestureProps}
      {...focusProps}
    >
      <div
        data-testid="mood-gallery-beam"
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-[62%] -translate-x-1/2 border-x border-hair bg-s1"
      />
      {GALLERY_LAYOUTS.map((layout, i) => card(layout, i, true))}
      {/* 안내가 뜬 동안 위치 표시 자리를 안내가 쓴다(마스터 L-03). */}
      {notice ? (
        <LandingNotice message={notice} />
      ) : (
        <span
          data-testid="mood-gallery-index"
          aria-hidden="true"
          className="absolute bottom-1.5 left-1/2 z-10 -translate-x-1/2 text-caption leading-4 text-ink-2 tabular-nums"
        >
          {active + 1} / {GALLERY_LAYOUTS.length}
        </span>
      )}
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

/**
 * 랜딩(#614 → #635 → #615 → #727 → #826 S5 L-01~L-03) — 서비스의 진입 화면. 두 모드를 한 컴포넌트가 든다.
 *
 *  - `overlay`: 편집 셸 위를 덮는 `fixed` 레이어. **draft 유무와 무관하게 뜬다**(#727 c1).
 *  - `hidden`:  사용자가 랜딩을 떠났거나 max(#328). display:none이지 unmount가 아니다 — children(OcrUploadCard)
 *               단일 인스턴스 계약(#614/#624). 걷힐 때는 240ms 사라지고(동작 줄이기면 즉시), 그동안 탭을 받지 않는다.
 *
 * 배치(마스터 `.c-land`): 워드마크 · 헤드라인 · 서브카피가 위, 무드 전시가 남은 세로를 채우고(flex 1),
 * 이어서 만들기 · 주 CTA · 링크 쌍 · 이용 고지가 아래 판에 선다. 아래 판은 고정이라 고지를 펼치면 전시가 준다.
 *
 * 새 라우트가 아니라 오버레이인 이유는 CTA가 파일 다이얼로그를 여는 데 있다: 라우트를 갈면 사용자 제스처
 * 컨텍스트가 끊겨 `input.click()`이 무시되는 브라우저가 있다. **셸 안에서 렌더된다** — OCR 카드는 셸의
 * `useOcrUndo`·`ocrEpochRef`에 배선된 한 벌이라 children으로 받아 자리만 빌려준다(remount되면 진행 중 OCR의
 * 로컬 상태가 리셋된다. KOBIS 보강의 최신성은 셸 소유 epoch가 판정해 unmount에도 안전하다, #388/PR #413).
 *
 * `fixed`의 컨테이닝 블록은 뷰포트가 아니라 `PhoneFrame`이다(contain:paint, #607) — `measure-chrome.mjs`의
 * frameFit 축이 판정한다. 히어로는 고정 이미지 자산이다(#613, `HERO_IMAGES`).
 */
export function Landing({
  mode,
  onCta,
  onSkip,
  onRestore,
  restoreTitle,
  onEnterMood,
  children,
}: {
  mode: 'overlay' | 'hidden';
  /** 이탈 경로 "포스터 업로드" — 셸의 숨은 포스터 input을 그 자리에서 click()한다(같은 제스처, 라우트 전환 0). */
  onCta: () => void;
  /** 이탈 경로 "포스터 없이 직접 입력" — 포스터 없이 편집으로 진입(#631). */
  onSkip: () => void;
  /** 복원 진입점 "이어서 만들기"(#727 c5) — 저장된 draft를 그대로 들고 편집으로. 유일하게 문서를 새 문서로
   *  되돌리지 않는 경로다. */
  onRestore: () => void;
  /** 복원 행의 제목(#727 c6) — 비면 '제목 없는 티켓'(마스터 L-02). */
  restoreTitle: string;
  /** 갤러리 카드 탭 → 그 무드로 새 문서 + 편집 화면 진입 — "포스터 업로드"·"포스터 없이 직접 입력"·OCR 성공과 나란한
   *  네 번째 진입점이다(#631 경로, 같은 canvasReady 커밋). 무드가 커밋된 채 들어가 크롭 프리셋 방향도 맞는다(#529). */
  onEnterMood: (id: LayoutId) => void;
  /** OCR 진입점 슬롯 — 셸이 소유한 단일 OcrUploadCard 인스턴스가 들어온다(주 CTA, #635). */
  children: ReactNode;
}) {
  const overlay = mode === 'overlay';
  const prefersReducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slot = useMemo(() => ({ setNotice, setBusy }), []);
  // 저장 시각(D18-1 A)은 저장분에서 직접 읽는다 — 랜딩이 다시 뜰 때마다(매 저장이 갱신한 값). 텍스트 복원과
  // 같은 이유로 SSR에서는 읽지 않고 effect로 미룬다.
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    if (overlay) setSavedAt(readDraftSavedAt());
  }, [overlay]);
  // 걷히는 240ms 동안만 머리 · 전시를 남긴다 — 바로 언마운트하면 사라지는 동안 아래 판만 위로 튀어 보인다.
  // hidden에선 원래 그리지 않는다(숨은 채 매 렌더 reconcile되고 전시 타이머가 도는 걸 피한다).
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
  // 포스터 드롭을 걷은 자리(D18-2) — 아무도 막지 않으면 파일을 떨어뜨린 브라우저가 그 파일로 이동해 메모리의 편집을
  // 날린다. 랜딩은 hidden에서도 마운트돼 있어 편집 화면까지 덮는다. 파일 드래그만 막아 입력칸의 글자 끌어놓기는 그대로다.
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

  return (
    <div
      data-testid="landing"
      // 'hidden'과 'flex'를 동시에 얹으면 Tailwind 유틸 순서에 판정이 걸리므로 배타로 쓴다.
      className={overlay ? 'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-stage' : 'hidden'}
      style={{
        paddingTop: overlay ? 'env(safe-area-inset-top, 0px)' : undefined,
        // 걷힐 때 전환(constraint-7) — display를 allow-discrete로 같이 전환해 클래스는 즉시 hidden이 되고 화면만
        // 240ms 동안 사라진다. 그동안 자리를 지키도록 fixed를 인라인으로 붙들고, 탭은 받지 않는다.
        // 사라지는 동안 탭은 루트에서 한 번에 막고, 카드 슬롯만 아래에서 되살린다.
        ...(overlay
          ? { opacity: 1 }
          : { position: 'fixed', inset: 0, zIndex: 50, opacity: 0, pointerEvents: 'none' }),
        transition: prefersReducedMotion ? 'none' : `opacity ${OVERLAY_EXIT}, display ${OVERLAY_EXIT}`,
        transitionBehavior: prefersReducedMotion ? undefined : 'allow-discrete',
      }}
    >
      {/* 마케팅 층은 오버레이에서만 — hidden에선 그리지도 않는다(숨은 채 매 렌더 reconcile되는 걸 피한다). */}
      {showMarketing && (
        <div className="shrink-0 px-4 pb-3">
          {/* 셸 헤더가 오버레이에 가리므로 브랜드를 여기서도 세운다. 페이지 제목은 아래 h1이 맡는다. */}
          <div className="flex h-touch items-center">
            <Wordmark />
          </div>
          <div data-testid="landing-copy" className="mt-3 flex flex-col gap-1">
            <h1 className="text-[24px] font-semibold leading-[30px] tracking-[-0.02em] text-ink break-keep">
              티켓 한 장이, 내 굿즈가 돼요
            </h1>
            {/* text-ink-2(--pr-ink-2)는 세 표면 위 6:1을 넘는다(fgContrast.test.ts). */}
            <p className="text-[15px] leading-[22px] text-ink-2 break-keep">
              스크린샷으로 자동입력. 사진으로 찍은 실물 티켓도 돼요.
            </p>
          </div>
        </div>
      )}

      {showMarketing && (
        <div className="flex min-h-0 flex-1 flex-col">
          <MoodCarousel onEnterMood={onEnterMood} notice={notice} />
        </div>
      )}

      {/* 아래 판(마스터 `.c-lp`) — 위 모서리만 둥근 s1 판. 고정 높이라 전시가 남은 세로를 쓴다. */}
      <div
        data-testid="landing-panel"
        className="relative z-[5] flex shrink-0 flex-col gap-2 rounded-t-[var(--pr-r-sheet)] border-t border-hair-strong bg-s1 px-4 pt-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* 복원 진입점(#727 c5 → 마스터 L-02) — 주 CTA **위** 한 버튼, 안에 두 줄(이어서 만들기 / 제목)과 날짜 · ›.
            편집 진입 시점의 확인 모달을 안 만드는 이유는 조건절 + 의문 종결어미가 COPY_TONE_GUIDE 축 2 위반이라서다.

            **표시 판정이 React가 아니라 CSS다**(#727 c9, globals.css) — draft 복원이 effect로 미뤄져 있어(299ms 실측)
            React로 그리면 행이 뒤늦게 끼어들며 주 CTA가 밀려 오탭이 난다. 서버 HTML에 행을 담아두고 _document.tsx의
            blocking 스크립트가 찍는 `has-draft`로 드러내 자리 이동이 0이다. 그 규칙이 display:flex를 주므로 안쪽 배치도 flex다. */}
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

        {/* OCR 주 진입점(#635) — 모드가 갈려도 이 슬롯의 트리 위치는 고정이라 카드가 remount되지 않는다. */}
        {/* 카드 슬롯만은 루트의 pointer-events:none을 되살린다 — 그 카드의 숨은 파일 input은 랜딩이 걷힌 뒤에도
            정보 모드 버튼 · 메뉴 행이 여는 한 벌이다(#826 S2 constraint-17). contents라 배치에는 끼지 않는다. */}
        <div className="contents" style={{ pointerEvents: 'auto' }}>
          <LandingSlotContext.Provider value={slot}>{children}</LandingSlotContext.Provider>
        </div>

        {/* 이탈 경로 2종(#635 c6 · #665 · #677) — "포스터 업로드 · 포스터 없이 직접 입력"은 있고 없고를 그 자리에서
            갈라준다. #677 톤 정비로 "포스터 있으면 올리기" → "포스터 업로드"(조건절이 판정을 사용자에게 시키는 말투였다). 인식 중에는 두 버튼이 막힌다(마스터 L-03). min-h-touch(44px)로 WCAG 2.5.8을 채운다(#646). */}
        <div
          data-testid="landing-exit-paths"
          className="flex flex-wrap items-center justify-center gap-x-2 text-caption text-ink-2"
         
        >
          <button
            type="button"
            onClick={onCta}
            disabled={busy}
            className={cn(pressableVariants(), 'min-h-touch inline-flex items-center underline disabled:opacity-40')}
          >
            포스터 업로드
          </button>
          <span aria-hidden="true" className="text-ink-3">·</span>
          {/* 포스터 없이 시작(#631) — 단색 바탕 + 조판만으로도 티켓이 성립하는 경로의 진입점. */}
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            data-testid="landing-skip-poster"
            className={cn(pressableVariants(), 'min-h-touch inline-flex items-center underline disabled:opacity-40')}
          >
            포스터 없이 직접 입력
          </button>
        </div>

        {/* 미인증 티켓 고지는 법적 성격이라 랜딩에서 사라지면 안 된다(#614) — '이용 고지' 한 줄로 접는다(마스터 L-01,
            소유자 지적 2026-11-17). 편집 화면엔 없다(#363, appFooterNotice가 DOM 부재로 잰다). */}
        {overlay && <AppFooter />}
      </div>
    </div>
  );
}
