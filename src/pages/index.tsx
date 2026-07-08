import { useEffect, useMemo, useState } from 'react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { useExportReady } from '@/hooks/useExportReady';
import { useResultView } from '@/hooks/useResultView';
import { useDebounce } from '@/hooks/useDebounce';
import { useMatchMedia } from '@/hooks/useMatchMedia';
import { BELOW_RAIL_QUERY } from '@/utils/breakpoints';
import { DesktopStudioShell } from '@/components/v2/DesktopStudioShell';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { ResultSheet } from '@/components/v2/ResultSheet';

export default function Home() {
  // SSR safe: 초기값 'light', mount 후 localStorage/prefers-color-scheme 읽기
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  // 모바일 셸(<1024px)과 데스크톱 rail(≥1024px)은 근본 구조가 달라 CSS가 아닌 JS로 분기한다.
  // SSR/첫 페인트는 데스크톱을 기본으로 그리고(서버는 뷰포트를 모름), mount 후 isMobile로 확정.
  // mount 전엔 서버와 클라의 첫 렌더가 같은 트리(데스크톱 셸)라 하이드레이션이 일치한다.
  const [mounted, setMounted] = useState(false);
  // rail(데스크톱) ↔ 모바일 셸 경계는 rail 노출 분기점(rail=1024)과 동일해야
  // 그 사이 폭에서 진입 CTA가 사라지지 않는다. BELOW_RAIL_QUERY가 그 단일 경계(#104).
  const isMobile = useMatchMedia(BELOW_RAIL_QUERY);

  const photo = usePhototicket();
  const canExport = useExportReady({ state: photo.state });
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

  // FOUC 스크립트(_document.tsx)가 이미 적용한 클래스를 신뢰. mount 확정도 여기서(한 번).
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light');
    setMounted(true);
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

  // 모바일 셸은 mount 후에만(SSR/첫 페인트는 데스크톱 기본, 하이드레이션 일치). #212 리뉴얼.
  const showMobile = mounted && isMobile;

  if (showMobile) {
    return (
      <>
        <MobileEditorShell
          photo={photo}
          canExport={canExport}
          theme={theme}
          onThemeChange={setTheme}
          onDone={openView}
          disabledReason={railMessage}
          previewMovieInfo={debouncedMovieInfo}
          previewComponents={debouncedComponents}
          fieldVisibility={fieldVisibility}
        />
        {/* 결과(완성)는 아직 바텀시트로 — Done 화면 리뉴얼은 #222에서 이 자리를 대체한다. */}
        <ResultSheet
          open={resultOpen}
          onClose={closeView}
          croppedImageUrl={croppedImageUrl}
          movieInfo={debouncedMovieInfo}
          components={debouncedComponents}
          fieldVisibility={fieldVisibility}
        />
      </>
    );
  }

  // 데스크톱(및 mount 전 SSR 기본): Studio 3-pane 셸(#224). 3-pane row는 rail(1024) 미만에서
  // 숨겨져 모바일 pre-mount의 가로 overflow를 막는다 — SSR/첫 페인트 하이드레이션은 그대로 일치.
  return (
    <DesktopStudioShell
      photo={photo}
      theme={theme}
      onThemeChange={setTheme}
      canExport={canExport}
      disabledReason={railMessage}
      resultOpen={resultOpen}
      onDone={openView}
      onBackToEdit={closeView}
      previewMovieInfo={debouncedMovieInfo}
      previewComponents={debouncedComponents}
      fieldVisibility={fieldVisibility}
    />
  );
}
