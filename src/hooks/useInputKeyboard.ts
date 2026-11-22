import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent } from 'react';
import { getFrameRect } from '@/components/v2/PhoneFrame';
import { keyboardInset } from '@/utils/inputKeyboard';

/**
 * 키보드에 붙는 입력 패널의 공용 동작(#826 S4) — 필드 입력 패널(InPlaceFieldEditor)과 % 직접 입력(K-03)이 같이 쓴다.
 * 순수 계산은 utils/inputKeyboard.ts, 여기는 DOM 측정 · 이벤트 · history만 쥔다.
 */

export interface KeyboardBox {
  /** 키보드 높이(px) — #phone-frame 바닥 기준. 패널 style.bottom에 그대로 쓴다. */
  inset: number;
  /** 보이는 영역 높이(visualViewport.height, 없으면 창 높이) — 패널 안 목록의 가용 높이(#476). */
  visibleHeight: number;
}

function readKeyboard(): KeyboardBox {
  const vv = window.visualViewport;
  const frame = getFrameRect();
  return {
    inset: keyboardInset(frame.top + frame.height, vv),
    visibleHeight: vv ? vv.height : window.innerHeight,
  };
}

/**
 * visualViewport resize · scroll 때만 다시 잰다(#354 rAF 루프 금지). 첫 값은 마운트 직후 한 번.
 */
export function useKeyboardBox(): KeyboardBox | null {
  const [box, setBox] = useState<KeyboardBox | null>(null);
  useEffect(() => {
    const update = () =>
      setBox((prev) => {
        const next = readKeyboard();
        return prev && prev.inset === next.inset && prev.visibleHeight === next.visibleHeight ? prev : next;
      });
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, []);
  return box;
}

/** 패널 위아래 기본 여백(px). */
const PANEL_PAD = 8;

/**
 * 패널 자리(D15 6A, K-01 ①): 키보드가 떠 있으면 패널 아래 끝 = 키보드 윗변(틈 0). 없으면 프레임 바닥에 붙고 아래 안전
 * 영역만큼 여백을 더 둔다 — 키보드가 홈 인디케이터를 덮을 땐 안전 영역이 필요 없다.
 */
export function keyboardPanelStyle(inset: number): CSSProperties {
  return {
    bottom: inset,
    paddingTop: PANEL_PAD,
    paddingBottom: inset > 0 ? PANEL_PAD : `calc(${PANEL_PAD}px + env(safe-area-inset-bottom, 0px))`,
  };
}

const HISTORY_KEY = 'phototicketInputPanel';
let historySeq = 0;

/**
 * 뒤로 = 닫기(K-08 (d)). 패널이 열릴 때 history 항목을 하나 넣고 popstate로 닫는다. 다른 경로(닫기 · 키보드 내림 ·
 * 바깥 탭)로 닫히면 넣었던 항목을 history.back()으로 소비해, 뒤로를 한 번 더 눌러야 하는 빈 항목이 남지 않게 한다.
 *
 * open의 변화만 본다 — 열려 있는 동안 필드를 바꿔도 항목이 늘지 않는다. effect에 cleanup을 두지 않는 건 StrictMode의
 * 마운트 이중 실행이 push → back → push를 만들어, 늦게 도착한 popstate가 방금 연 패널을 닫기 때문이다(next.config
 * reactStrictMode). 결과 화면(useResultView)도 popstate를 듣지만 그쪽은 자기 항목이 없으면 아무것도 안 바뀐다.
 */
export function usePanelHistory(open: boolean, onPop: () => void) {
  const pushedRef = useRef(false);
  // 이 패널이 넣은 항목의 표 — 돌아온 자리가 다른 항목(새로고침 전에 남은 패널 항목 포함)이면 우리 항목을 떠난 것이다.
  const tokenRef = useRef('');
  // 다른 경로로 닫으며 부른 back()의 popstate는 늦게 온다 — 그 사이 다시 열린 패널을 닫지 않게 한 번 건너뛴다.
  const skipPopRef = useRef(false);
  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;
  // 넣은 항목을 소비한다 — 지금 위치가 그 항목일 때만 back()한다. 그 사이 다른 항목이 올라왔으면 그걸 꺼내면 안 된다.
  const consume = () => {
    pushedRef.current = false;
    const state = window.history.state as Record<string, unknown> | null;
    if (state?.[HISTORY_KEY] !== tokenRef.current) return;
    skipPopRef.current = true;
    window.history.back();
  };

  useEffect(() => {
    if (open && !pushedRef.current) {
      pushedRef.current = true;
      tokenRef.current = `${Date.now()}-${++historySeq}`;
      window.history.pushState({ [HISTORY_KEY]: tokenRef.current }, '');
    } else if (!open && pushedRef.current) {
      consume();
    }
  }, [open]);

  // 열린 채로 떠나면(언마운트) 넣은 항목을 남기지 않는다. StrictMode의 마운트 이중 실행 땐 아직 항목이 없어 아무 일도 안 한다.
  useEffect(() => () => {
    if (pushedRef.current) consume();
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (skipPopRef.current) {
        skipPopRef.current = false;
        return;
      }
      const state = window.history.state as Record<string, unknown> | null;
      if (!pushedRef.current || state?.[HISTORY_KEY] === tokenRef.current) return;
      pushedRef.current = false;
      onPopRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
}

/** 포인터 누름 뒤 이 안에 오는 포커스 이탈은 그 누름(바깥 탭 · 패널 안 조작)이 결과를 정한다. */
const POINTER_DECIDES_MS = 800;

/**
 * 키보드 내림 = 닫기(K-08 (b)). 패널에서 포커스가 나가 패널 · 티켓 필드 · 패널이 연 목록 어디에도 없으면 닫는다 — iOS
 * 키보드의 '완료' · 내리기는 페이지에 포인터 이벤트 없이 relatedTarget 없는 입력 blur만 남긴다.
 *
 * 판정을 한 틱 미룬다: Return · ‹ ›로 필드를 바꾸면 입력이 다시 마운트되며 잠깐 포커스가 비고, 목록을 닫으면 미리보기
 * 버튼으로 포커스가 돌아온다 — 다음 틱의 activeElement가 안쪽이면 이동이지 종료가 아니다. 포인터 누름 직후의 이탈은
 * 건너뛴다: 바깥 탭이면 backdrop click이 닫고(같은 결과), 패널 배경 탭이면 닫을 일이 아니다.
 */
export function useKeyboardDismiss({
  onDismiss,
  isInside,
  suspended,
}: {
  onDismiss: () => void;
  /** 이 요소로 가는 포커스는 이동이지 종료가 아니다(패널 · 티켓 래퍼 등). */
  isInside: (el: Element) => boolean;
  /** 이미지 고르기 · 크롭 모달처럼 패널이 연 다른 화면이 포커스를 가져간 동안. */
  suspended?: () => boolean;
}) {
  const lastPointerRef = useRef(-Infinity);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ onDismiss, isInside, suspended });
  latest.current = { onDismiss, isInside, suspended };

  useEffect(() => {
    const onPointerDown = () => {
      lastPointerRef.current = performance.now();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback((e: FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Element | null;
    if (next && latest.current.isInside(next)) return;
    if (performance.now() - lastPointerRef.current < POINTER_DECIDES_MS) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const { onDismiss: dismiss, isInside: inside, suspended: paused } = latest.current;
      if (paused?.()) return;
      const active = document.activeElement;
      if (active && inside(active)) return;
      dismiss();
    }, 0);
  }, []);
}
