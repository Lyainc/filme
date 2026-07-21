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
  /** 후가공 sheen 오버레이 강도 0..1(기본은 texture별 defaultIntensity). 0=완전 무가공. posterOpacity(밝기)와 독립 축이다(#434). */
  textureIntensity: number;
  posterOpacity: number;
  /** 포스터를 뺀 모든 오버레이 콘텐츠(텍스트·바코드·스탬프·로고·장식)의 불투명도 0..1(기본 1=원본). posterOpacity와 독립(#219). */
  componentOpacity: number;
  themeColor: string;
  chainVisible: boolean;
  formatVisible: boolean;
  /** 포스터 fit(#420 → #440 정책 통일) — 기본 'contain'(무손실·좌우 보존, 남는 공간은 무드 배경색 letterbox). 'cover'는 크롭 토글 opt-in(슬롯 꽉 채움). 전 무드가 posterFitProps로 읽는다. */
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
  /** 장편/단편/옴니버스 구분(#476 — 동명 제목 판별용). */
  typeNm: string;
  /** 개봉/개봉예정/기타 등 제작 상태(#476). */
  prdtStatNm: string;
  /** 감독 목록 — 다큐·옴니버스 등은 빈 배열로 온다(#476). */
  directors: { peopleNm: string }[];
  actors?: string;
}
