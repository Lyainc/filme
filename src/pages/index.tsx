import { useCallback, useEffect, useRef, useState } from 'react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { usePhase } from '@/hooks/usePhase';
import { useDebounce } from '@/hooks/useDebounce';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { downloadTicketAsJpeg } from '@/utils/captureToImage';
import { extractColors } from '@/utils/colorExtraction';
import { getLayout } from '@/utils/layouts';
import { AppShell } from '@/components/v2/AppShell';
import { Phase1Canvas } from '@/components/v2/Phase1Canvas';
import { Phase2Canvas } from '@/components/v2/Phase2Canvas';
import { PreviewFilmCell } from '@/components/v2/PreviewFilmCell';
import { PrimaryCta } from '@/components/v2/PrimaryCta';
import { RailReason } from '@/components/v2/RailReason';
import { MobileDock } from '@/components/v2/MobileDock';
import { PreviewLightbox } from '@/components/v2/PreviewLightbox';
import TicketRenderer from '@/components/TicketRenderer';

type CtaState = 'idle' | 'loading' | 'success' | 'disabled';

export default function Home() {
  // SSR safe: 초기값 'light', mount 후 localStorage/prefers-color-scheme 읽기
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [ctaState, setCtaState] = useState<CtaState>('idle');
  const [pendingFetch, setPendingFetch] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isMobile = useMatchMedia('(max-width: 640px)');

  const ticketRef = useRef<HTMLDivElement>(null);
  const photo = usePhototicket();
  const phase = usePhase({ state: photo.state, pendingFetch });

  const { croppedImageUrl } = photo.state;
  const { setRecommendedColors } = photo;
  const debouncedMovieInfo = useDebounce(photo.state.movieInfo, 280);
  const debouncedComponents = useDebounce(photo.state.components, 280);

  // FOUC 스크립트(_document.tsx)가 이미 적용한 클래스를 신뢰
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light');
  }, []);

  // 사용자 토글 시 class + theme-color + localStorage 동기화
  // 색상 값은 _document.tsx의 themeScript와 동일하게 유지할 것
  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('theme-dark', isDark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark ? '#0E1012' : '#F4F5F7');
    try {
      localStorage.setItem('phototicket:theme', theme);
    } catch {}
  }, [theme]);

  // croppedImageUrl 변경 시 색상 추출
  useEffect(() => {
    if (!croppedImageUrl) return;
    let cancelled = false;
    extractColors(croppedImageUrl)
      .then((colors) => {
        if (!cancelled) setRecommendedColors(colors);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [croppedImageUrl, setRecommendedColors]);

  // success → idle 자동 전환 (2000ms)
  useEffect(() => {
    if (ctaState !== 'success') return;
    const timer = setTimeout(() => setCtaState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [ctaState]);

  const handleDownload = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || !photo.state.croppedImageUrl) return;
    const layout = getLayout(photo.state.components.layout);
    const filename = `phototicket_${layout.id}_${photo.state.movieInfo.title || 'untitled'}.jpg`;
    setCtaState('loading');
    try {
      await downloadTicketAsJpeg(node, {
        filename,
        width: layout.width,
        height: layout.height,
      });
      setCtaState('success');
    } catch (err) {
      console.error('[export]', err);
      setCtaState('idle');
    }
  }, [photo.state.croppedImageUrl, photo.state.movieInfo.title, photo.state.components.layout]);

  const rail = (
    <div className="flex flex-col gap-4">
      {/* 업로드 전에는 프리뷰 영역 자체를 렌더하지 않음 — 빈 티켓 틀이 보이지 않게 */}
      {croppedImageUrl && (
        <PreviewFilmCell saving={ctaState === 'loading'}>
          <TicketRenderer
            ref={ticketRef}
            croppedImageUrl={croppedImageUrl}
            movieInfo={debouncedMovieInfo}
            components={debouncedComponents}
            fieldVisibility={photo.state.fieldVisibility}
          />
        </PreviewFilmCell>
      )}

      {phase.phase === 2 && (
        <>
          <RailReason
            status={!croppedImageUrl ? 'warn' : 'ok'}
            message={!croppedImageUrl ? '포스터를 먼저 추가해주세요' : '티켓이 준비됐어요'}
          />
          <PrimaryCta
            state={ctaState}
            label="JPEG 다운로드"
            onClick={handleDownload}
          />
        </>
      )}
    </div>
  );

  return (
    <>
      <AppShell
        theme={theme}
        onThemeChange={setTheme}
        currentPhase={phase.phase}
        onPhaseClick={(p) => {
          if (p === 2 && phase.canAdvance(1)) phase.goTo(2);
          if (p === 1) phase.goTo(1);
        }}
        canAdvanceToPhase2={phase.canAdvance(1)}
        rail={rail}
      >
        <div style={isMobile ? { paddingBottom: 80 } : {}}>
          <div key={phase.phase} className="phase-in">
            {phase.phase === 1 ? (
              <Phase1Canvas photo={photo} onPendingFetchChange={setPendingFetch} />
            ) : (
              <Phase2Canvas photo={photo} onGoBack={() => phase.goTo(1)} />
            )}
          </div>
        </div>
      </AppShell>

      {isMobile && (
        <MobileDock
          ctaState={ctaState}
          phase={phase.phase}
          canAdvance={phase.canAdvance(1)}
          hasImage={!!croppedImageUrl}
          previewThumb={croppedImageUrl ?? undefined}
          onPreviewClick={() => setLightboxOpen(true)}
          onCtaClick={phase.phase === 1 ? () => phase.goTo(2) : handleDownload}
          onGoBack={phase.phase === 2 ? () => phase.goTo(1) : undefined}
        />
      )}

      <PreviewLightbox open={lightboxOpen} onClose={() => setLightboxOpen(false)}>
        {croppedImageUrl ? (
          <div style={{ pointerEvents: 'none' }}>
            <TicketRenderer
              croppedImageUrl={croppedImageUrl}
              movieInfo={debouncedMovieInfo}
              components={debouncedComponents}
              fieldVisibility={photo.state.fieldVisibility}
            />
          </div>
        ) : (
          <p style={{ color: '#fff', fontSize: 14 }}>포스터를 먼저 추가해주세요</p>
        )}
      </PreviewLightbox>
    </>
  );
}
