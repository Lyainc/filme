import type { EmbossStamp } from '@/utils/textureRecipes';

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

/**
 * Criterion 한줄평의 폰트 선택(#558) — 'auto'는 기존 containsHangul 자동분기(한글=손글씨 /
 * 라틴=세리프 이탤릭) 그대로다. 나머지 셋은 이미 `_app.tsx`가 로드하는 폰트에 1:1 대응하고
 * 새 폰트 파일은 추가하지 않는다: hand=FONT_QUOTE_KR(아이스자람체) · gothic=FONT_KR(Pretendard) ·
 * serif=FONT_DISPLAY(Instrument Serif). 기본값이 'auto'라 기존 저장본의 렌더는 안 변한다.
 */
export type QuoteFont = 'auto' | 'hand' | 'gothic' | 'serif';

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
  /** 재질 축(종이 자체 색·톤·결) — 'original'|'artpaper'|'vintage'|'newspaper'(#475). 코팅과 독립 조합. */
  material: string;
  /** 코팅 축(재질 최종색 위에 얹는 광택) — 'none'|'gloss'|'hologram'|'metal'|'scodix'(#475). */
  coating: string;
  /** 재질 결 오버레이 강도 0..1(기본은 material별 defaultIntensity). 0=그 축 완전 무가공. posterOpacity(밝기)와 독립 축이다(#434/#475). */
  materialIntensity: number;
  /** 코팅 광택 오버레이 강도 0..1(기본은 coating별 defaultIntensity). 0=그 축 완전 무가공. materialIntensity와 독립(#475). */
  coatingIntensity: number;
  posterOpacity: number;
  /** 포스터를 뺀 모든 오버레이 콘텐츠(텍스트·바코드·스탬프·로고·장식)의 불투명도 0..1(기본 1=원본). posterOpacity와 독립(#219). */
  componentOpacity: number;
  themeColor: string;
  chainVisible: boolean;
  formatVisible: boolean;
  /** 체인 로고 렌더 크기 배율 0.6~1.3(기본 1) — 무드별 고정 size 상수와 곱연산 결합(#441). */
  chainScale: number;
  /** 포맷 로고 렌더 크기 배율 0.6~1.3(기본 1) — 무드별 고정 size 상수와 곱연산 결합(#441). */
  formatScale: number;
  /**
   * 포스터를 슬롯에 앉히는 방식(#527) — 기본(미설정)은 무손실 contain. 'cover'는 슬롯을 꽉 채우고
   * 넘치는 축을 잘라낸다. 크롭 비율(항상 포스터 표준 0.667/1.5)과는 **다른 축**이라 크롭 모달이
   * 아니라 DESIGN 탭 '크기' 섹션이 정한다 — 크롭 토글이 이 둘을 겸하던 게 #525가 걷어낸 문제다.
   * 실제로 값이 갈리는 무드는 POSTER_FILL_MOODS(constants/fields.ts)뿐.
   */
  posterFit?: 'contain' | 'cover';
  /**
   * Criterion 한줄평 폰트(#558) — 미설정은 'auto'로 읽는다(마이그레이션 없음). 서명은 이 값을
   * 따르지 않고 항상 자동분기다: 폰트를 연 축이 quote 하나뿐이라 서명까지 끌고 가면 사용자가
   * 안 만진 요소가 같이 바뀐다(서명 축은 #437에 남는다).
   */
  quoteFont?: QuoteFont;
  /** 서명 이미지 URL(blob: 또는 빈 문자열). 이미지가 텍스트 서명(MovieInfo.signature)보다 우선한다(#484). */
  signatureImage?: string;
  /** 서명 이미지 렌더 크기 배율 0.6~1.3(기본 1) — 무드별 고정 height와 곱연산 결합(#484). */
  signatureScale?: number;
}

export interface PhototicketState {
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  recommendedColors: string[];
  fieldVisibility: Record<TicketField, boolean>;
  /**
   * 형압(#509) 마스크 — croppedImageUrl과 나란한 세션 한정 필드다(c8). `components` 안에 두지
   * 않는 이유: `components`는 undo 스냅샷(HistorySnapshot)·자동저장(PersistedState)에 통째로
   * 실리는데, 마스크는 포스터 교체·재크롭 시 폐기되고 autosave·공유 블롭에 안 실려야 한다 —
   * croppedImageUrl이 이미 같은 이유로 `components` 밖에 사는 선례를 따른다.
   */
  embossStamps: EmbossStamp[];
  /** 형압 강도 0..1(#509) — 마스크가 없으면 의미 없으나, 마스크와 함께 폐기되는 세션 값이라 같이 둔다. */
  embossIntensity: number;
}

export interface KobisMovie {
  movieCd: string;
  movieNm: string;
  movieNmEn: string;
  openDt: string;
  genreAlt: string;
  nationAlt: string;
  prdtYear: string;
  // 아래 3종은 실측상 항상 오지만 옵셔널이다 — KOBIS 응답은 런타임 검증 없이 캐스팅만 거치므로
  // (useKobisSearch.ts) 타입이 계약보다 낙관적이면 이걸 믿고 무가드로 읽는 코드가 새로 생겨
  // 크래시가 재발한다. 소비부는 이미 폴백을 들고 있다(PR #478 리뷰 P2).
  /** 장편/단편/옴니버스 구분(#476 — 동명 제목 판별용). */
  typeNm?: string;
  /** 개봉/개봉예정/기타 등 제작 상태(#476). */
  prdtStatNm?: string;
  /** 감독 목록 — 다큐·옴니버스 등은 빈 배열로 온다(#476). */
  directors?: { peopleNm: string }[];
  actors?: string;
}
