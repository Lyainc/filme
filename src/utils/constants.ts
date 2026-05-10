/**
 * 프로젝트 전역 상수 정의
 */

// CGV 포토플레이 사양
export const TARGET_WIDTH = 960;
export const TARGET_HEIGHT = 1477;
export const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT; // 0.65:1

// 이미지 품질 설정
export const JPEG_QUALITY = 0.95;

// 극장 체인 목록 (에셋 파일명과 일치)
export const THEATER_CHAINS = [
  { value: '', label: '선택 안함', file: null },
  { value: 'CGV', label: 'CGV', file: 'cgv.png' },
  { value: '롯데시네마', label: '롯데시네마', file: 'lotte.png' },
  { value: '메가박스', label: '메가박스', file: 'megabox.png' },
  { value: '씨네Q', label: '씨네Q', file: 'cineq.png' },
] as const;

// 상영 포맷 목록 (에셋 파일명과 일치)
export const SCREENING_FORMATS = [
  { value: '', label: '선택 안함', file: null },

  // 프리미엄 포맷
  { value: 'IMAX', label: 'IMAX', file: 'imax.png' },
  { value: '4DX', label: '4DX', file: '4dx.png' },
  { value: 'ULTRA 4DX', label: 'ULTRA 4DX', file: 'ultra4dx.png' },
  { value: 'ScreenX', label: 'ScreenX', file: 'screenx.png' },
  { value: 'MX4D', label: 'MX4D', file: 'smx4d.png' },

  // Dolby 시리즈
  { value: 'DOLBY CINEMA', label: 'DOLBY CINEMA', file: 'dolby-cinema.png' },
  { value: 'DOLBY Atmos', label: 'DOLBY Atmos', file: 'dolby-atmos.png' },
  { value: 'DOLBY Vision+Atmos', label: 'DOLBY Vision+Atmos', file: 'dolby-va.png' },

  // LED/스크린 포맷
  { value: 'SUPER PLEX', label: 'SUPER PLEX', file: 'superplex.png' },
  { value: 'SUPER LED', label: 'SUPER LED', file: 'superled.png' },
  { value: 'MEGA LED', label: 'MEGA LED', file: 'megaled.png' },
  { value: 'SLED', label: 'SLED', file: 'sled.png' },

  // 사운드 포맷
  { value: 'CrazySound', label: 'CrazySound', file: 'crazysound.png' },
  { value: 'CrazySound LED', label: 'CrazySound LED', file: 'crazysoundled.png' },

  // 특별관
  { value: '샬롯데', label: '샬롯데', file: 'chalotte.png' },
  { value: '부티크', label: '부티크', file: 'boutique.png' },
  { value: '부티크 프라이빗', label: '부티크 프라이빗', file: 'boutiqueprivate.png' },
  { value: '부티크 스위트', label: '부티크 스위트', file: 'boutiquesuite.png' },
  { value: '르클라이너', label: '르클라이너', file: 'lerecliner.png' },
] as const;

// 후가공 텍스처(특수 용지) 옵션
export const TEXTURE_OPTIONS = [
  { value: 'original', label: '무가공 (원본 이미지 그대로)' },
  { value: 'none', label: '일반 인화지 (유광)' },
  { value: 'hologram', label: '홀로그램 (무지개빛 반사)' },
  { value: 'metal', label: '메탈릭 (차가운 금속 질감)' },
  { value: 'artpaper', label: '미술용지 (캔버스/수채화 질감)' },
  { value: 'vintage', label: '빈티지 (빛바랜 종이)' },
  { value: 'newspaper', label: '흑백 신문 (거친 망점/흑백)' },
  { value: 'scodix', label: '스코딕스 (부분 코팅/엠보싱 효과)' },
] as const;

// Canvas 디자인 레이아웃 (프리미엄 모던 티켓 디자인 시스템 - 실물 출력 사이즈 최적화)
export const DESIGN_LAYOUT = {
  // TCG 스타일 이너 프레임 (테두리)
  border: {
    margin: 40, // 캔버스 끝에서 들어가는 정도
    thickness: 4,
    radius: 16,
  },

  // === HEADER AREA (영화관 정보) ===
  // 극장 체인 로고 (상단 좌측)
  chainLogo: {
    x: 60,
    y: 70,
    maxWidth: 160,
    maxHeight: 40,
  },
  
  // 극장 메타데이터 (상단 우측 - 관람일, 극장명, 상영관, 좌석)
  headerMetadata: {
    x: 900, // right aligned
    y: 78,
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: 1.5,
    opacity: 0.9,
  },

  // === FOOTER AREA (영화 정보) ===
  // 원어 제목
  movieTitleOg: {
    x: 60,
    y: 1130,
    maxWidth: 660,
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: 2,
    opacity: 0.8,
  },

  // 메인 영화 제목
  movieTitle: {
    x: 60,
    y: 1170,
    maxWidth: 660,
    fontSize: 58,
    fontWeight: '800',
    lineHeight: 1.15,
  },

  // 별점
  rating: {
    x: 60,
    y: 1290,
    size: 26,
    gap: 8,
  },

  // 주연 배우
  actors: {
    x: 60,
    y: 1340,
    maxWidth: 840,
    fontSize: 22,
    fontWeight: '400',
    opacity: 0.8,
  },

  // 개봉일 (Footer 좌측 하단)
  releaseDate: {
    x: 60,
    y: 1390,
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 1,
    opacity: 0.8,
  },

  // 상영 포맷 배지 (하단 우측)
  formatBadge: {
    x: 900, // right edge
    y: 1375,
    badgeWidth: 160,
    badgeHeight: 46,
    padding: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },

  // 구분선 (사용 안 할 수도 있지만 옵션으로 남겨둠)
  divider: {
    x: 60,
    y: 1260,
    width: 840,
    thickness: 2,
    opacity: 0.2,
  },

  // 여백
  padding: {
    side: 60,
    top: 70,
    bottom: 70,
  },
} as const;

// 디자인 효과 (필터, 그림자 등)
export const DESIGN_EFFECTS = {
  // 포스터 영역(상단 80%)에 대한 그라디언트
  gradients: {
    topDark: {
      type: 'linear',
      stops: [
        { offset: 0, color: 'rgba(0, 0, 0, 0.6)' },
        { offset: 0.2, color: 'rgba(0, 0, 0, 0)' },
        { offset: 0.8, color: 'rgba(0, 0, 0, 0)' },
        { offset: 1, color: 'rgba(0, 0, 0, 0.4)' },
      ],
    },
    topLight: {
      type: 'linear',
      stops: [
        { offset: 0, color: 'rgba(255, 255, 255, 0.5)' },
        { offset: 0.2, color: 'rgba(255, 255, 255, 0)' },
        { offset: 0.8, color: 'rgba(255, 255, 255, 0)' },
        { offset: 1, color: 'rgba(255, 255, 255, 0.3)' },
      ]
    }
  },

  // 텍스트 그림자 (시인성 확보)
  textShadow: {
    offsetX: 2,
    offsetY: 2,
    blur: 4,
    color: 'rgba(0, 0, 0, 0.8)',
  },

  // 색상
  colors: {
    textPrimary: '#FFFFFF',
    textSecondary: '#EEEEEE',
    textTertiary: '#CCCCCC',
    badgeBackground: 'rgba(255, 255, 255, 0.9)',
    badgeText: '#000000',
  },
} as const;
