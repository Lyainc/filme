import type { PhototicketState } from '@/types';

interface CanExportParams {
  title: string;
  titleOg: string;
  releaseDate?: string;
}

type ExportField = 'title' | 'releaseDate';

// 포스터는 완료 조건이 아니다(#631 D3) — 포스터 없이도 단색 바탕 티켓이 성립하므로 제목·개봉연도만 본다.
// 표시 여부(fieldVisibility)와는 별개다 — 개봉일을 티켓에서 숨겨도 저장엔 연도가 필요하다(#776).
export function missingExportFields({ title, releaseDate }: CanExportParams): ExportField[] {
  const missing: ExportField[] = [];
  if (title.trim().length === 0) missing.push('title');
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
