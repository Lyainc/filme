import type { PhototicketState } from '@/types';

interface CanExportParams {
  title: string;
  titleOg: string;
  releaseDate?: string;
}

/** 표시 여부와 별개인 저장 필수 입력(#631, #776). */
export function missingExportFields({ title, releaseDate }: CanExportParams): ('title' | 'releaseDate')[] {
  const missing: ('title' | 'releaseDate')[] = [];
  if (!title.trim()) missing.push('title');
  if ((releaseDate ?? '').trim().length < 4) missing.push('releaseDate');
  return missing;
}

export function canExport(info: CanExportParams): boolean {
  return missingExportFields(info).length === 0;
}

interface UseExportReadyOptions {
  state: PhototicketState;
}

/**
 * 필수 입력(제목·개봉연도)이 채워져 결과를 내보낼 수 있는지.
 * 결과는 별도 화면이 아니라 같은 페이지 위에 뜨는 rail/바텀시트로 표시되므로
 * 화면 전환·sessionStorage 복원 로직은 없다(파생 boolean 하나로 충분).
 */
export function useExportReady({ state }: UseExportReadyOptions): boolean {
  return canExport({
    title: state.movieInfo.title,
    titleOg: state.movieInfo.titleOg,
    releaseDate: state.movieInfo.releaseDate,
  });
}
