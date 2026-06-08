/**
 * 프로젝트 전역 상수 정의
 */

// CGV 포토플레이 사양
export const TARGET_WIDTH = 960;
export const TARGET_HEIGHT = 1477;
export const TARGET_RATIO = TARGET_WIDTH / TARGET_HEIGHT; // 0.65:1

// Picker 데이터는 자산 폴더에서 자동 파생.
// 파일명 규약: `<value>_<label>.png` — value=영문 식별자, label=표기명(_ 뒤 문자열).
// 자산 추가/삭제만 하면 generator(`bun run gen:assets`)가 picker를 동기화한다.
import { CHAIN_ASSETS, FORMAT_ASSETS, type AssetEntry } from './assets.generated';

export type PickerOption =
  | AssetEntry
  | { readonly value: ''; readonly label: '선택 안함'; readonly file: null };

const NONE = { value: '', label: '선택 안함', file: null } as const;

export const THEATER_CHAINS: readonly PickerOption[] = [NONE, ...CHAIN_ASSETS];

export const SCREENING_FORMATS: readonly PickerOption[] = [NONE, ...FORMAT_ASSETS];

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
