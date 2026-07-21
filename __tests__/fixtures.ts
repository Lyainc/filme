import type { LayoutId, MovieInfo, TicketComponents } from '../src/types';

/**
 * 무드 6종 마스터 resync 테스트(#281)가 공유하는 fixture — 각 파일에서 `layout` 값만 바꿔
 * 복붙하던 FULL_MOVIE/BASE 블록. 값 하나를 고치려면 6곳이 아니라 여기 1곳만 고치면 된다.
 * assertion·Harness 구조는 이 파일로 옮기지 않는다(각 테스트 파일이 그대로 소유) — DRY는
 * 순수 데이터에만 적용.
 */
export const FULL_MOVIE: MovieInfo = {
  title: '그랜드 부다페스트 호텔', titleOg: 'The Grand Budapest Hotel', actors: '랄프 파인즈, 토니 레볼로리 외 3명', rating: 4.5,
  releaseDate: '2014-03-20', releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '2023-09-15', isReissue: true,
  watchDate: '2024-03-15', watchDateFormat: 'kr-compact', watchTime: '19:30',
  theater: '메가박스 코엑스', screen: 'Dolby Cinema', seat: 'G14', runtime: '99분',
  bookingNumber: 'BOOK-1234', signature: '영화수집가',
};

export function makeMoodBase(layout: LayoutId): TicketComponents {
  return {
    layout, chain: '', format: '', chainLabel: 'MEGABOX', formatLabel: 'DOLBY',
    material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1, posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
    chainVisible: true, formatVisible: true, chainScale: 1, formatScale: 1, posterFit: 'cover',
  };
}
