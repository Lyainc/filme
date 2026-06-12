import { useEffect, useMemo, useState } from 'react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { useExportReady } from '@/hooks/useExportReady';
import { useResultView } from '@/hooks/useResultView';
import { useDebounce } from '@/hooks/useDebounce';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { AppShell } from '@/components/v2/AppShell';
import { EditorCanvas } from '@/components/v2/EditorCanvas';
import { ResultPanel } from '@/components/v2/ResultPanel';
import { ResultSheet } from '@/components/v2/ResultSheet';
import { PreviewFilmCell } from '@/components/v2/PreviewFilmCell';
import { PrimaryCta } from '@/components/v2/PrimaryCta';
import { RailReason } from '@/components/v2/RailReason';
import { MobileDock } from '@/components/v2/MobileDock';
import { PreviewLightbox } from '@/components/v2/PreviewLightbox';
import TicketRenderer from '@/components/TicketRenderer';

// 모바일 에디터에서 고정 dock에 콘텐츠가 가리지 않게 하단 여백 확보. dock의 실제
// 높이(--mobile-dock-h, MobileDock이 측정해 노출)에 묶어 매직넘버를 없앤다(#102).
const DOCK_PADDING = { paddingBottom: 'calc(var(--mobile-dock-h, 80px) + 16px)' } as const;

export default function Home() {
  // SSR safe: 초기값 'light', mount 후 localStorage/prefers-color-scheme 읽기
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [pendingFetch, setPendingFetch] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isMobile = useMatchMedia('(max-width: 640px)');

  const photo = usePhototicket();
  const canExport = useExportReady({ state: photo.state, pendingFetch });
  const { open: resultOpen, openView, closeView } = useResultView();

  const { croppedImageUrl } = photo.state;
  const { setRecommendedColors } = photo;
  const debouncedMovieInfo = useDebounce(photo.state.movieInfo, 280);
  const debouncedComponents = useDebounce(photo.state.components, 280);
  const { fieldVisibility } = photo.state;

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
  // colorExtraction(~167줄 K-means)은 업로드 시점에만 동적 로드 → 초기 페이지 청크에서 제외
  useEffect(() => {
    if (!croppedImageUrl) return;
    let cancelled = false;
    import('@/utils/colorExtraction')
      .then(({ extractColors }) => extractColors(croppedImageUrl))
      .then((colors) => {
        if (!cancelled) setRecommendedColors(colors);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [croppedImageUrl, setRecommendedColors]);

  const railMessage = !croppedImageUrl
    ? '포스터를 먼저 추가해주세요'
    : !canExport
      ? '제목 · 원제 · 개봉연도를 채워주세요'
      : '티켓이 준비됐어요';

  // useMemo로 안정 참조 유지 — deps가 그대로면 동일 엘리먼트 참조라 React가 rail
  // 서브트리 재조정을 건너뛴다(theme·isMobile·lightbox 등 무관한 리렌더 시 스킵).
  // 데스크톱 rail은 편집 중엔 프리뷰+CTA, 결과 열림 시 같은 자리에서 ResultPanel로
  // 모핑한다(인플레이스). 결과 콘텐츠는 모바일 시트와 동일한 ResultPanel 하나뿐.
  const rail = useMemo(() => (
    <div className="flex flex-col gap-4">
      {/* 업로드 전에는 프리뷰 영역 자체를 렌더하지 않음 — 빈 티켓 틀이 보이지 않게.
          결과 열림 시엔 ResultPanel이 자체 프리뷰(캡처 대상)를 그리므로 편집 프리뷰는 숨긴다. */}
      {croppedImageUrl && !resultOpen && (
        <PreviewFilmCell>
          <TicketRenderer
            croppedImageUrl={croppedImageUrl}
            movieInfo={debouncedMovieInfo}
            components={debouncedComponents}
            fieldVisibility={fieldVisibility}
          />
        </PreviewFilmCell>
      )}

      {resultOpen ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={closeView}
            className="text-mono inline-flex min-h-[44px] items-center gap-1.5 self-start text-[11px] uppercase tracking-widest text-fg-muted transition-colors hover:text-fg"
          >
            ← 편집으로 돌아가기
          </button>
          <ResultPanel
            croppedImageUrl={croppedImageUrl}
            movieInfo={debouncedMovieInfo}
            components={debouncedComponents}
            fieldVisibility={fieldVisibility}
          />
        </div>
      ) : (
        <>
          <RailReason status={canExport ? 'ok' : 'warn'} message={railMessage} />
          <PrimaryCta
            state={canExport ? 'idle' : 'disabled'}
            label="티켓 완성"
            onClick={openView}
          />
        </>
      )}
    </div>
  ), [croppedImageUrl, resultOpen, debouncedMovieInfo, debouncedComponents, fieldVisibility, canExport, railMessage, openView, closeView]);

  return (
    <>
      <AppShell theme={theme} onThemeChange={setTheme} rail={rail}>
        <div style={isMobile ? DOCK_PADDING : undefined}>
          <EditorCanvas photo={photo} onPendingFetchChange={setPendingFetch} />
        </div>
      </AppShell>

      {/* 모바일: 편집 중엔 dock, 결과 열림 시엔 바텀시트(dock은 숨김 — 시트 트리거가 곧 dock CTA). */}
      {isMobile && !resultOpen && (
        <MobileDock
          ctaLabel="티켓 완성 →"
          disabled={!canExport}
          hint={canExport ? undefined : railMessage}
          hasImage={!!croppedImageUrl}
          previewThumb={croppedImageUrl ?? undefined}
          onPreviewClick={() => setLightboxOpen(true)}
          onCtaClick={openView}
        />
      )}

      {isMobile && (
        <ResultSheet
          open={resultOpen}
          onClose={closeView}
          croppedImageUrl={croppedImageUrl}
          movieInfo={debouncedMovieInfo}
          components={debouncedComponents}
          fieldVisibility={fieldVisibility}
        />
      )}

      <PreviewLightbox open={lightboxOpen} onClose={() => setLightboxOpen(false)}>
        {croppedImageUrl ? (
          <div style={{ pointerEvents: 'none' }}>
            <TicketRenderer
              croppedImageUrl={croppedImageUrl}
              movieInfo={debouncedMovieInfo}
              components={debouncedComponents}
              fieldVisibility={fieldVisibility}
            />
          </div>
        ) : (
          <p style={{ color: '#fff', fontSize: 14 }}>포스터를 먼저 추가해주세요</p>
        )}
      </PreviewLightbox>
    </>
  );
}
