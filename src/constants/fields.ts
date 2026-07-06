import type { TicketField, MovieInfo } from '@/types';

/**
 * 필드 메타데이터 단일 소스(#215). 라벨은 인라인 폼(EditorCanvas)·런처(FieldLauncher)·
 * 편집 시트(FieldEditSheet) 셋이 공유하므로 여기 한 곳에 둔다(이전엔 EditorCanvas 로컬).
 */
export const FIELD_LABELS: Record<TicketField, string> = {
  title: '제목',
  titleOg: '원제',
  actors: '출연',
  watchDate: '관람일',
  watchTime: '관람 시간',
  theater: '극장',
  screen: '상영관',
  seat: '좌석',
  runtime: '러닝타임',
  rating: '평점',
  releaseDate: '개봉일',
  reissue: '재개봉',
  bookingNo: '예매 번호',
  signature: '서명',
};

/** 필드별 편집 시트 타입(#215 PART A). reissue/chain/format은 PART A 런처 행이 아니라 여기 없음. */
export type FieldSheetType = 'text' | 'date' | 'rating';

export const FIELD_SHEET_TYPE: Partial<Record<TicketField, FieldSheetType>> = {
  title: 'text',
  titleOg: 'text',
  actors: 'text',
  watchTime: 'text',
  theater: 'text',
  screen: 'text',
  seat: 'text',
  runtime: 'text',
  bookingNo: 'text',
  signature: 'text',
  watchDate: 'date',
  releaseDate: 'date',
  rating: 'rating',
};

/** 필드 → MovieInfo 키. bookingNo만 bookingNumber로 어긋나고 나머지는 동명. rating은 number라 별도. */
export const FIELD_INFO_KEY: Partial<Record<TicketField, keyof MovieInfo>> = {
  title: 'title',
  titleOg: 'titleOg',
  actors: 'actors',
  watchTime: 'watchTime',
  theater: 'theater',
  screen: 'screen',
  seat: 'seat',
  runtime: 'runtime',
  bookingNo: 'bookingNumber',
  signature: 'signature',
  watchDate: 'watchDate',
  releaseDate: 'releaseDate',
};

/** 입력 플레이스홀더 — 인라인 폼의 것을 그대로 계승. */
export const FIELD_PLACEHOLDERS: Partial<Record<TicketField, string>> = {
  title: '인터스텔라',
  titleOg: 'Interstellar',
  actors: '매튜 맥커너히, 앤 해서웨이',
  theater: 'CGV 용산아이파크몰',
  screen: 'IMAX관',
  seat: 'G14, G15',
  runtime: '150 MIN',
  bookingNo: 'T-20260510-0014',
  signature: '@minji · 티켓에 공개돼요',
};

/**
 * 런처 행 그룹(#215) — 현재 폼 구조(Film / Optional)를 반영. reissue는 releaseDate 시트 안에서,
 * chain/format 로고는 PART B에서 다룬다(여기 없음).
 */
export const LAUNCHER_GROUPS: { title: string; fields: TicketField[] }[] = [
  { title: 'Film', fields: ['title', 'titleOg', 'releaseDate', 'actors', 'rating'] },
  {
    title: 'Optional',
    fields: ['watchDate', 'watchTime', 'theater', 'screen', 'seat', 'runtime', 'bookingNo', 'signature'],
  },
];
