/**
 * 포토티켓 데이터 타입 정의
 */

// 영화 정보
export interface MovieInfo {
  title: string;
  watchDate: string; // YYYY. MM. DD.
  theater: string;
  screen?: string; // 예: 4관, IMAX관
  seat?: string;   // 예: G14, G15
  rating: number;  // 별점 (0~5)
}

// 컴포넌트 선택
export interface TicketComponents {
  chain: string;
  format: string;
  texture: string; // 특수 후가공 텍스처 (홀로그램, 메탈 등)
  posterOpacity: number; // 포스터 불투명도 (0~1)
  themeColor: string;    // 테마 색상 (글씨, 로고 등)
}

// 전체 포토티켓 상태
export interface PhototicketState {
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
  recommendedColors: string[]; // K-means 추천 색상
}

// Canvas 디자인 설정 타입
export interface DesignLayout {
  chainLogo: { x: number; y: number; maxWidth: number; maxHeight: number };
  formatBadge: {
    x: number;
    y: number;
    badgeWidth: number;
    badgeHeight: number;
    padding: number;
    borderRadius: number;
    backgroundColor: string;
  };
  movieTitle: { x: number; y: number; maxWidth: number; fontSize: number; fontWeight: string; lineHeight: number };
  watchDate: { x: number; y: number; fontSize: number; fontWeight: string };
  theater: { x: number; y: number; fontSize: number; fontWeight: string };
  padding: { side: number; top: number; bottom: number };
}

// KOBIS API 영화 검색 결과 항목
export interface KobisMovie {
  movieCd: string;        // 영화 코드
  movieNm: string;        // 한글 제목
  movieNmEn: string;      // 영문 제목
  openDt: string;         // 개봉일 (YYYYMMDD)
  genreAlt: string;       // 장르 (SF,드라마,모험)
  nationAlt: string;      // 국가
  prdtYear: string;       // 제작년도
}

// Window 타입 확장 (Canvas 노출 제거 예정 - forwardRef 사용)
declare global {
  interface Window {
    phototicketCanvas?: HTMLCanvasElement;
  }
}

export {};
