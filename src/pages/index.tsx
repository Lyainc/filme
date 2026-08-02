import { useEffect, useMemo, useState } from 'react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { useExportReady } from '@/hooks/useExportReady';
import { useResultView } from '@/hooks/useResultView';
import { useDebounce } from '@/hooks/useDebounce';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { PhoneFrame } from '@/components/v2/PhoneFrame';
import { ResultStage } from '@/components/v2/ResultStage';

export default function Home() {
  // SSR safe: 초기값 'light', mount 후 localStorage/prefers-color-scheme 읽기
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
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

  // FOUC 스크립트(_document.tsx)가 이미 적용한 클래스를 신뢰.
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

  // 포스터는 완료 조건이 아니다(#631 D3) — 없어도 제목·개봉연도만 채우면 준비완료.
  const railMessage = !canExport ? '제목 · 개봉연도를 채워주세요' : '티켓이 준비됐어요';

  // html 배경 동기화(#402→#415). MobileEditorShell은 이제 theme를 그대로 따르므로(#415) html의
  // 기존 .theme-dark 동기화(위 useEffect)와 저절로 맞아 별도 forcing이 필요 없다. ResultStage만
  // 예외 — 테마와 무관하게 상시 .chrome-dark다(#357, 이 이슈의 범위 밖) → html도
  // resultOpen일 때만 같이 다크로 맞춰 라이트 테마에서 결과화면 진입 시 배경 블리드(#402)를 막는다.
  useEffect(() => {
    document.documentElement.classList.toggle('chrome-dark', resultOpen);
    return () => {
      document.documentElement.classList.remove('chrome-dark');
    };
  }, [resultOpen]);

  // 셸은 한 벌이다(#607) — 데스크톱 3-pane(DesktopStudioShell)과 뷰포트 JS 분기(mounted·isMobile
  // SSR 왕복)는 삭제됐고, 데스크톱은 이 모바일 셸을 400px 폰 프레임에 넣어 그대로 띄운다.
  return (
    // 폰 프레임(#604) — 셸·결과 스테이지를 한 컨테이너에 담아 fixed 오버레이의 컨테이닝 블록과
    // cq 단위의 기준을 뷰포트에서 프레임으로 옮긴다. 모바일에선 프레임=뷰포트라 렌더 불변.
    <PhoneFrame>
      {/* 완료(결과)는 편집 셸 위 오버레이가 아니라 편집 셸을 교체하는 전체화면 스테이지(#258)로
          "보이는" 전환이지만, MobileEditorShell은 resultOpen 중에도 unmount하지 않고 CSS로만
          숨긴다 — 언마운트하면 셸 로컬 state(viewMode·ghostMode·activeField·스크롤 위치)가
          Done↔뒤로가기 왕복마다 리셋된다(claude-review #297 P1). */}
      <div className={resultOpen ? 'hidden' : undefined}>
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
      </div>
      {resultOpen && (
        <ResultStage
          theme={theme}
          onBack={closeView}
          croppedImageUrl={croppedImageUrl}
          movieInfo={debouncedMovieInfo}
          components={debouncedComponents}
          fieldVisibility={fieldVisibility}
        />
      )}
    </PhoneFrame>
  );
}
