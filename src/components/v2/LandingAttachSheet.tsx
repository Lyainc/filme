import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';

/** 시트 안 Escape 닫기 · Tab 순환(APG Dialog) — 이용 고지 시트도 같이 쓴다(S9 constraint-8 · 12). */
export function dialogKeyDown(e: KeyboardEvent<HTMLElement>, onClose: () => void) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    onClose();
    return;
  }
  if (e.key !== 'Tab') return;
  const items = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
  );
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

export function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export type AttachScreenshotState =
  | { kind: 'empty' }
  | { kind: 'busy' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

const THUMB = 'grid h-[54px] w-9 shrink-0 place-items-center overflow-hidden rounded-[3px] border border-hair-strong text-ink-3';

function Row({
  testId,
  title,
  onClick,
  thumb,
  children,
}: {
  testId: string;
  title: string;
  onClick: () => void;
  thumb: ReactNode;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={cn(
        pressableVariants({ transition: 'cta' }),
        'flex min-h-[64px] w-full items-center gap-3 rounded-ctl border border-hair-strong bg-transparent px-3 py-2 text-left text-ink',
      )}
    >
      {thumb}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold leading-[22px]">{title}</span>
        {children}
      </span>
    </button>
  );
}

/**
 * 랜딩 첨부 시트(#826 S9 constraint-8, D25-12) — 티켓 스크린샷 · 포스터를 한 시트에서 넣고 '만들기'로 시작한다.
 * 열림 · 닫힘은 셸이 쥔다(컨트롤드). 화면을 어둡게 덮지 않는다 — 뒤의 큰 티켓이 실시간으로 차오르는 걸 보여야 해서다.
 * 시트 밖 탭은 투명 캐처가 받아 닫는다. 포커스 복귀(주 버튼)는 시트를 연 Landing이 맡는다.
 */
export function LandingAttachSheet({
  screenshot,
  posterThumb,
  canMake,
  onPickScreenshot,
  onPickPoster,
  onMake,
  onClose,
}: {
  screenshot: AttachScreenshotState;
  posterThumb: string | null;
  canMake: boolean;
  onPickScreenshot: () => void;
  onPickPoster: () => void;
  onMake: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const firstRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    firstRow.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);

  return (
    <>
      {/* 투명 캐처 — 시트 밖 탭은 닫기(어둡게 덮지 않는다). */}
      <div data-testid="landing-sheet-catcher" aria-hidden="true" className="absolute inset-0 z-[4]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="landing-attach-sheet"
        onKeyDown={(e) => dialogKeyDown(e, onClose)}
        className="relative z-[5] flex shrink-0 flex-col gap-2 rounded-t-[var(--pr-r-sheet)] bg-s1 px-4 pt-2 shadow-[0_-6px_16px_-10px_rgba(0,0,0,.5)]"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex h-touch items-center justify-between">
          <h2 id={titleId} className="text-[15px] font-semibold leading-[22px] text-ink">
            티켓과 포스터
          </h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className={cn(pressableVariants(), 'inline-grid h-touch w-touch place-items-center text-ink-2')}
          >
            <CloseIcon />
          </button>
        </div>

        <div ref={firstRow} className="flex flex-col gap-2">
          <Row
            testId="landing-sheet-screenshot"
            title="티켓 스크린샷"
            onClick={onPickScreenshot}
            thumb={
              <span aria-hidden="true" className={THUMB}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12h8" />
                </svg>
              </span>
            }
          >
            {screenshot.kind === 'busy' && (
              <span className="flex items-center gap-1.5 text-caption leading-4 text-ink-2">
                <span aria-hidden="true" className="h-3 w-3 animate-sprocket-spin rounded-[6px] border-2 border-hair-strong border-t-ink motion-reduce:animate-none" />
                인식 중
              </span>
            )}
            {screenshot.kind === 'done' && (
              <span className="text-caption leading-4 text-ink-2">인식했어요</span>
            )}
            {screenshot.kind === 'error' && (
              <span data-testid="landing-sheet-screenshot-error" className="break-keep text-caption leading-4 text-warn">
                {screenshot.message}
              </span>
            )}
          </Row>
          <Row
            testId="landing-sheet-poster"
            title="포스터"
            onClick={onPickPoster}
            thumb={
              <span className={THUMB}>
                {posterThumb ? (
                  <img data-testid="landing-sheet-poster-thumb" src={posterThumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <circle cx="9" cy="9" r="1.6" />
                    <path d="M20 15l-4.5-4.5L6 20" />
                  </svg>
                )}
              </span>
            }
          >
            {!posterThumb && <span className="text-caption leading-4 text-ink-2">선택</span>}
          </Row>
        </div>

        <button
          type="button"
          data-testid="landing-sheet-make"
          aria-disabled={canMake ? undefined : 'true'}
          onClick={() => {
            if (canMake) onMake();
          }}
          className={cn(
            pressableVariants({ transition: 'cta' }),
            'min-h-[48px] w-full rounded-ctl border text-body',
            canMake
              ? 'cursor-pointer border-transparent bg-accent font-semibold text-accent-ink hover:bg-accent-hover'
              : 'cursor-default border-hair-strong bg-transparent font-medium text-ink-2',
          )}
        >
          만들기
        </button>
      </div>
    </>
  );
}
