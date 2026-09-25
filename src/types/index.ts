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
 * 한줄평·서명의 폰트 선택(#558 4택 → #437 9택). 'auto'는 기존 containsHangul 자동분기
 * (한글=아이스자람체 / 라틴=Instrument Serif 이탤릭) 그대로고, 나머지 8종은 눈누에서
 * 상업이용·웹폰트 임베딩이 허용된 것만 골랐다(출처·조항은 `public/fonts/LICENSES.md`).
 * 값 → 폰트 매핑은 `_shared.tsx`의 `userTextFont`가 단일 소스다.
 *
 * **#558의 'serif'(Instrument Serif)는 이 유니온에서 빠졌다.** 지우는 게 픽셀 중립이라서다 —
 * 라틴에서 'serif'가 주던 건 auto가 주는 것과 같은 FONT_DISPLAY 이탤릭이었고, 한글에선 이미
 * auto로 되돌려지고 있었다. 그래서 저장돼 있던 'serif'는 switch의 default(=auto)로 떨어져
 * **예전과 똑같이 렌더된다** — 마이그레이션 코드가 필요 없는 이유고, 덤으로 "세리프는 한글
 * 글리프가 없어 잠금" UI가 통째로 사라졌다(한글 되는 세리프는 이제 'batang'이다).
 */
export type QuoteFont =
  | 'auto'
  | 'gothic'
  | 'batang'
  | 'hand'
  | 'ink'
  | 'eunyoung'
  | 'brush'
  | 'coolguy'
  | 'flower';

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
   * Criterion 한줄평 폰트(#558) — 미설정은 'auto'로 읽는다(마이그레이션 없음). signatureFont와
   * 값을 공유하지 않는다 — 노출 무드 집합 자체가 다르고(quote는 Criterion 1개, signature는
   * 6무드 전부), 사용자가 한줄평·서명에 서로 다른 폰트를 고르는 조합을 정상 범위로 본다
   * (#437, docs/specs/quote-signature-font-selection.md §3).
   */
  quoteFont?: QuoteFont;
  /**
   * 서명 폰트(#437) — 미설정은 'auto'로 읽는다(마이그레이션 없음). quoteFont와 독립.
   * `userTextFont(text, font)`가 quote와 signature 공용 진입점이라 값 해석 규칙은 동일하다.
   */
  signatureFont?: QuoteFont;
  /** 서명 이미지 URL(blob: 또는 빈 문자열). 이미지가 텍스트 서명(MovieInfo.signature)보다 우선한다(#484). */
  signatureImage?: string;
  /** 서명 이미지 렌더 크기 배율 0.6~1.3(기본 1) — 무드별 고정 height와 곱연산 결합(#484). */
  signatureScale?: number;
  /**
   * 티켓 배경 이미지 URL(#671) — Editorial·Criterion·Stub 공통 축이고, **이 필드 하나가 축
   * 전체다**(#672가 프리셋 id 필드 `backgroundPattern`을 걷어냈다 — 'none'/'custom' 2택이 이
   * 필드의 유무와 정보가 완전히 겹쳤다). 비면 배경 레이어를 아예 안 그린다.
   *
   * 로고 스탬프와 같은 useLogoCrop 자유비 크롭 산출물(blob:)이라 blob 수명도 로고와 같은 규칙을
   * 탄다: saveDraft가 blob:을 비우고 대신 IndexedDB에 Blob으로 실어(#672) 새로고침에 왕복
   * 복원하며, clearDraft·언마운트가 revoke한다(usePhototicket).
   */
  backgroundPatternImage?: string;
  /**
   * 배경 이미지 표시 배율 1.0~1.5(#680) — 미설정은 1.0으로 읽는다(마이그레이션 없음). 1.0이 곧
   * 지금까지의 캔버스 전면 cover라 기존 저장본의 렌더는 안 변한다.
   *
   * 상한이 로고(1.3)와 다른 건 취향이 아니라 해상도다: 배경은 maxSide = TARGET_HEIGHT(1534)로 굽는데
   * 저장물은 pixelRatio 2라 배율 1.0에서 이미 약 2배 업스케일이고, 2.0이면 4배가 돼 눈에 띄게
   * 뭉갠다. 1.5는 굽는 해상도를 안 올리고 버티는 선이다 — 더 키우려면 useLogoCrop의 maxSide부터
   * 올려야 하고 그러면 blob 용량(#673이 지목한 제일 큰 payload)이 같이 커진다.
   */
  backgroundPatternScale?: number;
  /**
   * 스탬프(구 배경) 투명도 0.2~1.0(#728) — 미설정은 1.0으로 읽는다(마이그레이션 없음,
   * `backgroundPatternScale`의 `?? 1`과 같은 관용구). 기존 저장본은 이 필드가 없어 렌더가
   * 안 바뀌고, "새로 올린 것만 반투명"은 여기서 분기하지 않는다 — `BackgroundPatternPanel`의
   * `useLogoCrop` 완료 콜백이 이미지와 이 값을 한 번에 write-time으로 커밋한다(undo 원자성).
   */
  backgroundPatternOpacity?: number;
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
