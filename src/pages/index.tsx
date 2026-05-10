import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import TicketRenderer from '@/components/TicketRenderer';
import ImageUploader from '@/components/ImageUploader';
import MovieInfoForm from '@/components/MovieInfoForm';
import ComponentSelector from '@/components/ComponentSelector';
import { usePhototicket } from '@/hooks/usePhototicket';
import { downloadTicketAsJpeg } from '@/utils/captureToImage';
import { extractColors } from '@/utils/colorExtraction';
import { getLayout } from '@/utils/layouts';
import type { LayoutId } from '@/types';

export default function Home() {
  const {
    state,
    debouncedState,
    isProcessing,
    handleImageUpload,
    updateMovieInfo,
    updateComponents,
    setRecommendedColors,
  } = usePhototicket();

  const ticketRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!state.croppedImageUrl) return;
    let cancelled = false;
    extractColors(state.croppedImageUrl, 2).then((colors) => {
      if (!cancelled) setRecommendedColors(colors);
    });
    return () => {
      cancelled = true;
    };
  }, [state.croppedImageUrl, setRecommendedColors]);

  const handleDownload = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || !state.croppedImageUrl) return;

    const layout = getLayout(state.components.layout);
    const filename = `phototicket_${layout.id}_${state.movieInfo.title || 'untitled'}.jpg`;

    setIsExporting(true);
    try {
      await downloadTicketAsJpeg(node, {
        filename,
        width: layout.width,
        height: layout.height,
      });
    } catch (err) {
      console.error('Failed to export ticket', err);
    } finally {
      setIsExporting(false);
    }
  }, [state.croppedImageUrl, state.movieInfo.title, state.components.layout]);

  const issueDate = useMemo(
    () =>
      new Date()
        .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
        .toUpperCase(),
    []
  );

  const ready = !!state.croppedImageUrl;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Masthead */}
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-6 md:px-10 md:py-7">
          <h1 className="text-display text-xl font-light italic leading-none tracking-tightest text-paper md:text-2xl">
            Phototicket <span className="not-italic font-normal">Maker</span>
          </h1>
          <span className="text-mono text-[10px] uppercase tracking-widest text-bone-500">
            {issueDate}
          </span>
        </div>
      </header>

      {/* Main grid */}
      <div className="mx-auto max-w-[1400px] px-5 pb-32 pt-10 md:px-10 md:pb-16 md:pt-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:gap-16">
          {/* Form column */}
          <div className="order-2 space-y-12 lg:order-1 lg:space-y-14">
            <Intro />

            <ImageUploader
              onUpload={handleImageUpload}
              isProcessing={isProcessing}
              hasImage={ready}
            />

            <MovieInfoForm
              movieInfo={state.movieInfo}
              onChange={updateMovieInfo}
            />

            <ComponentSelector
              components={state.components}
              recommendedColors={state.recommendedColors}
              onChange={updateComponents}
            />

            {/* Desktop save action */}
            <div className="hidden lg:block">
              <SaveButton onClick={handleDownload} disabled={!ready || isExporting} busy={isExporting} />
            </div>
          </div>

          {/* Preview column */}
          <div className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-10">
              <PreviewFrame layoutId={debouncedState.components.layout}>
                {ready ? (
                  <TicketRenderer
                    ref={ticketRef}
                    croppedImageUrl={state.croppedImageUrl!}
                    movieInfo={debouncedState.movieInfo}
                    components={debouncedState.components}
                  />
                ) : (
                  <EmptyPreview />
                )}
              </PreviewFrame>

              {/* Mobile save action — inline */}
              <div className="mt-6 lg:hidden">
                <SaveButton onClick={handleDownload} disabled={!ready || isExporting} busy={isExporting} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile floating action — visible only when ready */}
      {ready && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 lg:hidden">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-ink via-ink/95 to-transparent" />
          <button
            onClick={handleDownload}
            className="group flex w-full items-center justify-between gap-4 border border-gold/40 bg-ink-100 px-5 py-4 text-mono text-[11px] uppercase tracking-widest text-paper transition-all active:scale-[0.98]"
          >
            <span className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Save Ticket
            </span>
            <span className="text-gold">→ JPEG</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Sub-components ------------------------------ */

function Intro() {
  return (
    <section className="space-y-3 pb-2">
      <h2 className="text-display text-3xl font-light italic leading-[1.05] tracking-tightest text-paper md:text-[40px]">
        영화의 한 장면을<br />
        <span className="not-italic">손에 쥐는 방식.</span>
      </h2>
      <p className="max-w-[42ch] pt-1 text-sm leading-relaxed text-bone-400 md:text-[15px]">
        포스터를 올리고 정보를 채우면 CGV Photoplay 규격의 프리미엄 티켓이 생성돼요.
        업로드 즉시 미리보기에 반영되거든요.
      </p>
    </section>
  );
}

function PreviewFrame({
  children,
  layoutId,
}: {
  children: React.ReactNode;
  layoutId?: LayoutId;
}) {
  const layout = layoutId ? getLayout(layoutId) : undefined;
  const isLandscape = layout?.orientation === 'landscape';
  return (
    <div
      className={`relative border border-white/[0.06] bg-ink-100 p-4 md:p-6 ${
        isLandscape ? 'mx-auto max-w-full' : ''
      }`}
    >
      {children}
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="flex aspect-[0.65/1] w-full max-w-[420px] mx-auto flex-col items-center justify-center gap-4 border border-dashed border-white/[0.08] bg-ink-200/40 px-6 text-center">
      <div className="text-mono text-[10px] uppercase tracking-widest text-bone-500">
        AWAITING POSTER
      </div>
      <p className="max-w-[24ch] text-sm leading-relaxed text-bone-400">
        포스터를 업로드하면 이곳에 티켓이 실시간으로 조판돼요.
      </p>
    </div>
  );
}

function SaveButton({
  onClick,
  disabled,
  busy = false,
}: {
  onClick: () => void;
  disabled: boolean;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group relative flex w-full items-center justify-between border border-gold/40 bg-transparent px-6 py-5 text-left transition-all hover:border-gold hover:bg-gold/[0.04] disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:opacity-40"
    >
      <span>
        <span className="block text-mono text-[10px] uppercase tracking-widest text-bone-400 group-hover:text-gold">
          {busy ? 'Rendering…' : 'Export · JPEG'}
        </span>
        <span className="text-display mt-1 block text-2xl font-light italic tracking-tight text-paper">
          {busy ? 'Capturing' : 'Save Ticket'}
        </span>
      </span>
      <span className="text-mono text-xs tracking-widest text-gold transition-transform group-hover:translate-x-1">
        ↓
      </span>
    </button>
  );
}
