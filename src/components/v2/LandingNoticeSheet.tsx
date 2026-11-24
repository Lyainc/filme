import { useEffect, useId, useRef } from 'react';
import { cn } from '@/utils/cn';
import { pressableVariants } from '@/components/ui/variants';
import { NoticeContent } from './AppFooter';
import { CloseIcon, dialogKeyDown } from './LandingAttachSheet';

/**
 * 랜딩 이용 고지 시트(#826 S9 constraint-12, 소유자 결정 2026-11-24 '작은 시트로 열기') — 워드마크 줄의 '이용 고지'가
 * 여는 작은 아래 시트. 본문은 AppFooter의 고지 문구 · 크레딧 · GitHub 그대로다. 어둡게 덮지 않고 투명 캐처가 밖 탭을 닫는다.
 * 포커스 복귀('이용 고지' 버튼)는 연 Landing이 맡는다.
 */
export function LandingNoticeSheet({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  return (
    <>
      <div data-testid="landing-notice-catcher" aria-hidden="true" className="absolute inset-0 z-[19]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="landing-notice-sheet"
        onKeyDown={(e) => dialogKeyDown(e, onClose)}
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[var(--pr-r-sheet)] bg-s1 px-4 pt-2 shadow-[0_-6px_16px_-10px_rgba(0,0,0,.5)]"
        style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex h-touch items-center justify-between">
          <h2 id={titleId} className="text-[15px] font-semibold leading-[22px] text-ink">
            이용 고지
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
        <NoticeContent />
      </div>
    </>
  );
}
