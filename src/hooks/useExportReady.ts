import type { PhototicketState } from '@/types';

interface CanExportParams {
  hasPoster: boolean;
  title: string;
  titleOg: string;
  releaseDate: string | undefined;
  pendingFetch: boolean;
}

export function canExport({
  hasPoster,
  title,
  titleOg,
  releaseDate,
  pendingFetch,
}: CanExportParams): boolean {
  if (pendingFetch) return false;
  const release = (releaseDate ?? '').trim();
  return (
    hasPoster &&
    title.trim().length > 0 &&
    titleOg.trim().length > 0 &&
    release.length >= 4
  );
}

interface UseExportReadyOptions {
  state: PhototicketState;
  pendingFetch: boolean;
}

/**
 * 필수 입력(포스터·제목·원제·개봉연도)이 채워져 결과를 내보낼 수 있는지.
 * 결과는 별도 화면이 아니라 같은 페이지 위에 뜨는 rail/바텀시트로 표시되므로
 * 화면 전환·sessionStorage 복원 로직은 없다(파생 boolean 하나로 충분).
 */
export function useExportReady({ state, pendingFetch }: UseExportReadyOptions): boolean {
  return canExport({
    hasPoster: !!state.croppedImageUrl,
    title: state.movieInfo.title,
    titleOg: state.movieInfo.titleOg,
    releaseDate: state.movieInfo.releaseDate,
    pendingFetch,
  });
}
