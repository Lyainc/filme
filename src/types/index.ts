export type LayoutId = 'minimal' | 'criterion' | '35mm' | 'editorial' | 'stub' | '35mm-landscape';

export type DateFormatToken = 'iso' | 'kr-compact' | 'cinema-mono' | 'en-long';
export type DateGranularity = 'year' | 'year-month' | 'date';

export type TicketField =
  | 'title'
  | 'titleOg'
  | 'actors'
  | 'watchDate'
  | 'watchTime'
  | 'theater'
  | 'screen'
  | 'seat'
  | 'runtime'
  | 'rating'
  | 'releaseDate'
  | 'reissue'
  | 'bookingNo'
  | 'signature'
  | 'quote';

export interface MovieInfo {
  title: string;
  titleOg: string;
  /** Variable-length ISO: '1994' | '1994-11' | '1994-11-06'. Required (≥ year). */
  releaseDate?: string;
  releaseDateGranularity?: DateGranularity;
  releaseDateFormat?: DateFormatToken;
  /** Re-release date — same variable-length ISO. */
  reissueDate?: string;
  isReissue?: boolean;
  /** ISO 'YYYY-MM-DD'. Optional. */
  watchDate?: string;
  watchDateFormat?: DateFormatToken;
  watchTime?: string;
  theater?: string;
  screen?: string;
  seat?: string;
  actors?: string;
  rating: number;
  runtime?: string;
  bookingNumber?: string;
  /** KOBIS 영화 코드(8자리) — 바코드 fallback(movieCd+watchDate)에 사용(#379). */
  movieCd?: string;
  /** 유저 서명/닉네임 — 티켓에 공개로 표시되는 개인 사인(#148). */
  signature?: string;
  /** Criterion 전용 한줄평(#391) — 비어 있으면 평점 구간 프리셋 → 기본 quote로 폴백(MoodCriterion). */
  quote?: string;
}

export interface TicketComponents {
  layout: LayoutId;
  /** 극장 체인 로고 이미지 URL(blob: 또는 빈 문자열). 이미지가 라벨보다 우선한다. */
  chain: string;
  /** 상영 포맷 로고 이미지 URL(blob: 또는 빈 문자열). 이미지가 라벨보다 우선한다. */
  format: string;
  /** 체인 텍스트 라벨(예: "CGV") — 이미지 없을 때 텍스트 스탬프로 출력. OCR/수동으로 채움. */
  chainLabel: string;
  /** 포맷 텍스트 라벨(예: "IMAX") — 이미지 없을 때 텍스트 스탬프로 출력. OCR/수동으로 채움(#348). */
  formatLabel: string;
  texture: string;
  posterOpacity: number;
  /** 포스터를 뺀 모든 오버레이 콘텐츠(텍스트·바코드·스탬프·로고·장식)의 불투명도 0..1(기본 1=원본). posterOpacity와 독립(#219). */
  componentOpacity: number;
  themeColor: string;
  chainVisible: boolean;
  formatVisible: boolean;
  /** 포스터 원본 비율 보존 프리셋(#420) — 'contain'이면 무드가 letterbox+상단 정렬로 렌더한다. 기본 'cover'. */
  posterFit: 'cover' | 'contain';
}

export interface PhototicketState {
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  recommendedColors: string[];
  fieldVisibility: Record<TicketField, boolean>;
}

export interface KobisMovie {
  movieCd: string;
  movieNm: string;
  movieNmEn: string;
  openDt: string;
  genreAlt: string;
  nationAlt: string;
  prdtYear: string;
  actors?: string;
}
