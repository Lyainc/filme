import { useEffect, useRef, useState } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { ResultPanel } from './ResultPanel';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

interface ResultSheetProps {
  open: boolean;
  onClose: () => void;
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  fieldVisibility: Record<TicketField, boolean>;
}

/**
 * 모바일 결과 바텀시트 — 편집 컨텍스트 위에 떠서 결과(다운로드·공유·링크자리)를 담는다.
 * half(썸네일+액션) ↔ full(세로 티켓 확대) 두 단계. grabber를 탭하면 전환된다.
 * 콘텐츠는 ResultPanel 하나뿐 — 시트는 높이와 프리뷰 너비만 분기한다.
 */
export function ResultSheet({
  open,
  onClose,
  croppedImageUrl,
  movieInfo,
  components,
  fieldVisibility,
}: ResultSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const wasOpen = useRef(false);

  useBodyScrollLock(open);

  // 닫혔다 다시 열릴 때는 항상 half부터 시작.
  useEffect(() => {
    if (open && !wasOpen.current) setExpanded(false);
    wasOpen.current = open;
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="완성된 티켓"
      style={{ position: 'fixed', inset: 0, zIndex: 50 }}
    >
      {/* scrim — 탭하면 닫힘 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          border: 'none',
          cursor: 'pointer',
        }}
      />

      <div
        className="bg-surface"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: expanded ? '92svh' : '58svh',
          transition: 'height 320ms cubic-bezier(0.32, 0.72, 0, 1)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: '0 -8px 40px -12px rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* grabber + 헤더 */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? '티켓 축소' : '티켓 확대'}
            aria-expanded={expanded}
            className="flex w-full items-center justify-center pt-3 pb-2"
          >
            <span
              aria-hidden="true"
              style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)' }}
            />
          </button>
          <div className="flex items-center justify-between px-5 pb-1">
            <h2 className="font-display text-lg font-medium tracking-tight text-fg">
              티켓이 완성됐어요!
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-fg-muted transition-colors hover:text-fg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
          <ResultPanel
            croppedImageUrl={croppedImageUrl}
            movieInfo={movieInfo}
            components={components}
            fieldVisibility={fieldVisibility}
            previewClassName={expanded ? 'max-w-[320px]' : 'max-w-[200px]'}
          />
        </div>
      </div>
    </div>
  );
}
