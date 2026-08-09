import type { DragEvent, MouseEvent, PointerEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutId, MovieInfo, TicketComponents } from '@/types';
import { ALL_FIELDS_ON } from '@/constants/fieldVisibility';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { LAYOUTS } from '@/utils/layouts';
import TicketRenderer from '../TicketRenderer';
import { MOOD_CHIP_BG } from '../LayoutPicker';
import { AppFooter } from './AppFooter';
import { Wordmark } from './Wordmark';

/** 트랙 카드 폭 — 라벨을 없앤 대신 샘플 자체를 키운다(사용자 피드백). 세로는 TicketRenderer가
 *  각 무드의 실제 비율로 스스로 계산하므로 여기선 폭만 선언한다. */
const TRACK_CARD_WIDTH = 140;
/** 정지 그리드 카드 폭 — 트랙과 다른 값이다. 400×675 안에서 6장을 스크롤 없이 한 화면에 다 넣어야
 *  하는 정지 폴백은 트랙만큼 키우면 넘친다(실측 회귀) — 3열 그리드가 들어가는 최대치로 별도로 잡는다. */
const GRID_CARD_WIDTH = 92;
/** 트랙 카드 높이 — 갤러리 카드는 무드와 무관하게 전부 세로 무드 비율로 선다(아래 GALLERY_ROTATED). */
const CARD_HEIGHT = (TRACK_CARD_WIDTH * 1534) / 960;
/** 자동 전환 간격 — 티켓 한 장을 알아볼 시간을 넉넉히 준다(사용자 확인 2026-08-08). */
const CAROUSEL_INTERVAL_MS = 3500;
/** 자리 이동에 걸리는 시간 — 시안(620ms)의 2배. 간격과 같은 이유로 느긋하게 간다. */
const CAROUSEL_TRANSITION_MS = 1240;
/** 길게 누르고 있는 동안의 간격 — 멈추는 게 아니라 느려진다(정지는 안 한다, 아래 컴포넌트 주석). */
const CAROUSEL_SLOW_INTERVAL_MS = 7000;
/** 이 시간을 넘겨 누르고 있으면 "길게 누름"이다. 그 뒤 손을 떼도 무드로 진입하지 않는다. */
const LONG_PRESS_MS = 350;
/** 이만큼 가로로 끌면 스와이프다 — 넘길 때마다 원점을 다시 잡아 한 제스처로 여러 칸이 넘어간다. */
const SWIPE_STEP_PX = 28;
/**
 * 중앙에서 n칸 떨어진 카드의 자리. `x`는 px이 아니라 **카드 폭의 배수**라 `TRACK_CARD_WIDTH`를
 * 바꿔도 배치 비율이 그대로 따라온다.
 *
 * 시안 3종(코브플로 / 평면 원근 / 겹친 묶음) 중 **평면 원근**을 고르고, 폭은 평면 원근과 겹친
 * 묶음의 중간에 둔다(사용자 조정 2026-08-08 — 처음엔 겹친 묶음 쪽에 더 붙였는데 너무 좁았다).
 * 시안 기준 배수로 평면 원근이 0.70/1.20, 겹친 묶음이 0.41/0.70이고 아래가 그 사이다.
 *
 * 기울이지 않는 게 핵심 — 이 캐러셀의 목적이 무드가 어떻게 생겼는지 보여주는 거라, rotateY로
 * 티켓 조판을 사다리꼴로 찌그러뜨리면 그 목적을 스스로 깎는다. 거리는 크기·불투명도·흐림
 * 셋으로만 만든다.
 */
const CAROUSEL_SLOTS = [
  { x: 0, scale: 1, opacity: 1, blur: 0, z: 3 },
  { x: 0.64, scale: 0.78, opacity: 0.5, blur: 1.1, z: 2 },
  { x: 1.1, scale: 0.6, opacity: 0.27, blur: 2.2, z: 1 },
] as const;

/**
 * 히어로 갤러리에 세우는 무드 — `LAYOUTS` 전체가 아니다(사용자 피드백 2026-08-08).
 *
 * 캔버스가 가로인 두 무드(`editorial` 1534×960, `35mm-landscape` 960 폭 기준 가로)가 세로 카드
 * 사이에 섞이면, 같은 카드 폭에서 높이만 62%로 주저앉아 줄의 리듬이 깨지고 정작 그 무드도 너무
 * 작아 안 읽힌다. 둘을 다르게 처리하는 이유는 대체 가능성이다: `35mm Wide`는 같은 필름 계열인
 * `35mm`(세로)가 이미 줄에 있어 빼도 표현이 안 사라지지만, `editorial`은 유일한 편집 디자인이라
 * 빼면 그 톤 자체가 갤러리에서 없어진다 — 그래서 빼는 대신 세로로 돌려 세운다.
 *
 * 돌리는 건 갤러리 전시용일 뿐 무드 자체(`LAYOUTS`의 `orientation`·크롭 프리셋 #529)는 그대로다.
 */
export const GALLERY_LAYOUTS = LAYOUTS.filter((l) => l.id !== '35mm-landscape');
/** 갤러리에서만 90° 돌려 세로로 세우는 무드 — 위 주석 참고. 시계 방향(90deg)이라 원본의 오른쪽
 *  끝이 아래로 간다: editorial의 붉은 stub 밴드가 오른쪽이라 돌리면 아래에 선다(사용자 요청).
 *  반시계로 돌리면 같은 밴드가 위로 올라가니 부호를 바꿀 때 실물 확인 없이 뒤집지 말 것. */
const GALLERY_ROTATED: ReadonlySet<LayoutId> = new Set<LayoutId>(['editorial']);

/**
 * 배경 타일 그리드(#615) — 자산이 아니라 라이브 렌더다. 무드를 "안 읽히는 색면"으로 추상화해
 * 둔 `MOOD_CHIP_BG`(무드 칩과 동일 토큰, #367)를 반복 타일링해 D5(원본 포스터 식별 불가)를
 * 자산 없이 만족한다.
 *
 * **정적 webp로 굽지 않는다** — 한때 같은 그리드를 `public/assets/landing/backdrop-tiles.webp`로
 * 구워 번들했지만 뺐다. 이유는 원리적 제약이 아니라 값어치다: 소비처가 0인 채로 번들에만 남아
 * 있었고(`Landing.tsx`는 계속 이 라이브 div를 그렸다), 수동 번들이라 `LAYOUTS`/`MOOD_CHIP_BG`가
 * 바뀌면 조용히 stale해지는데, 정작 대체 대상인 24 div는 전부 CSS 그라디언트라 아낄 비용이
 * 없었다.
 *
 * 되살릴 거면 알아야 할 것: `MOOD_CHIP_BG`는 하드코딩 색이라 테마와 무관하고, 이 레이어의 유일한
 * 테마 의존은 `opacity-20`이 그 아래 `bg-bg`와 합성되는 것뿐이다. 삭제된 굽기 스크립트는 그 합성을
 * 이미 마친 불투명 스크린샷을 떠서 한 테마에 굳었던 거라, `omitBackground`로 알파를 살려 구우면
 * 브라우저가 같은 20% 합성을 테마별로 해준다 — 즉 **한 장으로도 된다**. 24 div의 렌더 비용이
 * 실측으로 문제가 될 때 그 방식으로 다시 열 것.
 *
 * 프레임 안/밖(#612 열린 결정) — **안**으로 결정. 모바일(레일 미만 폭)에서는 PhoneFrame
 * 자체가 뷰포트와 같은 사각형이라(#607) 안/밖 차이가 없고, 밖으로 빼려면 PhoneFrame의
 * `contain:paint`를 escape하는 portal이 필요해(크롭 모달과 반대 방향) 리스크 대비 이득이
 * 낮다 — 이번 슬라이스는 실제 검증 대상인 모바일 뷰포트 기준으로 "안"을 택한다. 데스크톱
 * 풀블리드가 필요해지면 그때 portal로 다시 연다.
 */
function LandingBackdropTiles() {
  const tiles = Array.from({ length: 15 }, (_, i) => LAYOUTS[i % LAYOUTS.length]);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.09]"
      // 히어로 갤러리가 서는 가운데를 비워주는 스포트라이트 마스크 — 배경이 화면 전체에 같은
      // 세기로 깔리면 앞의 샘플과 명도가 붙어 시선이 안 모인다(사용자 피드백). 가장자리에서만
      // 텍스처가 살고 중앙 타원 안은 거의 지워진다. mask-image는 네이티브라 JS·라이브러리 0.
      style={{
        maskImage:
          'radial-gradient(ellipse 68% 52% at 50% 46%, transparent 12%, rgba(0,0,0,0.45) 58%, #000 100%)',
        WebkitMaskImage:
          'radial-gradient(ellipse 68% 52% at 50% 46%, transparent 12%, rgba(0,0,0,0.45) 58%, #000 100%)',
      }}
    >
      {/* 3열 · gap-5 — 4열 gap-2는 400px 프레임에서 타일이 92px까지 잘게 쪼개져 "빼곡한 무늬"로
          읽혔다. 열을 줄여 타일을 키우고 간격을 벌리면 같은 면적이 훨씬 성기게 보인다. */}
      <div className="-m-10 grid grid-cols-3 gap-5 rotate-[-8deg] scale-125">
        {tiles.map((layout, i) => (
          <div
            key={i}
            className="aspect-[2/3] rounded-sm"
            style={{ background: MOOD_CHIP_BG[layout.id] }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 히어로 무드 갤러리 캐러셀(#615, 2026-08-08 개정) — 무드를 실제 렌더 엔진(TicketRenderer,
 * ghost + croppedImageUrl=null)으로 노출한다. 가운데가 제일 크고 좌우가 멀어 보이며, 오른쪽
 * 카드가 중앙으로 오면서 커진다. 샘플 클릭은 `onEnterMood`로 그 무드를 즉시 커밋하는 독립된
 * 네 번째 진입점이다(훑어보기용 중간 상태가 없다 — 폐기된 `LayoutStrip`+`heroLayout` 미러와
 * 다른 점). 무드 이름 라벨은 없다(사용자 피드백) — `aria-label`엔 실려 있어 정보 손실은 없다.
 *
 * **끝없이 흐르는 marquee를 대체했다.** 예전엔 리스트를 두 벌 이어붙이고 `-50%`까지 트랜슬레이트해
 * 이음매 없이 순환시켰는데, 그래서 같은 이름의 `<button>`이 두 벌 존재하고 뒤 절반을
 * `aria-hidden`+`tabIndex={-1}`로 접근성 트리에서 빼는 처리가 필요했다. 캐러셀은 카드 한 벌만
 * 두고 `transform`만 바꾸므로 그 복제와 예외 처리가 통째로 사라졌다 — 세트 경계에서 6px씩 튀던
 * 루프 스냅(트랙 폭 50%가 실제 세트 경계와 안 맞던 문제)도 같이 없어졌다.
 *
 * **대신 "지금 어느 무드가 중앙인가"라는 상태가 새로 생겼다.** 그게 이 개편이 지불한 값이다.
 *
 * **멈추지 않는다 — 이건 정보가 아니라 시각 효과다**(사용자 결정 2026-08-08). 그래서 정지
 * 버튼도, 인디케이터도, hover/focus 일시정지도 없다. 대신 손짓 셋이 흐름을 조절한다. 셋을
 * 가르는 건 시간과 거리 하나씩이다:
 *
 *  - **탭** — 그 무드로 바로 시작(`onEnterMood`). 아래 둘 중 어느 것도 아니었을 때만이다.
 *  - **길게 누름**(`LONG_PRESS_MS` 초과) — 누르고 있는 동안 간격이 `CAROUSEL_SLOW_INTERVAL_MS`로
 *    늘어난다. 멈추는 게 아니라 느려지는 것이고, 떼면 원래 속도로 돌아온다. 손을 떼도 진입하지
 *    않는다 — 천천히 보려던 손짓이 편집 화면으로 떨어지면 안 된다.
 *  - **스와이프**(`SWIPE_STEP_PX` 초과) — 끄는 방향으로 넘어간다. 임계값마다 원점을 다시 잡아
 *    한 번 쭉 끌면 여러 칸이 연달아 넘어가므로, 자동 전환을 기다리는 것보다 빠르게 훑을 수 있다.
 *
 * 판정이 `gesture` **ref**에 사는 이유는 `click`이 `pointerup` 뒤에 오기 때문이다 — state로
 * 두면 리렌더를 기다리는 사이에 click이 먼저 지나가 스와이프 끝자락에서 엉뚱한 무드로 진입한다.
 * 컨테이너의 `touch-action: pan-y`도 같은 묶음이다: 안 주면 브라우저가 가로 끌기를 스크롤로
 * 가로채 `pointermove`가 아예 안 온다.
 *
 * **탭 타깃과 눌림 피드백이 서로 다른 엘리먼트에 산다** — `<button>`은 `active:scale-[0.97]`을
 * 들고 있어(PrimaryCta·OcrUploadCard와 동일 패턴) `__tests__/tapTargets.ts`의 변형 금지 정규식
 * (`\S+:(?:h|w|size|scale|max-[hw])-`)에 그대로 걸린다 — 그래서 폭 선언은 그 클래스가 없는 안쪽
 * 카드 div가 인라인 style로 대신 지고(파서가 읽는 두 형태 중 인라인 px, TexturePicker 칩과 같은
 * 경우), 테스트는 그 안쪽 div만 잰다(LayoutStrip/TexturePicker가 스와치를 재고 바깥 버튼은 안
 * 재는 것과 같은 분리).
 *
 * **`prefers-reduced-motion`은 애니메이션만 죽이는 게 아니라 레이아웃을 바꾼다** — 정지 시엔
 * 캐러셀 대신 줄바꿈 그리드로 전부를 한 화면에 그린다. 캐러셀을 그대로 두고 자동 전환만 끄면
 * 좌우 카드가 작고 흐린 채 고정돼 "이게 전부인가"로 읽히고, 중앙 아닌 무드를 보려면 버튼을
 * 눌러야 해서 정지 사용자에게 오히려 단계가 는다. 그리드 카드는 캐러셀보다 작은 별도 크기다
 * (400×675 무스크롤 예산, 위 상수 참고).
 */
function MoodCarousel({
  heroMovieInfo,
  heroComponents,
  onEnterMood,
}: {
  heroMovieInfo: MovieInfo;
  heroComponents: TicketComponents;
  onEnterMood: (id: LayoutId) => void;
}) {
  const prefersReducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  // 지금 가운데 선 무드. 캐러셀이 되면서 "어느 무드가 중앙인가"라는 상태가 새로 생겼다 —
  // marquee엔 없던 것이라 이게 이 개편의 유일한 새 state다.
  const [active, setActive] = useState(0);
  // 길게 누르고 있는 동안만 true — 멈추는 게 아니라 간격만 늘어난다.
  const [slowed, setSlowed] = useState(false);
  // 이번 제스처가 무엇이었는지. state가 아니라 ref인 이유는 click 핸들러가 pointerup **뒤에**
  // 실행되기 때문이다 — 리렌더를 기다리면 늦어서 진입을 못 막는다. 다음 pointerdown에서 리셋한다.
  const gesture = useRef({ x: 0, swiped: false, longPressed: false });
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % GALLERY_LAYOUTS.length),
      slowed ? CAROUSEL_SLOW_INTERVAL_MS : CAROUSEL_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, [prefersReducedMotion, slowed]);

  // 타이머가 남은 채로 언마운트되면 사라진 컴포넌트의 state를 건드린다.
  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const step = (delta: number) =>
    setActive((i) => (i + delta + GALLERY_LAYOUTS.length) % GALLERY_LAYOUTS.length);

  const gestureProps = {
    onPointerDown: (e: PointerEvent) => {
      // 컨테이너 밖으로 끌고 나가 놓아도 이 엘리먼트가 계속 pointer를 받게 캡처한다 — 안 잡으면
      // 마우스로 길게 누른 채(slowed=true) 밖에서 떼는 순간 onPointerUp/onPointerCancel이 아예
      // 안 와 slowed가 다음 완전한 press-release 전까지 눌러앉는다(터치는 touch-action:pan-y가
      // 사실상 암묵 캡처라 안 겪는다).
      e.currentTarget.setPointerCapture(e.pointerId);
      gesture.current = { x: e.clientX, swiped: false, longPressed: false };
      clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => {
        gesture.current.longPressed = true;
        setSlowed(true);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const dx = e.clientX - gesture.current.x;
      if (Math.abs(dx) < SWIPE_STEP_PX) return;
      // 끄는 중엔 길게 누름으로 안 친다 — 손가락이 움직였으면 그건 넘기려는 것이다.
      clearTimeout(pressTimer.current);
      gesture.current.swiped = true;
      // 원점을 지금 자리로 다시 잡아, 한 번 쭉 끄는 동안 SWIPE_STEP_PX마다 한 칸씩 넘어간다.
      gesture.current.x = e.clientX;
      step(dx < 0 ? 1 : -1);
    },
    onPointerUp: (e: PointerEvent) => {
      // 캡처를 여기서 안 풀면, pointerup 뒤 브라우저가 만드는 click의 타깃이 캡처한 이 컨테이너로
      // 재지정된다(Pointer Events 스펙 — 캡처 상태에서 pointerup이 끝나면 합성 click은 캡처
      // 엘리먼트를 타깃으로 잡는다) — 그러면 안쪽 카드 <button>의 onClick이 평범한 클릭에서도
      // 영영 안 불린다. pointerup 처리 중에 동기로 풀어야 뒤이은 click은 원래대로 button을 탄다.
      e.currentTarget.releasePointerCapture(e.pointerId);
      clearTimeout(pressTimer.current);
      setSlowed(false);
    },
    onPointerCancel: (e: PointerEvent) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      clearTimeout(pressTimer.current);
      gesture.current.swiped = true; // 취소된 제스처로는 진입시키지 않는다
      setSlowed(false);
    },
  };

  // 무드별 components를 렌더마다 새로 만들면 `TicketRenderer`의 memo가 12벌 전부 miss한다
  // (fresh-context 리뷰 P1) — `Landing`은 memo가 아니고 셸에서 `onEnterMood`·`children` 등이
  // 매번 새 값으로 내려오므로, 랜딩이 떠 있는 동안 셸 state가 한 번 바뀔 때마다(OCR
  // `isProcessing`·토스트) 무드 트리 12벌이 통째로 재렌더됐다. `heroComponents`는 index.tsx의
  // 280ms debounce 값이라 편집 사이엔 참조가 안 바뀌므로, 여기서 한 번 고정하면 그 재렌더가
  // 실제 무드 변경에만 걸린다. 나머지 props(`heroMovieInfo`=실시간 state 객체, `ALL_FIELDS_ON`=
  // 모듈 상수, `croppedImageUrl`=null, `ghost`)는 이미 참조가 안정적이다.
  const sampleComponents = useMemo(
    () => GALLERY_LAYOUTS.map((layout) => ({ ...heroComponents, layout: layout.id })),
    [heroComponents],
  );

  /** 중앙에서 몇 칸 떨어졌는지 — 다섯 장이라 -2..+2로 접힌다(원형 거리). */
  const distance = (index: number) => {
    const n = GALLERY_LAYOUTS.length;
    let d = index - active;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  const sample = (layout: (typeof LAYOUTS)[number], index: number, key: string, width: number, carousel: boolean) => {
    const rotated = GALLERY_ROTATED.has(layout.id);
    // 돌린 무드는 카드 박스도 같이 뒤집힌다 — 가로 캔버스(1534×960)를 세로로 세우면 표시 높이가
    // 폭 × (width/height)라, 세로 무드들과 같은 1534/960 비율이 나와 줄의 리듬이 맞는다.
    const height = rotated ? (width * layout.width) / layout.height : (width * layout.height) / layout.width;
    // 캐러셀에서만 자리를 계산한다 — reduced-motion 그리드는 흐름 배치 그대로다.
    const d = distance(index);
    const s = CAROUSEL_SLOTS[Math.min(Math.abs(d), CAROUSEL_SLOTS.length - 1)];
    const slot = carousel
      ? {
          position: 'absolute' as const,
          top: 0,
          left: '50%',
          marginLeft: -width / 2,
          zIndex: s.z,
          opacity: s.opacity,
          filter: s.blur ? `blur(${s.blur}px)` : undefined,
          transform: `translateX(${Math.sign(d) * s.x * width}px) scale(${s.scale})`,
          transitionProperty: 'transform, opacity, filter',
          transitionDuration: `${CAROUSEL_TRANSITION_MS}ms`,
          transitionTimingFunction: 'cubic-bezier(.22,.61,.36,1)',
        }
      : undefined;
    return (
    <button
      key={key}
      type="button"
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        // 넘기려던 손짓이나 길게 누름은 진입이 아니다 — click은 pointerup 뒤에 오므로 여기서
        // 걸러야 스와이프 끝에 손을 뗀 자리의 무드로 갑자기 들어가는 일이 없다. 단 이 가드는
        // pointerdown을 거친 클릭에만 건다 — 키보드 활성화(Enter/Space)는 detail이 0이라 pointer
        // 클릭과 구분되는데, gesture는 오직 다음 pointerdown에서만 리셋되므로 안 걸러주면 스와이프
        // 한 번 뒤엔 pointerdown 없이 온 키보드 Enter가 stale swiped=true를 읽어 조용히 막힌다.
        // detail===0은 실제 브라우저 키보드 활성화 신호로 널리 쓰이는 관용구(Radix 등)지만 100%
        // 보장은 아니다(프로그래매틱 .click()도 0을 낸다) — 이 앱엔 그런 자동화 호출 경로가 없어
        // 실사용 리스크는 없다고 판단했다.
        if (e.detail !== 0 && (gesture.current.swiped || gesture.current.longPressed)) return;
        onEnterMood(layout.id);
      }}
      aria-label={`${layout.label} 무드로 바로 시작 · ${layout.caption}`}
      title={layout.caption}
      data-touch={String(width)}
      className="shrink-0 transition-transform active:scale-[0.97]"
      style={slot}
    >
      {/* 라벨 없음은 의도적 결정이다(사용자 피드백, 이슈 #615 코멘트에 기록) — 이미지 밑에 이름
          한 줄을 두면 세로 공간을 먹어 카드가 작아지므로, 이름은 aria-label로만 싣고 카드는
          이미지 하나로 키운다. 높이는 무드별 실제 캔버스 비율로 계산한다(가로 슬롯 2종은 세로
          슬롯 4종보다 낮다) — 실측용 상수를 아무 무드에나 똑같이 씌우면 가로 슬롯에서 여백이
          남거나 잘린다. */}
      <div style={{ width, height, position: 'relative', overflow: 'hidden' }}>
        {/* 돌린 무드는 회전 전 크기를 뒤집어(높이×폭) 절대배치로 가운데에 놓고 -90° 돌린다 —
            transform은 레이아웃 크기를 안 바꾸므로 TicketRenderer의 ResizeObserver는 회전 전
            박스를 그대로 재고, 돌아간 결과가 바깥 세로 박스를 정확히 채운다. */}
        <div
          style={
            rotated
              ? {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: height,
                  height: width,
                  transform: 'translate(-50%, -50%) rotate(90deg)',
                }
              : { width: '100%', height: '100%' }
          }
        >
          <TicketRenderer
            croppedImageUrl={null}
            movieInfo={heroMovieInfo}
            components={sampleComponents[index]}
            fieldVisibility={ALL_FIELDS_ON}
            ghost
          />
        </div>
      </div>
    </button>
    );
  };

  if (prefersReducedMotion) {
    return (
      <div data-testid="mood-gallery" className="flex flex-wrap items-start justify-center gap-3">
        {GALLERY_LAYOUTS.map((layout, i) => sample(layout, i, layout.id, GRID_CARD_WIDTH, false))}
      </div>
    );
  }

  return (
    <div
      data-testid="mood-gallery"
      className="relative w-full overflow-hidden"
      // touch-action: pan-y — 가로 제스처는 이 캐러셀이 받고 세로 페이지 스크롤은 브라우저에
      // 남긴다. 안 주면 브라우저가 가로 끌기도 스크롤로 먹어 pointermove가 안 온다.
      style={{ height: CARD_HEIGHT, touchAction: 'pan-y' }}
      {...gestureProps}
    >
      {GALLERY_LAYOUTS.map((layout, i) => sample(layout, i, layout.id, TRACK_CARD_WIDTH, true))}
    </div>
  );
}

/**
 * 랜딩(#614 → #635 OCR 승격 → #615 무드 히어로) — 포스터가 아직 없을 때의 진입 화면.
 * 세 모드를 한 컴포넌트가 든다.
 *
 *  - `overlay`: 편집 셸 위를 덮는 `fixed` 레이어. 마케팅 카피 + 히어로 + OCR(주 CTA) + 고지.
 *  - `inline`:  오버레이를 걷었는데 포스터는 아직 없는 상태(드래프 복원 D7 · OCR 진입)의 본문
 *               블록. 카피/히어로 없이 진입 컨트롤만. 이 모드가 없으면 그 두 경로가 헤더만 남은
 *               빈 화면으로 떨어진다 — 포스터가 없으면 프리뷰·dock·드로어·완료가 전부 게이팅되고,
 *               특히 IndexedDB 포스터 복원 실패 시 "재업로드를 유도"하는 #489 결정 5의 경로가
 *               갈 곳을 잃는다.
 *  - `hidden`:  포스터가 있거나 max(#328). display:none이지 unmount가 아니다(아래).
 *
 * 새 라우트가 아니라 오버레이인 이유는 CTA가 파일 다이얼로그를 여는 데 있다: 라우트를 갈면
 * 사용자 제스처 컨텍스트가 끊겨 `input.click()`이 무시되는 브라우저가 있고, 오버레이면 셸이 이미
 * 마운트돼 있어 걷는 순간 지연 0으로 드러난다.
 *
 * **셸 안에서 렌더된다** — 이슈 #614의 구조도는 `index.tsx`의 형제로 그렸지만, 그러면 랜딩의 OCR
 * 진입점이 셸의 `OcrUploadCard`와 다른 인스턴스가 된다. 그 카드는 셸의 `useOcrUndo`·`ocrEpochRef`에
 * 배선돼 있고 진입점이 늘어나는 만큼 같은 상태를 쓰는 인스턴스가 늘어나므로, 셸이 쥔 하나를
 * children으로 받아 자리만 빌려준다. 모드가 갈려도 이 컴포넌트가 트리에 그대로 있어야 그 카드가
 * remount되지 않는다 — remount의 대가는 진행 중인 OCR의 로컬 상태(`isProcessing`·토스트)가
 * 리셋되는 것이다. (예전엔 in-flight KOBIS 보강 자체가 유실됐지만 #388/PR #413 P0이 그 판정을
 * 인스턴스 로컬 `mountedRef`에서 셸 소유 `ocrEpochRef`로 옮겨 unmount에도 안전해졌다 — 커밋
 * 007f381. #363/PR #372의 원래 레이스는 그쪽이 막는다.)
 *
 * `fixed`의 컨테이닝 블록은 뷰포트가 아니라 `PhoneFrame`이다(contain:paint, #607) — 데스크톱
 * 1440 뷰포트에서도 오버레이가 400px 프레임 안에 선다. `measure-chrome.mjs`의 frameFit 축이
 * 이걸 판정한다.
 *
 * **히어로는 이미지 자산이 아니라 실제 렌더 엔진이다(#615)** — #613(예시 이미지 수동 제작·번들)이
 * 아직 안 끝나 저작권 없는 무드 이미지가 없다. 대신 #631이 이미 열어둔 posterless 렌더 경로를
 * 그대로 써서 `TicketRenderer`를 `croppedImageUrl=null` + `ghost`로 띄운다 — 포스터 없이도
 * 무드의 조판·타이포·필드 자리는 실물 그대로 보인다. 실제 히어로 마크업은 `MoodCarousel`
 * (아래) — 6종을 auto-scroll 트랙으로 동시에 보여준다(2026-08-04 설계 변경, D1 재검토: "동시에
 * 더 많이 보인다" 요건은 트랙이 그대로 만족해 크로스페이드 캐러셀로 되돌아가는 게 아니다).
 *
 * **샘플 클릭은 훑어보기가 아니라 즉시 커밋이다** — 예전 무드칩(`LayoutStrip`)은 셸의 `heroLayout`
 * 로컬 미러만 바꾸고 실제 `components.layout` 커밋은 다른 CTA가 맡았지만, auto-scroll 갤러리의
 * 샘플은 그 자체가 완결된 액션이다: 클릭하면 `onEnterMood(id)`가 그 무드를 바로 커밋하고 편집
 * 화면으로 들어간다 — "포스터 있으면 올리기"·"포스터 없이 직접 입력"·OCR 성공과 나란한 **네 번째**
 * 진입점이다(#631 경로, 같은 canvasReady 커밋). 크롭 프리셋
 * (`ImageCropModal`이 읽는 `posterOrientation`)이 랜딩에서 고른 무드와 어긋나지 않는 이유(#529)도
 * 동일 — 무드가 커밋된 채로 편집에 들어가므로 재크롭 없이 방향이 맞다. 배경 타일 그리드는
 * `LandingBackdropTiles`(위) 참고 — 자산 대기 중인 placeholder가 아니라 라이브 렌더가 완성형이다
 * (#613이 아직 막고 있는 건 전경 `hero-*.webp` 6장뿐이다).
 */
export function Landing({
  mode,
  onCta,
  onSkip,
  dropProps,
  dragOver,
  heroMovieInfo,
  heroComponents,
  onEnterMood,
  ocrApplied,
  children,
}: {
  mode: 'overlay' | 'inline' | 'hidden';
  /** 이탈 경로 "포스터 있으면 올리기" — 셸의 숨은 포스터 input을 그 자리에서 click()한다(같은 제스처, 라우트 전환 0). */
  onCta: () => void;
  /** 이탈 경로 "포스터 없이 직접 입력" — 포스터 없이 편집으로 진입(#631). 셸의 canvasReady를 세운다. */
  onSkip: () => void;
  /** 셸의 포스터 드롭 핸들러(#607) — 점선 드롭존이 여기로 흡수되며 같이 넘어왔다. */
  dropProps: {
    onDragOver: (e: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent) => void;
  };
  dragOver: boolean;
  /** 히어로 프리뷰용 movieInfo — 업로드 전이라 사실상 항상 빈 값, ghost 자리표시만 보인다. */
  heroMovieInfo: MovieInfo;
  /** 히어로 갤러리 샘플의 색·스탬프 등 layout 이외 필드 — 셸의 실제 components(레이아웃은 샘플마다 override). */
  heroComponents: TicketComponents;
  /** 갤러리 샘플 클릭 → 그 무드를 즉시 커밋 + 편집 화면 진입(네 번째 진입점, 위 컴포넌트 주석). */
  onEnterMood: (id: LayoutId) => void;
  /** OCR이 이미 필드를 채운 적 있는가(#652) — true면 children(주 CTA)과 이탈 경로 줄을 통째로
   * CSS로만 숨겨 드로어를 유일한 재진입점으로 만든다(#388 > #631 D2 a, 이 상태에 한해). '직접
   * 입력'(onSkip)만 거친 상태는 이 값이 안 서므로 포스터 재진입 동선이 그대로 남는다. */
  ocrApplied: boolean;
  /** OCR 진입점 슬롯 — 셸이 소유한 단일 OcrUploadCard 인스턴스가 들어온다(이제 주 CTA, #635). */
  children: ReactNode;
}) {
  const overlay = mode === 'overlay';
  return (
    <div
      data-testid="landing"
      {...dropProps}
      // 'hidden'과 'flex'를 동시에 얹으면 Tailwind 유틸 순서에 판정이 걸리므로 배타로 쓴다.
      className={
        mode === 'hidden'
          ? 'hidden'
          : `flex flex-col ${
              overlay ? 'fixed inset-0 z-50 overflow-y-auto bg-bg' : 'flex-1'
            } ${dragOver ? 'outline outline-2 -outline-offset-2 outline-accent' : ''}`
      }
      style={
        overlay
          ? {
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }
          : undefined
      }
    >
      {/* 배경 타일 그리드(#615, D3 — 처음부터 무늬) — outer가 fixed(positioned)라 -z-10 자식은
          이후 정적 흐름 형제(카피·히어로 등) 뒤로 자동 배치된다(음수 z-index는 non-positioned
          in-flow 콘텐츠보다 아래 stacking tier). */}
      {overlay && <LandingBackdropTiles />}

      {/* 마케팅 층은 오버레이에서만 — inline은 이미 편집 화면이라 브랜드·카피가 아니라 진입
          컨트롤만 필요하고, hidden에선 그리지도 않는다(숨은 채 매 렌더 reconcile되는 걸 피한다). */}
      {overlay && (
        // 셸 헤더가 오버레이에 가리므로 브랜드를 여기서도 세운다. 페이지 제목 역할은 아래
        // 헤드카피(h1)가 하므로 워드마크는 기본 span으로 둔다.
        <div className="flex shrink-0 items-center gap-2 px-4 pt-4">
          <Wordmark />
        </div>
      )}

      {/* 카피 → 히어로 → 이탈경로 사이 기본 리듬(D8, #615). gap-4는 #201 세로 리듬의 group(16px)과
          같은 값이라 편집 셸과 이미 이어져 있고, 이탈경로 앞 mt-2/뒤 mt-3은 그 안의 미세 조정이다. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center">
        {overlay && (
          <>
            {/* 카피는 1줄+1줄로 압축(Seed spec c5) — 선택 가능한 히어로가 "그래서 뭘 얻나"를
                문장보다 세게 답하므로 카피 의존도가 낮다. 세로 예산은 아래 히어로+무드칩이 새로
                차지한다(400×675, measure-chrome.mjs로 실측).

                relative + 뒤 scrim(-z-[5])은 배경 타일(-z-10)이 카피 밑에서 그대로 비치는 걸
                막는다 — 실측(픽셀 샘플링, measure-chrome.mjs의 대비 축은 랜딩 카피를 안 잰다)으로
                text-fg-muted 서브카피가 타일 위에서 라이트 테마 기준 최저 2.89:1까지 떨어지는 걸
                확인했다(WCAG AA 4.5 미달). globals.css 19-22행이 이미 세운 규칙과 같다 — muted 잉크는
                불투명 표면 위에만. bg-bg는 이 오버레이 자신의 배경색과 같아 시각적 이음매가 없다.
                text-landing-muted를 쓰는 이유는 아래 참고. */}
            {/* flex flex-col gap-4 — h1·p가 바깥 flex 컬럼의 직계 자식에서 이 div 자식으로
                한 단 내려오면서 원래 gap-4(16px)가 적용되던 h1↔p 사이 간격이 사라진다(부모 gap은
                직계 자식 사이에만 걸린다) — 같은 리듬을 이 안에서 다시 선언해 되돌린다. */}
            <div data-testid="landing-copy" className="relative flex flex-col gap-4">
              <div aria-hidden="true" className="absolute inset-0 -z-[5] bg-bg" />
              <h1 className="text-display font-bold text-fg break-keep">
                티켓 한 장이, 내 굿즈가 돼요
              </h1>
              {/* text-caption(#615 사용자 피드백) — 원래 text-body(14px)는 헤드카피 대비 존재감이
                  과했다. 카피 3종(헤드·서브·CTA) 크기를 낮춰 갤러리에 세로 예산을 넘긴다.

                  text-landing-muted(globals.css --landing-muted, tailwind.config.js 매핑)로
                  --bg 위 5.24:1을 확보한다. 이 오버라이드를 처음 넣을 땐 --fg-muted가 4.43:1로
                  WCAG AA(4.5) 미달이라 유일한 통과 경로였고, #650이 그 값을 4.62:1로 다크닝한
                  지금은 그 위에 얹은 여유분이다. */}
              <p className="max-w-[300px] text-caption leading-relaxed text-landing-muted break-keep">
                스크린샷으로 자동입력. 사진으로 찍은 실물 티켓도 돼요.
              </p>
            </div>

            {/* 히어로(#615, 2026-08-04 개정) — auto-scroll 갤러리 하나가 이전의 "전경 1장 + 무드칩
                스트립" 두 축을 대체한다(위 컴포넌트 주석). */}
            <MoodCarousel
              heroMovieInfo={heroMovieInfo}
              heroComponents={heroComponents}
              onEnterMood={onEnterMood}
            />
          </>
        )}

        {/* #652 — OCR이 실제로 필드를 채운 뒤(ocrApplied)엔 주 CTA도 이탈 경로 줄도 편집 본문에
            남지 않는다: #388(편집 중 OCR 진입점은 드로어 하나)이 #631 D2(a)(랜딩 inline이 포스터
            재진입 동선)를 이 상태에 한해 이긴다 — "6개 항목이 자동 입력되었어요" 배너 옆에 방금 쓴
            그 CTA와 이탈 경로가 그대로 남으면 "입력이 안 끝났나"로 읽히던 게 #652의 재현이다.
            unmount가 아니라 CSS hidden으로만 숨긴다 — children(OcrUploadCard)은 #614/#624가 지키는
            "항상 마운트" 계약이 있어 트리에서 빼면 안 된다. '직접 입력'(onSkip)만 거친 상태는
            ocrApplied가 안 서므로 이 블록이 그대로 보이고, #631 D2(a)의 포스터 재진입 동선은
            그쪽에서 유지된다(posterlessCanvas.test.tsx). */}
        <div className={`mt-2 w-full max-w-[280px]${ocrApplied ? ' hidden' : ''}`}>
          {/* OCR 주 진입점(#635) — 포스터 CTA가 보조로 내려가고 이게 주연이다(#142 위계 반전).
              모드가 갈려도 이 슬롯의 트리 위치는 고정이라 카드가 remount되지 않는다. */}
          {children}

          {/* 이탈 경로 2종(#635 c6) — "스크린샷 없음"은 이 두 링크로, "OCR 실패"·
              "rate limit 초과"는 OcrUploadCard의 토스트 뒤에도 이 줄이 그대로 남아 이어진다.
              새 세로 공간 0 — 예전 포스터 CTA 자리(caption + "포스터 없이 시작")를 한 줄로 합쳤다.
              세 번째 링크였던 TMDB 검색(#537)은 약관 위험으로 철거됐다(#665). 그게 맡던
              "포스터 파일을 직접 못 구한 사용자"를 남은 두 링크가 나눠 받으므로 문구도 그 쌍으로
              읽히게 잡았다 — "포스터 있으면 올리기 · 포스터 없이 직접 입력"은 있고 없고를 그
              자리에서 갈라주고, 없는 쪽도 막다른 길이 아니라는 걸 링크 이름만으로 말한다(#631 경로).

              relative + 첫 자식 scrim(-z-[5] bg-bg) — 위 카피와 같은 이유(#615 검증 코멘트).
              text-fg-muted가 배경 타일(-z-10, overlay 모드에서만 존재) 위에 직접 떠 있어 실측
              다크 4.05 / 라이트 2.83까지 떨어진다(WCAG AA 4.5 미달). scrim이 absolute라 flex-wrap
              레이아웃엔 안 끼어든다. inline 모드는 타일 자체가 없어 무해한 중복일 뿐이다.

              text-landing-muted(위 서브카피와 동일 근거)로 라이트 5.24:1 확보 —
              --fg-faint 구분자(·)는 aria-hidden 장식이라 텍스트 대비 대상이 아니라 그대로 둔다.

              WCAG 2.5.8(AA) 최소 24×24 미달 — 같은 파일 OCR CTA와 동일하게
              min-h-touch(44px)로 채운다(#646). */}
          <div
            data-testid="landing-exit-paths"
            className="relative mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-caption text-landing-muted"
          >
            <div aria-hidden="true" className="absolute inset-0 -z-[5] bg-bg" />
            <button type="button" onClick={onCta} className="min-h-touch inline-flex items-center underline active:scale-[0.97]">
              포스터 있으면 올리기
            </button>
            <span aria-hidden="true" className="text-fg-faint">·</span>
            {/* 포스터 없이 시작(#631) — 단색 바탕 + 조판만으로도 티켓이 성립하는 경로의 진입점. */}
            <button type="button" onClick={onSkip} data-testid="landing-skip-poster" className="min-h-touch inline-flex items-center underline active:scale-[0.97]">
              포스터 없이 직접 입력
            </button>
          </div>
        </div>
      </div>

      {/* 미인증 티켓 고지는 법적 성격이라 랜딩에서 사라지면 안 된다(#614) — AppFooter가 소유.
          편집 화면(inline·hidden)엔 없다: rail dock 위에 고지가 끼는 위계를 없앤 #363 결정이고,
          그 명제를 DOM 부재로 재는 회귀 테스트(appFooterNotice)가 있다. */}
      {overlay && <AppFooter ambient />}
    </div>
  );
}
