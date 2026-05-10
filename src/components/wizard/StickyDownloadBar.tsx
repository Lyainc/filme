import type { WizardStep } from '@/hooks/useWizard';

interface StickyDownloadBarProps {
  step: WizardStep;
  canAdvance: boolean;
  isExporting: boolean;
  ready: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDownload: () => void;
}

export default function StickyDownloadBar({
  step,
  canAdvance,
  isExporting,
  ready,
  onPrev,
  onNext,
  onDownload,
}: StickyDownloadBarProps) {
  const isFirst = step === 1;
  const isLast = step === 4;

  return (
    // position:absolute (not fixed) per design spec — iOS 100vh bug avoidance
    <div
      className="absolute inset-x-0 bottom-0 z-40 border-t hairline bg-surface/95 backdrop-blur"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-5 py-3 md:px-8">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst}
          data-touch="44"
          className="text-mono inline-flex min-h-btn items-center gap-2 rounded-field border hairline bg-paper px-5 text-[11px] uppercase tracking-widest text-fg transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-30"
        >
          ← Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onDownload}
            disabled={!ready || isExporting}
            data-touch="44"
            className="text-mono inline-flex min-h-btn flex-1 items-center justify-center gap-2 rounded-field bg-accent px-6 text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isExporting ? 'Capturing…' : 'Download JPEG ↓'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={!canAdvance}
            data-touch="44"
            className="text-mono inline-flex min-h-btn flex-1 items-center justify-center gap-2 rounded-field bg-accent px-6 text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
