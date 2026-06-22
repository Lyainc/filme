import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePhototicket } from '@/hooks/usePhototicket';
import { useExportReady } from '@/hooks/useExportReady';
import { useResultView } from '@/hooks/useResultView';
import { useDebounce } from '@/hooks/useDebounce';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { BELOW_RAIL_QUERY } from '@/utils/breakpoints';
import { AppShell } from '@/components/v2/AppShell';
import { EditorCanvas } from '@/components/v2/EditorCanvas';
import { ResultPanel } from '@/components/v2/ResultPanel';
import { ResultSheet } from '@/components/v2/ResultSheet';
import { PreviewFilmCell } from '@/components/v2/PreviewFilmCell';
import { PrimaryCta } from '@/components/v2/PrimaryCta';
import { RailReason } from '@/components/v2/RailReason';
import { MobileDock } from '@/components/v2/MobileDock';
import TicketRenderer from '@/components/TicketRenderer';

// vaul 기반 프리뷰 시트는 모바일 인터랙션 후에야 필요하고 rail(데스크톱)에선 안 쓰므로
// 초기 번들에서 제외한다(vaul+radix). 포스터가 준비되면 preload해 첫 탭 지연을 없앤다(#117).
const PreviewSheet = dynamic(
  () => import('@/components/v2/PreviewSheet').then((m) => m.PreviewSheet),
  { ssr: false },
);

// 모바일 에디터에서 고정 dock에 콘텐츠가 가리지 않게 하단 여백 확보. dock의 실제
// 높이(--mobile-dock-h, MobileDock이 측정해 노출)에 묶어 매직넘버를 없앤다(#102).
// rail 이상에서는 dock이 CSS로 숨으므로 rail:pb-0으로 여백을 끈다 — JS isMobile에
// 의존하지 않아 첫 페인트부터 여백이 자리잡는다(#107 hydration flash 제거).
const DOCK_PADDING_CLASS = 'pb-[calc(var(--mobile-dock-h,80px)+16px)] rail:pb-0';

export default function Home() {
  // SSR safe: 초기값 'light', mount 후 localStorage/prefers-color-scheme 읽기
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [pendingFetch, setPendingFetch] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // rail(데스크톱) ↔ dock/sheet(모바일) 경계는 rail 노출 분기점(rail=1024)과 동일해야
  // 그 사이 폭에서 진입 CTA가 사라지지 않는다. BELOW_RAIL_QUERY가 그 단일 경계(#104).
  const isMobile = useMatchMedia(BELOW_RAIL_QUERY);

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

  // 포스터가 생기면 프리뷰 시트 청크를 미리 받아 dock 썸네일/grabber 첫 탭에 지연이 없게 한다(#117).
  useEffect(() => {
    if (croppedImageUrl) void import('@/components/v2/PreviewSheet');
  }, [croppedImageUrl]);

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
        <div className={DOCK_PADDING_CLASS}>
          {/* 모바일 라이브 미니 프리뷰 — rail이 숨는 1024px 미만에서 색/밝기/texture/무드를
              조정하면 즉시 보이도록 편집 영역 상단에 sticky로 고정한다. 탭하면 프리뷰 시트로
              확대(dock 썸네일과 동일 진입). 데스크톱은 우측 rail 프리뷰가 그 역할을 하므로
              rail:hidden으로 끈다(#139 ③). 노출은 CSS(rail:hidden)로 — JS isMobile에 의존하지
              않아 첫 페인트부터 자리잡는다(#107). */}
          {croppedImageUrl && !resultOpen && (
            <div className="rail:hidden sticky top-0 z-30 -mx-4 mb-6 border-b border-line bg-surface px-4 py-2.5">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex w-full items-center gap-3 text-left"
                aria-label="미리보기 크게 보기"
              >
                <div className="w-[56px] shrink-0 overflow-hidden rounded-sm">
                  <TicketRenderer
                    croppedImageUrl={croppedImageUrl}
                    movieInfo={debouncedMovieInfo}
                    components={debouncedComponents}
                    fieldVisibility={fieldVisibility}
                  />
                </div>
                <span className="text-mono flex-1 text-[10px] uppercase tracking-widest text-fg-muted">
                  실시간 미리보기
                </span>
                <span className="text-mono shrink-0 text-[10px] uppercase tracking-widest text-fg-faint">
                  탭하면 크게 ↗
                </span>
              </button>
            </div>
          )}
          <EditorCanvas photo={photo} onPendingFetchChange={setPendingFetch} />
        </div>
      </AppShell>

      {/* 모바일: 편집 중엔 dock, 결과 열림 시엔 바텀시트(dock은 숨김 — 시트 트리거가 곧 dock CTA).
          노출은 CSS(block rail:hidden)로 — rail aside의 `hidden rail:flex`와 대칭. JS isMobile에
          의존하지 않아 SSR HTML에 항상 들어가고, rail 이상에서만 숨어 첫 페인트 점프가 없다(#107). */}
      {!resultOpen && (
        <div className="block rail:hidden">
          <MobileDock
            ctaLabel="티켓 완성 →"
            disabled={!canExport}
            hint={canExport ? undefined : railMessage}
            hasImage={!!croppedImageUrl}
            previewThumb={croppedImageUrl ?? undefined}
            onPreviewClick={() => setPreviewOpen(true)}
            onCtaClick={openView}
          />
        </div>
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

      <PreviewSheet open={previewOpen} onOpenChange={setPreviewOpen}>
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
          <p className="text-[14px] text-fg-muted">포스터를 먼저 추가해주세요</p>
        )}
      </PreviewSheet>
    </>
  );
}
