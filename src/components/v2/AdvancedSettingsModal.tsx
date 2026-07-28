import { useEffect, useRef, type RefObject } from 'react';
import {
  TOOLBAR_MODES,
  ICON as TB_ICON,
  type TbPrefs,
  type TbOrient,
  type TbPlace,
} from './FloatingToolbar';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

/** 불투명 카드(#569) — 오버레이 표면 위 텍스트 행은 --fg만 AA를 넘으므로 muted 잉크가 섞이는
 *  행 그룹은 --surface에 얹는다. MobileEditorShell의 MENU_GROUP_CLS와 같은 값·같은 근거. */
const CARD = 'rounded-[12px] bg-surface p-1';

interface AdvancedSettingsModalProps {
  /** 닫힘 후 포커스를 되돌릴 트리거(햄버거). 모달을 연 '고급 설정' 행은 메뉴와 함께 언마운트되므로
   *  마운트 시점 activeElement를 기억해봐야 detached다 — 살아남는 엘리먼트를 부모가 지목한다. */
  triggerRef: RefObject<HTMLElement | null>;
  prefs: TbPrefs;
  onModeChange: (orient: TbOrient, place: TbPlace) => void;
  onSnap: (side: 'left' | 'right') => void;
  onClose: () => void;
}

/**
 * 고급 설정 풀페이지 모달(#574) — 햄버거 메뉴 안 접이식 '툴바 설정'(#387→#447)이 이 자리로
 * 이사했다. 세 번째 이동이고, #447이 "접기"로 완화했던 메뉴 세로 공간 문제의 근본 해소다.
 * 이번 이관 범위는 툴바 설정뿐 — 다크모드·빈 항목·자동저장은 후속 이슈에서 이 그릇에 담는다.
 *
 * 표면 계층(#569/#580): 티켓 위에 뜨는 패널이라 --overlay-fill/--overlay-border + blur,
 * 그 위 텍스트 행은 전부 불투명 --surface 카드에 얹는다. 새 리터럴 색은 만들지 않는다.
 *
 * z-[55] — 플로팅 툴바(45) 위, 토스트(60) 아래. 모달이 풀페이지라 여는 동안엔 툴바가 안 보이는데,
 * 툴바는 언마운트되지 않으므로 스냅이 재는 rect는 그대로 유효하고 결과는 닫는 즉시 보인다.
 * ponytail: 조정 중 툴바 실시간 미리보기는 안 만든다 — 풀페이지 요구(#574)와 상충하고,
 * 스냅 피드백은 부모의 토스트가 대신한다. 실시간 프리뷰가 정말 필요해지면 그때 비풀페이지 시트로.
 *
 * 닫기 경로: 닫기 버튼 · 상단 백드롭 탭(비드래그 대체 경로) · Escape. 이 모달은 햄버거 메뉴를
 * 닫으면서 열리므로 중첩이 없다 — Escape 한 번이 둘을 같이 닫는 문제(#574 구현 메모)가
 * 애초에 생기지 않는다.
 */
export function AdvancedSettingsModal({
  triggerRef,
  prefs,
  onModeChange,
  onSnap,
  onClose,
}: AdvancedSettingsModalProps) {
  useBodyScrollLock(true);
  // 초기 포커스 + 포커스 가두기 — 패널 밖으로 새면 패널로 되돌린다(FieldDrawer와 동일 패턴,
  // #355). Tab 순환 트랩(ImageCropModal)보다 짧고 이 셸에서 이미 검증된 쪽이다.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
    const keepFocus = (e: FocusEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        panelRef.current.focus();
      }
    };
    document.addEventListener('focusin', keepFocus);
    // 복원은 반드시 리스너를 뗀 뒤에 — 순서가 반대면 keepFocus가 복원 포커스를 곧바로 이 패널로
    // 도로 끌어오고, 그 직후 패널이 언마운트돼 포커스가 body로 떨어진다.
    return () => {
      document.removeEventListener('focusin', keepFocus);
      triggerRef.current?.focus();
    };
  }, [triggerRef]);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[55]">
      {/* 상단에 남긴 띠가 백드롭 탭 타깃이다 — 풀페이지라도 닫기 버튼 말고 포인터 대체 경로를
          하나 더 둔다(WCAG 2.2 SC 2.5.7 계열의 여분 경로). */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="고급 설정"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-card border-t outline-none"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 44px)',
          background: 'var(--overlay-fill)',
          borderColor: 'var(--overlay-border)',
          backdropFilter: 'blur(13px)',
          WebkitBackdropFilter: 'blur(13px)',
        }}
      >
        <div className="shrink-0 px-4 pt-3">
          <div className={CARD}>
            <div className="flex h-11 items-center justify-between gap-2 px-2.5">
              <h2 className="truncate text-[14px] font-semibold text-fg">고급 설정</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                data-touch="44"
                className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg transition-colors hover:bg-white/5"
              >
                <svg {...TB_ICON}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 pt-2"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
        >
          {/* 툴바 설정(#387→#447→#574) — 방향(가로/세로) × 배치(고정/이동) 라디오 4종 +
              이동식일 때 좌/우 가장자리 스냅(WCAG 2.2 SC 2.5.7 비드래그 대체 경로).
              게이팅(croppedImageUrl && !isMax)은 부모가 쥔다 — 툴바가 안 떠 있으면 스냅이 조용히
              no-op이 되므로(claude-review PR #405 P1) 모달 진입 자체를 막는 쪽이 맞다. */}
          <section className={CARD}>
            <h3 className="px-2.5 pb-1 pt-1.5 text-[12px] font-semibold text-fg">툴바 설정</h3>
            <div role="radiogroup" aria-label="툴바 배치">
              {TOOLBAR_MODES.map((m) => {
                const on = prefs.orient === m.orient && prefs.place === m.place;
                return (
                  <button
                    key={m.label}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onModeChange(m.orient, m.place)}
                    // 라벨은 --fg 고정(#569) — --accent는 불투명 표면 위에서도 3.97:1이라 AA에
                    // 못 닿는다. 선택 신호는 accent-soft 채움 + accent 점(둘 다 비텍스트 3:1 기준).
                    className={`flex h-11 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-[12px] font-semibold text-fg ${
                      on ? 'bg-accent-soft' : 'hover:bg-white/5'
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
            </div>
            {prefs.place === 'movable' && (
              <div className="mt-1 flex gap-1 border-t border-line pt-1.5">
                <button
                  type="button"
                  onClick={() => onSnap('left')}
                  aria-label="왼쪽 가장자리로 이동"
                  title="왼쪽 가장자리로 이동"
                  className="flex h-11 flex-1 items-center justify-center rounded-[9px] text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
                >
                  <svg {...TB_ICON}>
                    <path d="M3 19V5" />
                    <path d="m13 6-6 6 6 6" />
                    <path d="M7 12h14" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onSnap('right')}
                  aria-label="오른쪽 가장자리로 이동"
                  title="오른쪽 가장자리로 이동"
                  className="flex h-11 flex-1 items-center justify-center rounded-[9px] text-fg-muted transition-colors hover:bg-white/5 hover:text-fg"
                >
                  <svg {...TB_ICON}>
                    <path d="M21 5v14" />
                    <path d="m11 18 6-6-6-6" />
                    <path d="M17 12H3" />
                  </svg>
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
