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
}

// 컴포넌트 선택
export interface TicketComponents {
  chain: string;
  format: string;
  texture: string; // 특수 후가공 텍스처 (홀로그램, 메탈 등)
}

// 전체 포토티켓 상태
export interface PhototicketState {
  croppedImageUrl: string | null;
  movieInfo: MovieInfo;
  components: TicketComponents;
}

// Canvas 디자인 설정 타입
export interface DesignLayout {
  chainLogo: { x: number; y: number; maxWidth: number; maxHeight: number };
  formatBadge: {
    x: number;
    y: number;
    maxWidth: number;
    maxHeight: number;
    padding: number;
    borderRadius: number;
    backgroundColor: string;
  };
  movieTitle: { x: number; y: number; maxWidth: number; fontSize: number; fontWeight: string; lineHeight: number };
  watchDate: { x: number; y: number; fontSize: number; fontWeight: string };
  theater: { x: number; y: number; fontSize: number; fontWeight: string };
  padding: { side: number; top: number; bottom: number };
}

// Window 타입 확장 (Canvas 노출 제거 예정 - forwardRef 사용)
declare global {
  interface Window {
    phototicketCanvas?: HTMLCanvasElement;
  }
}

export {};
