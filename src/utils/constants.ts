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

// Canvas 레이아웃 설정
export const CANVAS_LAYOUT = {
  // 하단 오버레이
  overlayHeight: 200,
  overlayOpacity: 0.6,

  // 텍스트 위치
  padding: 40,
  chainY: 70,
  formatY: 120,
  titleY: TARGET_HEIGHT - 140,
  dateY: TARGET_HEIGHT - 90,
  theaterY: TARGET_HEIGHT - 45,

  // 폰트 설정
  fonts: {
    chainSize: 32,
    formatSize: 24,
    titleSize: 48,
    dateSize: 24,
    theaterSize: 20,
  },

  // 색상
  colors: {
    chain: '#ff0000',
    format: '#ffffff',
    title: '#ffffff',
    date: '#ffffff',
    theater: '#cccccc',
    overlay: 'rgba(0, 0, 0, 0.6)',
    formatBg: 'rgba(0, 0, 0, 0.7)',
  },
} as const;
