/**
 * 프로젝트 전역 상수 정의
 */

// CGV 포토플레이 사양. 세로 무드 자연 해상도(#449)와 1:1 — 위/아래 블러 레터박스
// 프레임을 위한 여유를 포함한 값이라 1477(구 값)보다 57px 크다.
export const TARGET_WIDTH = 960;
export const TARGET_HEIGHT = 1534;
export const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT; // 0.626:1

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
