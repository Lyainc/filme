import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';

/** 시트 안 Escape 닫기 · Tab 순환(APG Dialog). 포커스가 시트 밖에 있으면 첫 · 마지막 요소로 데려온다. */
function dialogKeyDown(e: KeyboardEvent<HTMLElement>, onClose: () => void) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    onClose();
    return;
  }
  if (e.key !== 'Tab') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const at = document.activeElement;
  if (e.shiftKey && (at === first || !e.currentTarget.contains(at))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (at === last || !e.currentTarget.contains(at))) {
    e.preventDefault();
    first.focus();
  }
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * 랜딩 아래 시트의 공통 틀(#826 S9 constraint-8 · 12) — 첨부 시트와 이용 고지 시트가 같이 쓴다. 화면을 어둡게 덮지 않고
 * 투명 캐처가 시트 밖 탭을 닫으며, role=dialog · aria-modal · 제목 · 닫기 버튼 · Escape · Tab 순환을 갖는다. 포커스 복귀는
 * 시트를 연 Landing이 맡는다(연 버튼이 시트 동안 숨을 수 있어서).
 *
 * @param focusFirstContent true면 처음 포커스가 본문의 첫 버튼(첨부 시트의 '티켓 스크린샷' 행), false면 닫기 버튼.
 * @param className        배치 · z-index · 간격 — 첨부 시트는 흐름 안(relative), 고지 시트는 겹쳐 뜬다(absolute).
 */
export function LandingSheetFrame({
  title,
  testId,
  catcherTestId,
  catcherClassName,
  className,
  style,
  focusFirstContent = false,
  onClose,
  children,
}: {
  title: string;
  testId: string;
  catcherTestId: string;
  catcherClassName: string;
  className: string;
  style?: CSSProperties;
  focusFirstContent?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = focusFirstContent ? bodyRef.current?.querySelector<HTMLElement>('button') : closeRef.current;
    target?.focus();
  }, [focusFirstContent]);

  return (
    <>
      <div data-testid={catcherTestId} aria-hidden="true" className={cn('absolute inset-0', catcherClassName)} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        onKeyDown={(e) => dialogKeyDown(e, onClose)}
        className={cn(
          'flex flex-col rounded-t-[var(--pr-r-sheet)] bg-s1 px-4 pt-2 shadow-[0_-6px_16px_-10px_rgba(0,0,0,.5)]',
          className,
        )}
        style={style}
      >
        <div className="flex h-touch items-center justify-between">
          <h2 id={titleId} className="text-[15px] font-semibold leading-[22px] text-ink">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className={cn(pressableVariants(), 'inline-grid h-touch w-touch place-items-center text-ink-2')}
          >
            <CloseIcon />
          </button>
        </div>
        <div ref={bodyRef} className="contents">
          {children}
        </div>
      </div>
    </>
  );
}
