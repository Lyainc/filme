import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { useScreen } from '@/hooks/useScreen';
import { useDebounce } from '@/hooks/useDebounce';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import {
  canShareTicketFile,
  downloadTicketAsJpeg,
  shareTicketAsJpeg,
} from '@/utils/captureToImage';
import { getLayout } from '@/utils/layouts';
import { AppShell } from '@/components/v2/AppShell';
import { EditorCanvas } from '@/components/v2/EditorCanvas';
import { DoneCanvas } from '@/components/v2/DoneCanvas';
import { PreviewFilmCell } from '@/components/v2/PreviewFilmCell';
import { PrimaryCta } from '@/components/v2/PrimaryCta';
import { RailReason } from '@/components/v2/RailReason';
import { MobileDock } from '@/components/v2/MobileDock';
import { PreviewLightbox } from '@/components/v2/PreviewLightbox';
import TicketRenderer from '@/components/TicketRenderer';

type CtaState = 'idle' | 'loading' | 'success' | 'disabled';

// 모바일 에디터에서 고정 dock에 콘텐츠가 가리지 않게 하단 여백 확보 (렌더마다 새 객체 생성 방지)
const DOCK_PADDING = { paddingBottom: 80 } as const;

export default function Home() {
  // SSR safe: 초기값 'light', mount 후 localStorage/prefers-color-scheme 읽기
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [ctaState, setCtaState] = useState<CtaState>('idle');
  const [shareState, setShareState] = useState<CtaState>('idle');
  // SSR safe: navigator는 mount 후에만 — 데스크톱 등 미지원 환경에선 공유 버튼 숨김
  const [canShareFile, setCanShareFile] = useState(false);
  const [pendingFetch, setPendingFetch] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isMobile = useMatchMedia('(max-width: 640px)');

  const ticketRef = useRef<HTMLDivElement>(null);
  const photo = usePhototicket();
  const { screen, goTo, canExport } = useScreen({ state: photo.state, pendingFetch });

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

  // Web Share API Level 2(파일 공유) 지원 판정 — 클라이언트에서만
  useEffect(() => {
    setCanShareFile(canShareTicketFile());
  }, []);

  // success → idle 자동 전환 (2000ms)
  useEffect(() => {
    if (ctaState !== 'success') return;
    const timer = setTimeout(() => setCtaState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [ctaState]);

  useEffect(() => {
    if (shareState !== 'success') return;
    const timer = setTimeout(() => setShareState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [shareState]);

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

  const handleShare = useCallback(async () => {
    const node = ticketRef.current;
    if (!node || !photo.state.croppedImageUrl) return;
    const layout = getLayout(photo.state.components.layout);
    const title = photo.state.movieInfo.title || 'untitled';
    setShareState('loading');
    try {
      const result = await shareTicketAsJpeg(node, {
        filename: `phototicket_${layout.id}_${title}.jpg`,
        width: layout.width,
        height: layout.height,
        shareTitle: title,
      });
      setShareState(result === 'shared' ? 'success' : 'idle');
    } catch (err) {
      console.error('[share]', err);
      setShareState('idle');
    }
  }, [photo.state.croppedImageUrl, photo.state.movieInfo.title, photo.state.components.layout]);

  const railMessage = !croppedImageUrl
    ? '포스터를 먼저 추가해주세요'
    : !canExport
      ? '제목 · 원제 · 개봉연도를 채워주세요'
      : '티켓이 준비됐어요';

  // useMemo로 안정 참조 유지 — deps가 그대로면 동일 엘리먼트 참조라 React가 rail
  // 서브트리 재조정을 건너뛴다(theme·isMobile·lightbox 등 무관한 리렌더 시 스킵).
  // 완료 화면은 캔버스가 프리뷰·액션을 직접 그리므로 rail은 에디터에서만 쓴다.
  const rail = useMemo(() => (
    <div className="flex flex-col gap-4">
      {/* 업로드 전에는 프리뷰 영역 자체를 렌더하지 않음 — 빈 티켓 틀이 보이지 않게 */}
      {croppedImageUrl && (
        <PreviewFilmCell>
          <TicketRenderer
            croppedImageUrl={croppedImageUrl}
            movieInfo={debouncedMovieInfo}
            components={debouncedComponents}
            fieldVisibility={photo.state.fieldVisibility}
          />
        </PreviewFilmCell>
      )}

      <RailReason status={canExport ? 'ok' : 'warn'} message={railMessage} />
      <PrimaryCta
        state={canExport ? 'idle' : 'disabled'}
        label="티켓 완성"
        onClick={() => goTo('done')}
      />
    </div>
  ), [croppedImageUrl, debouncedMovieInfo, debouncedComponents, photo.state.fieldVisibility, canExport, railMessage, goTo]);

  return (
    <>
      <AppShell
        theme={theme}
        onThemeChange={setTheme}
        rail={screen === 'editor' ? rail : undefined}
      >
        <div style={isMobile && screen === 'editor' ? DOCK_PADDING : undefined}>
          <div key={screen} className="screen-in">
            {screen === 'editor' ? (
              <EditorCanvas photo={photo} onPendingFetchChange={setPendingFetch} />
            ) : (
              <DoneCanvas
                croppedImageUrl={croppedImageUrl}
                movieInfo={debouncedMovieInfo}
                components={debouncedComponents}
                fieldVisibility={photo.state.fieldVisibility}
                ticketRef={ticketRef}
                ctaState={ctaState}
                onDownload={handleDownload}
                canShare={canShareFile}
                shareState={shareState}
                onShare={handleShare}
                onBack={() => goTo('editor')}
              />
            )}
          </div>
        </div>
      </AppShell>

      {isMobile && screen === 'editor' && (
        <MobileDock
          ctaLabel="티켓 완성 →"
          disabled={!canExport}
          hint={canExport ? undefined : railMessage}
          hasImage={!!croppedImageUrl}
          previewThumb={croppedImageUrl ?? undefined}
          onPreviewClick={() => setLightboxOpen(true)}
          onCtaClick={() => goTo('done')}
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
