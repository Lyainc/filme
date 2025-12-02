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
  { value: '메가박스', label: '메가박스', file: 'megabox.svg' },
  { value: '씨네Q', label: '씨네Q', file: 'cineq.svg' },
] as const;

// 상영 포맷 목록 (에셋 파일명과 일치)
export const SCREENING_FORMATS = [
  { value: '', label: '선택 안함', file: null },

  // 프리미엄 포맷
  { value: 'IMAX', label: 'IMAX', file: 'imax.svg' },
  { value: '4DX', label: '4DX', file: '4dx.svg' },
  { value: 'ULTRA 4DX', label: 'ULTRA 4DX', file: 'ultra4dx.webp' },
  { value: 'ScreenX', label: 'ScreenX', file: 'screenx.png' },
  { value: 'MX4D', label: 'MX4D', file: 'smx4d.png' },

  // Dolby 시리즈
  { value: 'DOLBY CINEMA', label: 'DOLBY CINEMA', file: 'dolby-cinema.png' },
  { value: 'DOLBY Atmos', label: 'DOLBY Atmos', file: 'dolby-atmos.png' },
  { value: 'DOLBY Vision+Atmos', label: 'DOLBY Vision+Atmos', file: 'dolby-va.png' },

  // LED/스크린 포맷
  { value: 'SUPER PLEX', label: 'SUPER PLEX', file: 'superplex.svg' },
  { value: 'SUPER LED', label: 'SUPER LED', file: 'superled.svg' },
  { value: 'MEGA LED', label: 'MEGA LED', file: 'megaled.png' },
  { value: 'SLED', label: 'SLED', file: 'sled.png' },

  // 사운드 포맷
  { value: 'CrazySound', label: 'CrazySound', file: 'crazysound.svg' },
  { value: 'CrazySound LED', label: 'CrazySound LED', file: 'crazysoundled.svg' },

  // 특별관
  { value: '샬롯데', label: '샬롯데', file: 'chalotte.png' },
  { value: '부티크', label: '부티크', file: 'boutique.png' },
  { value: '부티크 프라이빗', label: '부티크 프라이빗', file: 'boutiqueprivate.png' },
  { value: '부티크 스위트', label: '부티크 스위트', file: 'boutiquesuite.png' },
  { value: '르클라이너', label: '르클라이너', file: 'lerecliner.png' },
] as const;

// Canvas 디자인 레이아웃 (신규 디자인 시스템)
export const DESIGN_LAYOUT = {
  // 극장 체인 로고 (상단 좌측)
  chainLogo: {
    x: 40,
    y: 50,
    maxWidth: 140,
    maxHeight: 50,
  },

  // 상영 포맷 배지 (중단 좌측)
  formatBadge: {
    x: 40,
    y: 700,
    maxWidth: 120,
    maxHeight: 40,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },

  // 영화 제목 (하단)
  movieTitle: {
    x: 40,
    y: 1250,
    maxWidth: 880,
    fontSize: 56,
    fontWeight: 'bold',
    lineHeight: 1.2,
  },

  // 관람일 (하단)
  watchDate: {
    x: 40,
    y: 1350,
    fontSize: 28,
    fontWeight: '500',
  },

  // 극장 위치 (하단)
  theater: {
    x: 40,
    y: 1400,
    fontSize: 22,
    fontWeight: '400',
  },

  // 여백
  padding: {
    side: 40,
    top: 50,
    bottom: 50,
  },
} as const;

// 디자인 효과 (필터, 그림자 등)
export const DESIGN_EFFECTS = {
  // 그라디언트 오버레이 (상단 어둡게, 하단 약간 어둡게)
  gradients: {
    topDark: {
      type: 'linear',
      stops: [
        { offset: 0, color: 'rgba(0, 0, 0, 0.5)' },
        { offset: 0.3, color: 'rgba(0, 0, 0, 0)' },
        { offset: 0.7, color: 'rgba(0, 0, 0, 0)' },
        { offset: 1, color: 'rgba(0, 0, 0, 0.3)' },
      ],
    },
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
