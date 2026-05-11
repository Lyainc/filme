import { useCallback, useEffect, useRef, useState } from 'react';
import TicketRenderer from '@/components/TicketRenderer';
import { usePhototicket } from '@/hooks/usePhototicket';
import { useWizard } from '@/hooks/useWizard';
import { downloadTicketAsJpeg } from '@/utils/captureToImage';
import { extractColors } from '@/utils/colorExtraction';
import { getLayout } from '@/utils/layouts';
import ProgressSteps from './ProgressSteps';
import PreviewPanel from './PreviewPanel';
import PreviewMini from './PreviewMini';
import StickyDownloadBar from './StickyDownloadBar';
import Step1Poster from './Step1Poster';
import Step2Movie from './Step2Movie';
import Step3Mood from './Step3Mood';
import Step4Export from './Step4Export';

export default function WizardShell() {
  const photo = usePhototicket();
  const [pendingFetch, setPendingFetch] = useState(false);
  const wizard = useWizard({ state: photo.state, pendingFetch });
  const ticketRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!photo.state.croppedImageUrl) return;
    let cancelled = false;
    extractColors(photo.state.croppedImageUrl, 2).then((colors) => {
      if (!cancelled) photo.setRecommendedColors(colors);
    });
    return () => {
      cancelled = true;
    };
  }, [photo.state.croppedImageUrl, photo.setRecommendedColors]);

  const handleDownload = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || !photo.state.croppedImageUrl) return;
    const layout = getLayout(photo.state.components.layout);
    const filename = `phototicket_${layout.id}_${photo.state.movieInfo.title || 'untitled'}.jpg`;
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
  }, [photo.state.croppedImageUrl, photo.state.movieInfo.title, photo.state.components.layout]);

  const croppedImageUrl = photo.state.croppedImageUrl;
  const ready = !!croppedImageUrl;
  const isStep4 = wizard.step === 4;

  return (
    <div className="relative min-h-screen bg-bg text-fg">
      <header className="border-b hairline bg-surface">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-8 md:py-5">
          <h1 className="text-base font-medium tracking-tight">Phototicket Maker</h1>
          <ProgressSteps
            current={wizard.step}
            completed={wizard.completedSteps}
            onJump={wizard.goTo}
          />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-5 pb-32 pt-8 md:px-8 md:pt-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:gap-12">
          <section className="order-2 min-w-0 lg:order-1">
            {wizard.step === 1 && <Step1Poster photo={photo} />}
            {wizard.step === 2 && (
              <Step2Movie photo={photo} onPendingFetchChange={setPendingFetch} />
            )}
            {wizard.step === 3 && <Step3Mood photo={photo} />}
            {wizard.step === 4 && (
              <Step4Export photo={photo} onDownload={handleDownload} isExporting={isExporting} />
            )}
          </section>

          {/* Right rail: preview chrome.
              PreviewMini (steps 1-3) is presentational and may unmount/remount safely.
              The TicketRenderer host below stays mounted once `ready` flips true and
              never unmounts — it toggles between in-frame (step 4) and offscreen (1-3)
              via CSS only, satisfying the single-mount constraint. */}
          <aside className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-8">
              {/* PreviewMini visible at steps 1-3 */}
              <div className={isStep4 ? 'hidden' : 'block'}>
                <PreviewMini
                  layoutId={photo.debouncedState.components.layout}
                  ready={ready}
                  step={wizard.step}
                  posterUrl={croppedImageUrl}
                />
              </div>

              {/* TicketRenderer host. Position swap: offscreen (steps 1-3) ⇄ in-frame (step 4).
                  TicketRenderer mounts once `ready` becomes true and never unmounts thereafter. */}
              <div
                aria-hidden={!isStep4}
                className={
                  isStep4
                    ? 'block'
                    : 'pointer-events-none invisible absolute -left-[9999px] top-0'
                }
              >
                <PreviewPanel layoutId={photo.debouncedState.components.layout}>
                  {croppedImageUrl ? (
                    <TicketRenderer
                      ref={ticketRef}
                      croppedImageUrl={croppedImageUrl}
                      movieInfo={photo.debouncedState.movieInfo}
                      components={photo.debouncedState.components}
                    />
                  ) : (
                    <div className="text-mono py-8 text-center text-[11px] uppercase tracking-widest text-fg-faint">
                      Awaiting poster
                    </div>
                  )}
                </PreviewPanel>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <StickyDownloadBar
        step={wizard.step}
        canAdvance={wizard.canAdvance(wizard.step)}
        ready={ready}
        isExporting={isExporting}
        onPrev={wizard.goPrev}
        onNext={wizard.goNext}
        onDownload={handleDownload}
      />
    </div>
  );
}
