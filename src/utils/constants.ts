/**
 * 프로젝트 전역 상수 정의
 */

// 무드 캔버스(#525 룰 2) — CGV 포토플레이 사양. 세로 무드 자연 해상도(#449)와 1:1 — 위/아래
// 블러 레터박스 프레임을 위한 여유를 포함한 값이라 1477(구 값)보다 57px 크다.
export const TARGET_WIDTH = 960;
export const TARGET_HEIGHT = 1534;

// 포스터 표준(#525 룰 1) — 세로 2:3. 캔버스 비율(0.626)과 **다른 축**이라 상수를 나눠 둔다.
// 예전엔 TARGET_RATIO 하나가 캔버스 비율과 크롭 비율을 겸해, 크롭이 캔버스에 맞춰 0.626으로
// 잘리고 있었다. 0.667 크롭이 0.626 풀블리드 캔버스에 들어가면 좌우 레터박스가 생기고, 그
// 여백은 blur 배경이 덮는다(룰 3). 삽입 프레임/도판/컬럼도 이 비율이다(룰 5).
export const POSTER_RATIO = 2 / 3; // 0.667:1
// 크롭 출력 해상도 — 캔버스 폭과 같은 960에 POSTER_RATIO를 곱해 1440. 풀블리드 무드가
// 960폭 슬롯에 contain으로 그리는 최대 크기(960×1440)와 일치해 확대도 축소도 안 생긴다.
export const POSTER_WIDTH = 960;
export const POSTER_HEIGHT = POSTER_WIDTH / POSTER_RATIO; // 1440

// 후가공 텍스처 — 재질 축 × 코팅 축 2축(#475). 재질(종이 자체 색·톤·결)과 코팅(위에 얹는 광택)은
// 동시에 조합 적용된다(components.material + components.coating).
export const MATERIAL_OPTIONS = [
  { value: 'original', label: '원본 (재질 가공 없음)' },
  { value: 'artpaper', label: '미술용지 (캔버스/수채화 질감)' },
  { value: 'vintage', label: '빈티지 (빛바랜 종이)' },
  { value: 'newspaper', label: '흑백 신문 (거친 망점/흑백)' },
] as const;

export const COATING_OPTIONS = [
  { value: 'none', label: '코팅 없음' },
  { value: 'gloss', label: '유광 (인화지 광택)' },
  { value: 'hologram', label: '홀로그램 (무지개빛 반사)' },
  { value: 'metal', label: '메탈릭 (차가운 금속 질감)' },
  { value: 'scodix', label: '스코딕스 (부분 코팅/엠보싱 효과)' },
] as const;
