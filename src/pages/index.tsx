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
// fallback은 측정 전 첫 페인트 상태의 실측 dock 높이에 맞춘다. 그 시점은 포스터 미업로드라
// dock에 hint("포스터를 먼저 추가해주세요")가 떠 있어 높이가 ~102px → 96px이 80px보다 가깝다.
// EditorCanvas의 OCR 배너/스페이서 fallback과 단일 값(96px)으로 통일(#171).
const DOCK_PADDING_CLASS = 'pb-[calc(var(--mobile-dock-h,96px)+16px)] rail:pb-0';

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
  // movieInfo·components를 한 객체로 묶어 한 번만 디바운스 — 독립 타이머 2개가 각자
  // settle하며 프리뷰를 두 번 리렌더하거나 280ms desync 윈도우를 만드는 걸 막는다(#153 ②).
  // useMemo로 묶어 두 값이 그대로면 같은 참조 → useDebounce가 불필요한 타이머 재시작을 안 한다.
  const draft = useMemo(
    () => ({ movieInfo: photo.state.movieInfo, components: photo.state.components }),
    [photo.state.movieInfo, photo.state.components],
  );
  const debounced = useDebounce(draft, 280);
  const { movieInfo: debouncedMovieInfo, components: debouncedComponents } = debounced;
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
            autoIssue={!isMobile}
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
  ), [croppedImageUrl, resultOpen, debouncedMovieInfo, debouncedComponents, fieldVisibility, canExport, railMessage, openView, closeView, isMobile]);

  return (
    <>
      <AppShell theme={theme} onThemeChange={setTheme} rail={rail}>
        <div className={DOCK_PADDING_CLASS}>
          {/* 모바일 라이브 미니 프리뷰는 하단 MobileDock 좌측 썸네일로 통합했다(#181) —
              상단 sticky 프리뷰는 스크롤하면 화면 밖으로 밀려 거의 안 보였고, 항상 보이는
              dock 썸네일과 중복이라 제거했다. 데스크톱은 우측 rail 프리뷰가 그대로 담당. */}
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
            thumb={
              croppedImageUrl ? (
                <TicketRenderer
                  croppedImageUrl={croppedImageUrl}
                  movieInfo={debouncedMovieInfo}
                  components={debouncedComponents}
                  fieldVisibility={fieldVisibility}
                />
              ) : undefined
            }
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
