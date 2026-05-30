import { useMatchMedia } from '@/hooks/useMatchMedia';
import { Sprocket } from './Sprocket';

type PreviewState = 'empty' | 'updating' | 'ready' | 'saving' | 'saved';
type CtaState = 'idle' | 'loading' | 'success' | 'disabled';

interface MobileDockProps {
  previewState: PreviewState;
  ctaState: CtaState;
  ctaLabel?: string;
  phase: 1 | 2;
  canAdvance: boolean;
  hasImage: boolean;
  previewThumb?: string;
  onPreviewClick?: () => void;
  onCtaClick?: () => void;
  onGoBack?: () => void;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M10.28 2.28 4.75 7.81 1.72 4.78.28 6.22l4.47 4.47 7-7-1.47-1.41z" />
    </svg>
  );
}

function SpinnerIcon({ spin }: { spin: boolean }) {
  return (
    <svg className={spin ? 'animate-spin' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function MobileDock({
  previewState,
  ctaState,
  ctaLabel,
  phase,
  canAdvance,
  hasImage,
  previewThumb,
  onPreviewClick,
  onCtaClick,
  onGoBack,
}: MobileDockProps) {
  const prefersReducedMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  const defaultLabel = phase === 1 ? '다음 →' : 'JPEG 다운로드';
  const label = ctaLabel ?? defaultLabel;

  const isCtaDisabled =
    ctaState === 'disabled' ||
    ctaState === 'loading' ||
    (phase === 1 && !canAdvance) ||
    (phase === 2 && !hasImage);

  const showThumb = previewState !== 'empty' && previewThumb;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        zIndex: 40,
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-translucent)',
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onPreviewClick}
          aria-label="미리보기 확대"
          style={{
            width: 44,
            height: 56,
            flexShrink: 0,
            borderRadius: 6,
            overflow: 'hidden',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: onPreviewClick ? 'pointer' : 'default',
          }}
        >
          {showThumb ? (
            <img
              src={previewThumb}
              alt="티켓 미리보기"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--fg-faint)" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 3v18" />
            </svg>
          )}
        </button>

        <div className="flex flex-1 items-center gap-2">
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              style={{
                flexShrink: 0,
                height: 44,
                paddingLeft: 12,
                paddingRight: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--fg-muted)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ← 수정
            </button>
          )}

          <button
            type="button"
            onClick={isCtaDisabled ? undefined : onCtaClick}
            disabled={isCtaDisabled}
            aria-busy={ctaState === 'loading'}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 8,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontWeight: 600,
              fontSize: 14,
              cursor: isCtaDisabled ? 'not-allowed' : 'pointer',
              opacity: isCtaDisabled && ctaState !== 'loading' ? 0.5 : 1,
              background: ctaState === 'success' ? 'var(--success, #22c55e)' : 'var(--accent)',
              color: '#fff',
              transition: 'background 150ms, opacity 150ms',
            }}
          >
            {ctaState === 'loading' && (
              <>
                <SpinnerIcon spin={!prefersReducedMotion} />
                <span>처리 중...</span>
              </>
            )}
            {ctaState === 'success' && (
              <>
                <CheckIcon />
                <span>완료!</span>
              </>
            )}
            {(ctaState === 'idle' || ctaState === 'disabled') && (
              <>
                <Sprocket size={14} />
                <span>{label}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
