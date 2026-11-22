import { useRef, type ReactNode, type RefObject } from 'react';
import { keyboardPanelStyle, useKeyboardDismiss } from '@/hooks/useInputKeyboard';

const INTERACTIVE = 'input, textarea, select, button, a, [role="listbox"], [role="option"], [tabindex]';

/** 키보드를 내리지 않게 포인터 누름에서 포커스 이동을 막는다(‹ › · 닫기 · 칩). */
export const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

/**
 * 키보드에 붙는 입력 패널의 껍데기(#826 S4) — 필드 입력 패널과 % 직접 입력(K-03)이 같이 쓴다. 바깥 탭 막(닫기), 키보드
 * 밑판, 패널 면(C-INP: 한 면 + 윗선 한 줄)과 키보드 내림 판정을 쥔다. 자리 계산(inset)은 호출부의 useKeyboardBox가 준다 —
 * 필드 패널은 그 값으로 리프트도 다시 재기 때문이다. PhoneFrame의 contain:paint가 fixed 기준이라 좌표가 프레임 기준이다.
 */
export function KeyboardPanel({
  label,
  inset,
  onClose,
  panelRef,
  isInside,
  suspended,
  data,
  children,
}: {
  /** 그룹 접근 이름 — `${label} 입력`. */
  label: string;
  inset: number;
  onClose: () => void;
  panelRef?: RefObject<HTMLDivElement | null>;
  /** 패널 밖이지만 그리로 가는 포커스가 종료가 아닌 곳(티켓 래퍼 등). */
  isInside?: (el: Element) => boolean;
  suspended?: () => boolean;
  data?: Record<`data-${string}`, string>;
  children: ReactNode;
}) {
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = panelRef ?? ownRef;
  const onBlur = useKeyboardDismiss({
    onDismiss: onClose,
    isInside: (el) => !!ref.current?.contains(el) || !!isInside?.(el),
    suspended,
  });
  return (
    <>
      {/* 밖 탭으로 닫기 — 그 위(티켓 래퍼 z-[41] · 패널 z-50)만 탭이 그대로 가고, 도크 같은 나머지는 이 막이 받는다. */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      {/* 키보드 밑판 — iOS 26 Safari는 입력 액세서리 바 · 자동완성 알약을 visualViewport 밖 반투명 층으로 그려, 패널 아래 끝과
          실제 키보드 사이로 도크가 비쳤다(iOS Simulator 26.5). 패널은 키보드 윗변에 두고 그 아래만 같은 면으로 덮는다. */}
      {inset > 0 && (
        <div aria-hidden="true" data-keyboard-underlay="" className="fixed inset-x-0 bottom-0 z-50 bg-s1" style={{ height: inset }} />
      )}
      <div
        ref={ref}
        role="group"
        aria-label={`${label} 입력`}
        {...data}
        className="fixed inset-x-0 z-50 border-t border-hair-strong bg-s1 px-3"
        onBlur={onBlur}
        // 패널 빈 여백 · 이름표를 눌러도 입력이 포커스를 잃지 않게 한다 — 잃으면 키보드만 내려가고 패널은 남는다. 입력 · 버튼 ·
        // 목록은 각자 포커스를 다룬다(버튼은 keepFocus, 목록 항목은 mousedown 막기).
        onPointerDown={(e) => {
          if (!(e.target as Element).closest(INTERACTIVE)) e.preventDefault();
        }}
        // 슬라이드 없이 페이드만(#354 시안 §5) — reduced-motion은 전역 가드가 duration을 죽인다.
        style={{ ...keyboardPanelStyle(inset), animation: 'screen-in .18s ease-out' }}
      >
        {children}
      </div>
    </>
  );
}
