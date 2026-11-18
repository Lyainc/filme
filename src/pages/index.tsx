import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { useExportReady } from '@/hooks/useExportReady';
import { useResultView } from '@/hooks/useResultView';
import { useDebounce } from '@/hooks/useDebounce';
import { showError } from '@/utils/errorToast';
import { useThemePreference } from '@/hooks/useThemePreference';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import { PhoneFrame } from '@/components/v2/PhoneFrame';
import { ResultStage } from '@/components/v2/ResultStage';

export default function Home() {
  // 테마 3갈래(#826 S2 D09) — 선호(시스템 · 라이트 · 다크)와 실제로 칠하는 값을 한 훅이 쥔다.
  const { preference: themePreference, theme, setPreference: setThemePreference } = useThemePreference();
  const photo = usePhototicket();
  // 티켓 위 직접 편집 중에는 프리뷰 debounce를 건너뛴다(#775) — 인플레이스 input은 글자가 투명하고
  // 보이는 글자를 티켓 렌더에 맡기므로(#365), 280ms 지연이 끼면 타이핑을 멈출 때까지 새 글자가 안 보인다.
  const [fieldEditing, setFieldEditing] = useState(false);
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
  const debounced = useDebounce(draft, 280, fieldEditing);
  const { movieInfo: debouncedMovieInfo, components: debouncedComponents } = debounced;
  const { fieldVisibility } = photo.state;

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
      .catch(() => {
        // 무음 실패 제거(#645 C2와 같은 축, #731) — 실패해도 흐름은 안 막히지만(추천 색상 없이도
        // 직접 고를 수 있다) 이유를 알 방법이 아예 없었다.
        if (!cancelled) showError('추천 색상을 만들지 못했어요. 색상은 직접 골라 주세요.');
      });
    return () => {
      cancelled = true;
    };
  }, [croppedImageUrl, setRecommendedColors]);

  // 포스터는 완료 조건이 아니다(#631 D3) — 없어도 제목·개봉연도만 채우면 준비완료.
  const railMessage = !canExport ? '제목과 개봉연도가 필요해요' : '티켓이 준비됐어요';

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
      <Head>
        <link rel="canonical" href="https://filme-web.vercel.app/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="FILME" />
        <meta property="og:description" content="영화 포스터로 시네마틱한 포토티켓을 만드세요." />
        <meta property="og:url" content="https://filme-web.vercel.app/" />
        <meta property="og:image" content="https://filme-web.vercel.app/assets/landing/og.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="FILME 시네마틱 포토티켓" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="FILME" />
        <meta name="twitter:description" content="영화 포스터로 시네마틱한 포토티켓을 만드세요." />
        <meta name="twitter:image" content="https://filme-web.vercel.app/assets/landing/og.jpg" />
        <meta name="twitter:image:alt" content="FILME 시네마틱 포토티켓" />
      </Head>
      {/* 완료(결과)는 편집 셸 위 오버레이가 아니라 편집 셸을 교체하는 전체화면 스테이지(#258)로
          "보이는" 전환이지만, MobileEditorShell은 resultOpen 중에도 unmount하지 않고 CSS로만
          숨긴다 — 언마운트하면 셸 로컬 state(viewMode·ghostMode·activeField·스크롤 위치)가
          Done↔뒤로가기 왕복마다 리셋된다(claude-review #297 P1). */}
      <div className={resultOpen ? 'hidden' : undefined}>
        <MobileEditorShell
          onFieldEditingChange={setFieldEditing}
          photo={photo}
          canExport={canExport}
          theme={theme}
          themePreference={themePreference}
          onThemeChange={setThemePreference}
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
          // 결과 화면은 debounce를 안 거친 최신 값으로 그린다(#775) — 슬라이더를 움직이고 280ms 안에
          // 완료를 눌러도 마지막 값이 실린다.
          movieInfo={photo.state.movieInfo}
          components={photo.state.components}
          fieldVisibility={fieldVisibility}
        />
      )}
    </PhoneFrame>
  );
}
