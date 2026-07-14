import type { TicketField, MovieInfo, TicketComponents, LayoutId } from '@/types';
import { formatDate } from '@/utils/dateFormat';

/**
 * 필드 메타데이터 단일 소스(#215). 라벨은 필드 드로어(FieldDrawer)·데스크톱 아코디언
 * (FieldAccordion)·인플레이스 에디터가 공유하므로 여기 한 곳에 둔다.
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
  // Criterion(#281 재동기화 완료): 마스터 v2 하단 필름 셀은 RATED·RUNTIME·RELEASED·RE-RELEASED라
  // RUNTIME 셀을 렌더하므로 runtime은 제외 아님. watchTime은 마스터에 독립 TIME 셀이 없어(WATCHED 값에만
  // 병합) 편집 타깃이 없으므로 제외 유지.
  criterion: ['watchTime'],
  '35mm': ['bookingNo'], // #281: 마스터 35mm는 푸터 바코드 없음 → bookingNo 미렌더(MADE WITH FILME·서명 푸터는 유지).
  '35mm-landscape': ['bookingNo'], // #281: 마스터 35mm Wide는 바코드 없음 → bookingNo 미렌더(collected by·ACCESSION 아카이브 카드는 유지).
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

/**
 * 스탬프 텍스트 라벨 길이 상한 — 수동 입력(StampSheet input)과 OCR 자동 주입(OcrUploadCard)이
 * 공유한다. TextStamp(_shared.tsx)는 `whiteSpace: nowrap`에 폭 축소 로직이 없어서, 긴 라벨이
 * 들어오면 스탬프가 티켓 레이아웃을 밀어낸다. chain은 enum→고정 라벨이라 안전하지만 format은
 * 자유 문자열이라(#348) 모델이 프롬프트를 벗어나 상영관 줄을 통째로 뱉을 여지가 있다 —
 * 두 입구 모두 여기서 막는다(PR #351 리뷰 P1).
 */
export const STAMP_LABEL_MAX = 24;

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
