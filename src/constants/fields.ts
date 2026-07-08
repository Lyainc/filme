import type { TicketField, MovieInfo, TicketComponents, LayoutId } from '@/types';
import { formatDate } from '@/utils/dateFormat';

/**
 * 필드 메타데이터 단일 소스(#215). 라벨은 편집 시트(FieldEditSheet)·데스크톱 아코디언
 * (FieldAccordion)이 공유하므로 여기 한 곳에 둔다.
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

/**
 * 무드별 미적용(런처에서 숨길) 필드(#287, 에픽 #281). 마스터 규격상 그 무드가 렌더하지 않는 필드만
 * 등록해 데스크톱 런처(FieldAccordion)의 죽은 컨트롤을 없앤다. 기본은 전 필드 적용(등록 없음 = 제외 없음).
 * 무드 재동기화 슬라이스가 진행되며 렌더에서 빠지는 필드를 여기 등록한다(예: 35mm·35mm Wide도 곧 바코드 제거).
 * 모바일은 온-티켓 FieldTap이라 렌더 안 하는 필드는 탭 타깃 자체가 없어 구조상 이미 layout-aware — 여긴 데스크톱용.
 */
export const MOOD_EXCLUDED_FIELDS: Partial<Record<LayoutId, readonly TicketField[]>> = {
  minimal: ['bookingNo'], // #286: 마스터 Minimal은 푸터 바코드 없음 → bookingNo 미렌더.
  criterion: ['watchTime', 'runtime'], // Criterion 메타는 WATCHED(날짜)·RATED·RELEASED만 — watchTime·runtime 미렌더.
};

/** 현재 layout에 적용되는 런처 그룹 — MOOD_EXCLUDED_FIELDS의 필드를 걸러내고, 비게 된 그룹은 제거. */
export function launcherGroupsFor(layout: LayoutId): { title: string; fields: TicketField[] }[] {
  const excluded = MOOD_EXCLUDED_FIELDS[layout];
  if (!excluded?.length) return LAUNCHER_GROUPS;
  const drop = new Set<TicketField>(excluded);
  return LAUNCHER_GROUPS.map((g) => ({ ...g, fields: g.fields.filter((f) => !drop.has(f)) })).filter(
    (g) => g.fields.length > 0
  );
}

/**
 * 스탬프 타깃(#215 PART B) — 극장/포맷 로고. TicketField가 아니라 TicketComponents에 산다
 * (chain/chainLabel/chainVisible · format/formatLabel/formatVisible). '이미지가 라벨보다
 * 우선'하는 렌더 규칙은 _shared.tsx에 이미 있다.
 */
export type StampTarget = 'chain' | 'format';

/** 편집 시트/런처가 받는 타깃 — MovieInfo 필드(TicketField) 또는 스탬프(chain/format). */
export type SheetTarget = TicketField | StampTarget;

export const STAMP_TARGETS: StampTarget[] = ['chain', 'format'];

export function isStampTarget(t: SheetTarget): t is StampTarget {
  return t === 'chain' || t === 'format';
}

/**
 * 스탬프 라벨(런처 행 + 시트 헤더 공용). theater 필드('극장')와 접근명이 겹치지 않도록 '로고'를 붙인다
 * — theater(상영관 텍스트)와 chain(극장 로고)은 별개 개념.
 */
export const STAMP_LABELS: Record<StampTarget, string> = {
  chain: '극장 로고',
  format: '포맷 로고',
};

/** 스탬프 → TicketComponents 키(이미지 URL · 텍스트 라벨 · 노출 토글). */
export const STAMP_KEYS: Record<
  StampTarget,
  {
    image: keyof TicketComponents;
    label: keyof TicketComponents;
    visible: keyof TicketComponents;
  }
> = {
  chain: { image: 'chain', label: 'chainLabel', visible: 'chainVisible' },
  format: { image: 'format', label: 'formatLabel', visible: 'formatVisible' },
};

export const STAMP_PLACEHOLDERS: Record<StampTarget, string> = {
  chain: 'CGV',
  format: 'IMAX',
};

/** 상영 포맷 빠른 프리셋(#141) — StampSheet(#215 PART B) 포맷 자동완성·칩의 단일 소스. */
export const FORMAT_PRESETS = ['IMAX', '4DX', 'Dolby', 'ScreenX'];

/**
 * 필드 현재값 미리보기 문자열. 비어 있으면 '' 반환(호출부가 placeholder로 대체).
 * 데스크톱 아코디언(FieldAccordion)·모바일 온-티켓 탭이 공유 — 컴포넌트에서 분리해
 * 상수 모듈로 이전(#266 PR-A).
 */
export function fieldPreview(field: TicketField, info: MovieInfo): string {
  if (field === 'rating') return `${(info.rating ?? 0).toFixed(1)} / 5.0`;
  if (field === 'watchDate') return formatDate(info.watchDate, info.watchDateFormat || 'kr-compact', 'date');
  if (field === 'releaseDate') {
    return formatDate(info.releaseDate, info.releaseDateFormat || 'kr-compact', info.releaseDateGranularity || 'date');
  }
  const key = FIELD_INFO_KEY[field];
  return key ? String(info[key] ?? '') : '';
}

/** 스탬프 현재값 미리보기 — 이미지가 있으면 '이미지'(라벨 우선), 없으면 텍스트 라벨. */
export function stampPreview(target: StampTarget, components: TicketComponents): string {
  const keys = STAMP_KEYS[target];
  if (components[keys.image]) return '이미지';
  return String(components[keys.label] ?? '');
}
