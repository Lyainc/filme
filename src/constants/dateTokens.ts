import type { DateFormatToken, DateGranularity } from '@/types';

// 날짜 표기 토큰·정밀도(#141) — 필드 편집 본문(FieldEditorBody의 FormatChips·DateSheet)이
// watchDate/releaseDate 양쪽에 공유하는 단일 소스. 배열을 복붙하면 한쪽만 바뀌며 drift가
// 생기므로(#242 계열) 여기서만 정의한다. DateSheet의 표기 칩 sample은 관람일 예시 문자열이라
// 별개 — 값·순서만 같다.

// 기본값 kr-compact를 첫 번째로(#141 (12)). kr-compact 샘플은 끝점 포함 YYYY.MM.DD.(#141 (13)).
export const DATE_FORMAT_TOKENS: { value: DateFormatToken; sample: string }[] = [
  { value: 'kr-compact', sample: '2014.11.06.' },
  { value: 'iso', sample: '2014-11-06' },
  { value: 'cinema-mono', sample: '06·NOV·2014' },
  { value: 'en-long', sample: 'November 6, 2014' },
];

export const GRANULARITY_OPTIONS: { value: DateGranularity; label: string }[] = [
  { value: 'year', label: '연만' },
  { value: 'year-month', label: '연·월' },
  { value: 'date', label: '연·월·일' },
];
