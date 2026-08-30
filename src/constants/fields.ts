import type { TicketField, MovieInfo, TicketComponents, LayoutId } from '@/types';
import { formatDate } from '@/utils/dateFormat';

/**
 * 필드 메타데이터 단일 소스(#215). 라벨은 필드 드로어(FieldDrawer)·데스크톱 아코디언
 * 인플레이스 에디터·필드 드로어가 공유하므로 여기 한 곳에 둔다.
 *
 * 필드 말고 **무드 능력 표**도 여기 산다(TONE_FIXED_MOODS · POSTER_FILL_MOODS · MOOD_EXCLUDED_FIELDS)
 * — 셸마다 layout id 리터럴을 반복하면 한쪽만 고쳐져 죽은 컨트롤이 남기 때문. 네 번째 표가 생기면
 * 그때 moodCapabilities로 한꺼번에 분리할 것.
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
  quote: '한줄평',
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
  quote: 'text',
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
  quote: 'quote',
  watchDate: 'watchDate',
  releaseDate: 'releaseDate',
};

/**
 * 런처 행 그룹(#215) — 현재 폼 구조(Film / Optional)를 반영. reissue는 releaseDate 시트 안에서,
 * chain/format 로고는 PART B에서 다룬다(여기 없음).
 */
export const LAUNCHER_GROUPS: { title: string; fields: TicketField[] }[] = [
  { title: 'Film', fields: ['title', 'titleOg', 'releaseDate', 'actors', 'rating', 'quote'] },
  {
    title: 'Optional',
    fields: ['watchDate', 'watchTime', 'theater', 'screen', 'seat', 'runtime', 'bookingNo', 'signature'],
  },
];

/**
 * 무드별 미적용(런처에서 숨길) 필드(#287, 에픽 #281). 마스터 규격상 그 무드가 렌더하지 않는 필드만
 * 등록해 런처의 죽은 컨트롤을 없앤다. 기본은 전 필드 적용(등록 없음 = 제외 없음).
 * 무드 재동기화 슬라이스가 진행되며 렌더에서 빠지는 필드를 여기 등록한다(예: 35mm·35mm Wide도 곧 바코드 제거).
 * 모바일은 온-티켓 FieldTap이라 렌더 안 하는 필드는 탭 타깃 자체가 없어 구조상 이미 layout-aware — 여긴 데스크톱용.
 */
export const MOOD_EXCLUDED_FIELDS: Partial<Record<LayoutId, readonly TicketField[]>> = {
  minimal: ['bookingNo', 'quote'], // #286: 마스터 Minimal은 푸터 바코드 없음 → bookingNo 미렌더.
  // Criterion(v5 Revue 재설계 #524): 흰 종이 + 도판 한 장 구조에 바코드 자리가 없어 bookingNo 미렌더
  // (Minimal·35mm·35mm Wide와 동일). watchTime은 v5 콜로폰 1행이 "관람일 관람시간"으로 렌더하므로
  // 제외 해제. quote(한줄평, #391)는 Criterion 전용이었지만 #558에서 **여기도 제외**로 바뀌었다 —
  // 한줄평은 온티켓 탭(FieldTap → InPlaceFieldEditor)이 편집 경로를 이미 갖고 있어 런처 행이
  // 중복이었고, 레일 '커스텀' 항목은 폰트만 다룬다(스펙 c5). 이 표는 런처 그룹만 거르므로
  // 온티켓 경로는 그대로다. **알려진 대가**: 데스크톱엔 온티켓 탭이 없어 quote 텍스트 편집
  // 경로가 0개가 된다(#558 c6 — 데스크톱 작업 때 복구).
  criterion: ['bookingNo', 'quote'],
  '35mm': ['bookingNo', 'quote'], // #524 v5: 컷 2개 구조에 바코드 자리가 없다 → bookingNo 미렌더(서명은 크레딧 컷 Collected by로 유지).
  editorial: ['quote'], // #391: 한줄평은 Criterion 전용 — 다른 무드는 렌더하지 않으므로 런처에서 제외.
  stub: ['quote'], // #391: 위와 동일.
  '35mm-landscape': ['bookingNo', 'quote'], // #524 v5: 아카이브 패널이 사라지고 컷 2개 구조 → bookingNo 미렌더(서명은 크레딧 컷 Collected by로 유지).
};

/**
 * themeColor(잉크/액센트 색)를 무시하는 무드(#524) — 시안 색이 무드 정체성의 일부라 하드코딩된
 * 무드들. 여기 들어가면 DesignRail의 ColorPicker가 비활성화된다.
 * MOOD_EXCLUDED_FIELDS와 같은 성격의 무드 능력 표 — 셸마다 layout id 리터럴을 반복하면
 * 다음 무드가 합류할 때 한쪽만 고쳐지고 죽은 컨트롤이 남는다(#524 열린 질문).
 * 6무드 액센트 통일 개편이 오면 이 표가 그 진입점이다.
 */
export const TONE_FIXED_MOODS: ReadonlySet<LayoutId> = new Set<LayoutId>([
  '35mm',
  '35mm-landscape',
  'criterion',
  // Stub은 v5 재설계 대상이 아닌데도 원래부터 themeColor를 안 읽는다(ink #1A1612 고정 ·
  // ACCENT monochrome). 표가 이 무드를 놓쳐 ColorPicker가 아무 일도 안 하면서 살아 있었다 —
  // 이제 inkColorFidelity의 표-대-렌더 대조가 이런 누락을 잡는다.
  'stub',
]);

/**
 * 포스터 "꽉 채우기"(components.posterFit='cover')를 제공하는 무드(#527) — TONE_FIXED_MOODS와
 * 같은 성격의 무드 능력 표이고, DESIGN '크기' 섹션의 토글 노출과 무드의 posterFit 소비가 이
 * 표에 맞춰 함께 움직여야 한다(한쪽만 늘리면 죽은 컨트롤이나 조용한 잘림이 남는다).
 *
 * 브라우저 실측(무드별 포스터 프레임 rect, 0.667 크롭 기준)이 목록을 minimal 하나로 좁혔다:
 *   - minimal 960×1534(0.626) → cover가 **가로 6.13%**(좌우 각 3.07%)만 깎는다. 이슈가 말한 동작.
 *   - editorial 640×960 · criterion 500×750 · 35mm 560×840 → 슬롯이 이미 0.667이라 잘림 0%,
 *     cover=contain. 35mm Wide의 포스터 컷(926×617)도 크롭 프리셋이 3:2라 동일(#529).
 *   - stub 밴드는 #527에서 960×640(3:2)이 돼 가로 크롭이 풀블리드로 들어간다 — 그 경우 잘림 0.
 *     세로 크롭이 넘어온 경우엔 cover가 세로 55.6%를 날리는데, 그건 "꽉 채우기"가 아니라
 *     사용자가 확정한 크롭을 무르는 것이라 제공하지 않는다(#525가 걷어낸 룰 5 위반과 같은 그림).
 *     그 상황에 필요한 건 fit 옵션이 아니라 무드별 재크롭(#529 결정 2 — 범위 밖).
 * 다음 풀블리드 무드가 생기면 여기에 한 줄 추가 + 그 무드가 posterFit을 posterFitProps로 넘기면 된다.
 */
export const POSTER_FILL_MOODS: ReadonlySet<LayoutId> = new Set<LayoutId>(['minimal']);

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

/**
 * Criterion 한줄평(#391) 글자수 상한 — v5(#524) 고정 블록 기하 + 실측 재도출(#754). 한줄평은
 * height 190 **고정** 블록에 들어가고 폰트는 50px 고정(제목과 달리 자동 축소 없음)이라, 넘치면
 * 축소가 아니라 3번째 줄이 블록 밖으로 새서 따옴표·서명과 겹친다.
 *   가용폭 = 960 - PAD 84×2 - 따옴표 인셋 96×2 = 600px
 * 옛 주석은 "한글 손글씨 50px advance ≈ 1em → 12자/줄"을 가정해 24자를 냈는데, 실측(headless
 * Chrome, document.fonts.ready 후 canvas measureText, 가용폭 600px·fontSize 50)과 어긋나
 * 폐기됐다:
 *   hand(아이스자람)      28.1px/자(0.56em) · 한 줄 21자 · 2줄 용량 42자
 *   gothic(Pretendard)   35.1px/자(0.70em) · 한 줄 17자 · 2줄 용량 34자 ← 최악
 *   serif(Instrument)    34.1px/자(0.68em) · 한 줄 17자 · 2줄 용량 34자
 * 최악 폰트(고딕/세리프 한글)의 2줄 용량 34자에 옛 24→22가 쓰던 여유 정책(약 8%)을 그대로
 * 적용해 31자로 재도출했다.
 */
export const QUOTE_MAX_LENGTH = 31;

/** 스탬프 → TicketComponents 키(이미지 URL · 텍스트 라벨 · 노출 토글 · 크기 배율). */
export const STAMP_KEYS: Record<
  StampTarget,
  {
    image: keyof TicketComponents;
    label: keyof TicketComponents;
    visible: keyof TicketComponents;
    scale: keyof TicketComponents;
  }
> = {
  chain: { image: 'chain', label: 'chainLabel', visible: 'chainVisible', scale: 'chainScale' },
  format: { image: 'format', label: 'formatLabel', visible: 'formatVisible', scale: 'formatScale' },
};

/**
 * 필드 현재값 미리보기 문자열. 비어 있으면 '' 반환(호출부가 placeholder로 대체).
 * 필드 드로어·온-티켓 탭이 공유 — 컴포넌트에서 분리해
 * 상수 모듈로 이전(#266 PR-A). components는 signature 이미지 우선순위 판정에만 쓴다(#484,
 * claude-review PR #487 P1 — 이미지 업로드 후 텍스트를 비워도 '비어 있음'으로 잘못 보이던 버그).
 */
export function fieldPreview(field: TicketField, info: MovieInfo, components?: TicketComponents): string {
  // 티켓 얼굴과 같은 `★ N.N`(#445) — 6무드가 분모를 버렸는데 편집 UI만 `/ 5.0`을 들고 있으면
  // 같은 값이 화면마다 다른 표기로 보인다. RatingPicker도 같은 표기를 쓴다.
  if (field === 'rating') return `★ ${(info.rating ?? 0).toFixed(1)}`;
  if (field === 'watchDate') return formatDate(info.watchDate, info.watchDateFormat || 'kr-compact', 'date');
  if (field === 'releaseDate') {
    return formatDate(info.releaseDate, info.releaseDateFormat || 'kr-compact', info.releaseDateGranularity || 'date');
  }
  if (field === 'signature' && components?.signatureImage) return '이미지';
  const key = FIELD_INFO_KEY[field];
  return key ? String(info[key] ?? '') : '';
}

/** 스탬프 현재값 미리보기 — 이미지가 있으면 '이미지'(라벨 우선), 없으면 텍스트 라벨. */
export function stampPreview(target: StampTarget, components: TicketComponents): string {
  const keys = STAMP_KEYS[target];
  if (components[keys.image]) return '이미지';
  return String(components[keys.label] ?? '');
}
