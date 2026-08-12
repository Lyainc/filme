import { useState, useCallback, useEffect, useRef } from 'react';
import { PhototicketState, MovieInfo, TicketComponents, TicketField } from '@/types';
import { defaultBrightnessForTexture } from '@/components/moods/_shared';
import { defaultIntensityForTexture, migrateLegacyComponents, type EmbossPath, type EmbossStamp } from '@/utils/textureRecipes';
import { ALL_FIELDS_ON } from '@/constants/fieldVisibility';
import { saveImages, loadImages, clearImages, type ImageDbKey } from '@/utils/imageDb';
import { usePosterCrop } from '@/hooks/usePosterCrop';
import { showError } from '@/utils/errorToast';

// blob: URL을 다시 Blob으로 — 페이지가 만든 objectURL을 읽는 것뿐이라 네트워크를 안 타고,
// captureToImage.ts가 피하는 fetch(data:) CSP 제약과도 무관하다. 실패(이미 revoke된 URL 등)는
// undefined로 흡수해 saveImages가 그 키를 건너뛰게 한다.
async function blobUrlToBlob(url: string | null | undefined): Promise<Blob | undefined> {
  if (!url || !url.startsWith('blob:')) return undefined;
  try {
    const res = await fetch(url);
    return await res.blob();
  } catch {
    return undefined;
  }
}

// 로고 2종·서명·배경의 "현재 URL" ref 갱신과 소유 집합 등록을 한 번에 한다(#673) — updateComponents ·
// restoreSnapshot · IndexedDB 복원 세 경로가 같은 규칙을 쓰게 하는 choke point다. 소유 집합은
// 현재 상태에서 빠진 URL도 계속 들고 있는다: 그게 revoke 대상 후보의 전부이고, 실제로 풀지 말지는
// releaseBlobUrlsOutsideHistory가 히스토리를 보고 판정한다.
function trackComponentBlobUrl(
  ref: { current: string | null },
  value: string | undefined,
  owned: Set<string>
) {
  const url = value?.startsWith('blob:') ? value : null;
  ref.current = url;
  if (url) owned.add(url);
}

const DEFAULT_VISIBILITY_ON_UPLOAD: Record<TicketField, boolean> = {
  title: true,
  titleOg: true,
  actors: false,
  watchDate: true,
  watchTime: false,
  theater: true,
  screen: false,
  seat: true,
  runtime: false,
  rating: true,
  releaseDate: false,
  reissue: false,
  bookingNo: false,
  signature: false,
  quote: false,
};

// 영속화 키 — 스키마가 깨지게 바뀌면 버전을 올려 옛 데이터를 자연히 무시한다(복원 시 키 불일치 → null).
// export인 이유는 _document.tsx의 첫 페인트 스크립트(#675)가 같은 키를 읽기 때문 — 리터럴을
// 양쪽에 두면 키를 올릴 때 한쪽만 바뀌어 랜딩 게이트가 조용히 죽는다.
export const STORAGE_KEY = 'filme:phototicket:v1';

/** `has-draft`(#675) 걷기 — 저장분이 없다는 게 확인된 순간에만 부른다. 이 클래스가 남아 있으면
 *  globals.css가 랜딩을 계속 숨겨, 랜딩도 캔버스도 없는 빈 셸에 갇힌다. */
function clearDraftPaintGate() {
  if (typeof document !== 'undefined') document.documentElement.classList.remove('has-draft');
}

// 자동저장 on/off는 문서(STORAGE_KEY)가 아니라 UI 취향값이라 별도 키로 영속(TB_STORAGE_KEY 선례, #436).
const AUTOSAVE_PREF_KEY = 'filme:autosave:v1';
// 프리뷰 디바운스(280ms, index.tsx)보다 느슨하게 — 저장은 프리뷰만큼 즉각적일 필요가 없다(#436).
const AUTOSAVE_DEBOUNCE_MS = 1000;
// 연속 편집 상한(#651 시나리오②) — 슬라이더·브러시 드래그처럼 dirtyTick이 쉬지 않고 오르면
// 아래 디바운스 effect가 매번 재예약돼 자동저장이 한 번도 안 걸린다. 최초 dirty 시점부터 이
// 시간이 지나면 dirtyTick이 계속 올라와도 강제로 flush한다.
const AUTOSAVE_MAX_WAIT_MS = AUTOSAVE_DEBOUNCE_MS * 5;

// 좌석은 쉼표로 구분된 자리 표기(예: "H12, H13")까지만 허용 — 5번째 토큰부터는 조용히 버린다(#381).
// Editorial/Stub의 좌석 렌더가 fitFontSizeToWidth로 안전하게 축소되는 상한이 4토큰이라, 그 상한을
// 입력/저장 단계(수동 폼 입력 + OCR 반영 공용 choke point인 updateMovieInfo)에서도 강제한다.
export const SEAT_TOKEN_MAX = 4;

export function capSeatTokens(raw: string): string {
  const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length <= SEAT_TOKEN_MAX) return raw;
  return tokens.slice(0, SEAT_TOKEN_MAX).join(', ');
}

// 텍스트·설정만 영속화한다. 포스터(croppedImageUrl)는 objectURL이라 세션이 끝나면 무효라 제외하고,
// recommendedColors는 포스터에서 재추출되므로 제외한다(#178).
// hadPoster는 croppedImageUrl 자체가 아니라 "저장 시점에 포스터가 있었는지"만 남기는 플래그 —
// restoredDraftHadPosterRef가 이걸로 "텍스트만 있던 draft"와 "포스터가 있었지만 IndexedDB
// 복원이 실패한 draft"를 구분한다(#489, claude-review PR #515 P1).
type PersistedState = Pick<PhototicketState, 'movieInfo' | 'components' | 'fieldVisibility'> & {
  hadPoster?: boolean;
  /**
   * 저장 시점에 실제로 이미지가 있던 축(#673). localStorage 쓰기는 동기·확정인데 IndexedDB 쓰기는
   * imagePersistChainRef 뒤에 큐잉된 best-effort라, 이미지를 제거한 직후 탭이 닫히거나 saveImages가
   * 쿼터로 throw하면 IDB엔 옛 Blob이 그대로 남는다. 복원이 IDB만 믿으면 지운 이미지가 새로고침에
   * 되살아나므로, "무엇이 있어야 하는가"는 확정적인 이쪽이 정한다.
   * undefined = 이 필드가 없던 옛 저장분 → 하위호환으로 IDB를 그대로 믿는다.
   */
  imageKeys?: ImageDbKey[];
};

// undo/redo(#356) 스냅샷 = 편집 가능한 문서 상태 전부. 포스터(croppedImageUrl)는 blob 수명
// 관리가 히스토리와 얽혀 제외(이슈 결정), recommendedColors는 포스터 파생값이라 제외.
export type HistorySnapshot = Pick<PhototicketState, 'movieInfo' | 'components' | 'fieldVisibility'>;

function loadPersisted(): Partial<PersistedState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    // 손상·구버전·접근 차단(프라이빗 모드)은 조용히 폴백 — INITIAL_STATE로 시작한다.
    return null;
  }
}

const INITIAL_STATE: PhototicketState = {
  movieInfo: {
    title: '',
    titleOg: '',
    actors: '',
    releaseDate: '',
    releaseDateGranularity: 'date',
    releaseDateFormat: 'kr-compact',
    reissueDate: '',
    isReissue: false,
    watchDate: '',
    watchDateFormat: 'kr-compact',
    watchTime: '',
    theater: '',
    screen: '',
    seat: '',
    // 0 = 미입력(#368) — 무드 6종 모두 `rating > 0`을 표시 게이트로 쓰므로, 사용자가 직접
    // 입력하기 전엔 "★ 5.0"이 티켓에 노출되지 않는다.
    rating: 0,
    runtime: '',
    bookingNumber: '',
    signature: '',
    quote: '',
  },
  components: {
    layout: 'minimal',
    chain: '',
    format: '',
    chainLabel: '',
    formatLabel: '',
    // 옛 단일 texture 기본값 'none'(유광) → 2축 마이그레이션 매핑과 동일하게 {original, gloss}(#475).
    material: 'original',
    coating: 'gloss',
    materialIntensity: 1,
    coatingIntensity: 1,
    posterOpacity: 0.5,
    componentOpacity: 1,
    themeColor: '#FFFFFF',
    // #141 (8): 로고는 기본 ON — 텍스트 라벨/이미지가 없으면 dashed placeholder(미리보기 전용)로 입력을 유도한다.
    chainVisible: true,
    formatVisible: true,
    chainScale: 1,
    formatScale: 1,
    signatureImage: '',
    signatureScale: 1,
    // #558 — 'auto'가 기존 containsHangul 자동분기라 기본 렌더는 안 변한다. 저장본에 이 키가
    // 없어도 소비부가 `?? 'auto'`로 읽어 마이그레이션이 필요 없다.
    quoteFont: 'auto',
  },
  recommendedColors: [],
  croppedImageUrl: null,
  fieldVisibility: ALL_FIELDS_ON,
  embossStamps: [],
  embossPaths: [],
  embossIntensity: 1,
};

export function usePhototicket() {
  const [state, setState] = useState<PhototicketState>(INITIAL_STATE);
  // 형압 편집 모드(#509 c9) — 명시적 온/오프. autoSaveEnabled와 같은 UI 토글 패턴(state 자체는
  // 세션 한정이라 PhototicketState/영속화 대상이 아니다). 켜져 있는 동안 셸이 브러시 레이어를
  // 띄운다. 브러시 반경도 같은 이유로 여기 둔다 — rail 슬라이더와 셸의 브러시 레이어가 값을
  // 공유해야 하는데, 마스크 자체(embossStamps)와 달리 저장할 필요 없는 "현재 펜 크기"다.
  const [embossEditMode, setEmbossEditMode] = useState(false);
  const [embossBrushRadius, setEmbossBrushRadius] = useState(0.07);
  // 형압 도구(#509 2단계) — 브러시/올가미 중 어느 쪽이 편집 레이어의 포인터를 소비할지. 같은
  // 세션 한정 UI 토글 패턴(embossEditMode와 동일 근거) — 도구 선택 자체는 마스크가 아니다.
  const [embossTool, setEmbossTool] = useState<'brush' | 'lasso'>('brush');
  // 자동저장 on/off(기본 ON) + 마지막 저장 시각(인디케이터 반짝임 트리거, #436).
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  // 실사용자 편집만 카운트(update* 3종에서만 증가) — clearDraft/마운트 복원도 movieInfo 등을
  // 바꾸지만 이 카운터는 안 건드려서, 자동저장 effect가 그 둘에는 재발동하지 않는다
  // (claude-review PR #488 P1: clearDraft 직후 지운 저장 키가 1초 뒤 재생성되던 문제).
  const [dirtyTick, setDirtyTick] = useState(0);
  // 이번 마운트가 저장분에서 복원됐는지(#614 D7) — 랜딩 오버레이를 건너뛰는 유일한 근거다.
  // "포스터가 있었나"(restoredDraftHadPosterRef)가 아니라 "저장분이 있었나"로 넓다: 텍스트만
  // 입력하고 나간 재방문자도 랜딩을 다시 보면 안 된다. ref가 아니라 state인 이유는 소비자가
  // 이 값으로 렌더 분기를 하기 때문. clearDraft가 false로 되돌려 랜딩이 복귀한다.
  const [draftRestored, setDraftRestored] = useState(false);
  // 마운트 시 복원된 draft에 포스터가 있었는지 — #489 서브버그: 복원 후 재업로드가 isFirstUpload로
  // 오판돼 방금 복원한 fieldVisibility를 DEFAULT_VISIBILITY_ON_UPLOAD로 덮어쓰는 것을 막는 게이트.
  // "draft 존재 여부"가 아니라 "포스터 존재 여부"로 좁힌다(claude-review PR #515 P1) — 텍스트만
  // 입력하고 포스터는 한 번도 안 올린 draft가 있는 상태에서 이번 세션 첫 업로드를 하면, 그건
  // 진짜 첫 업로드이므로 DEFAULT_VISIBILITY_ON_UPLOAD가 정상 적용돼야 한다.
  const restoredDraftHadPosterRef = useRef(false);
  // 포스터가 있던 draft를 복원 중인가(#683) — localStorage 복원(동기 effect)이 hadPoster를 보고
  // true로 세우고, 뒤이은 IndexedDB 이미지 복원(비동기 effect)이 끝나면(성공·실패 무관) false로
  // 되돌린다. 셸의 canvasReady가 이 신호를 보고 그 창 동안 랜딩을 inline으로 안 내린다 — 안 보면
  // draftRestored는 이미 동기로 서 있는데 croppedImageUrl만 비동기로 늦게 와서, 그 사이 랜딩이
  // "텍스트만 있던 draft" 전용 inline 모드로 잘못 떨어져 잠깐 보였다 사라진다(#675와 원인이 다른
  // 잔여 플래시, IDB 복원 실패 시엔 그대로 false로 풀려 기존 재업로드 유도 inline이 살아난다).
  const [awaitingPosterRestore, setAwaitingPosterRestore] = useState(false);
  // saveDraft가 마지막으로 IndexedDB에 실제로 쓴 이미지 조합의 지문 — 텍스트만 바뀐 autosave
  // tick마다 이미지 5종을 무조건 재컨버팅·재기록하던 것을 막는다(claude-review PR #515 P1).
  const lastPersistedImageFingerprintRef = useRef('');
  // saveDraft의 IndexedDB 쓰기를 호출 순서대로 직렬화 — 안 하면 autosave와 수동 저장이 겹칠 때
  // 늦게 시작한 쪽이 먼저 끝나 최신 상태를 옛 상태가 덮어쓸 수 있다(claude-review PR #515 P1).
  const imagePersistChainRef = useRef<Promise<void>>(Promise.resolve());
  const latestUrlRef = useRef<string | null>(null);
  // chain/format은 picker가 교체 시점에만 revoke하므로, 언마운트 정리를 위해
  // 상태 소유자(hook)가 마지막 blob URL을 추적한다 (latestUrlRef와 동일 패턴).
  const latestChainUrlRef = useRef<string | null>(null);
  const latestFormatUrlRef = useRef<string | null>(null);
  const latestSignatureUrlRef = useRef<string | null>(null);
  // #671 배경 패턴 커스텀 이미지 — 로고 3종과 같은 blob 수명 규칙(선언부터 revoke까지 대칭).
  const latestBgPatternUrlRef = useRef<string | null>(null);
  // 이 훅이 위 4축에 실었던 blob URL 전부(#673). 제거 순간 revoke하면 undo(#356)가 죽은 이미지를
  // 복원하고, 그렇다고 안 풀면 탭이 닫힐 때까지 붙들린다 — 그래서 판정 기준이 "지금 화면이 쓰는가"가
  // 아니라 "히스토리 어디에도 안 남았는가"다. 그 판정자가 releaseBlobUrlsOutsideHistory이고, 이
  // 집합이 그 후보 목록이다. 포스터는 HistorySnapshot 밖이라(스냅샷에 croppedImageUrl이 없다)
  // 여기 안 들고 기존대로 latestUrlRef가 혼자 소유한다.
  const ownedComponentBlobUrlsRef = useRef<Set<string>>(new Set());
  // 마지막 저장이 "있다"고 기록한 이미지 축(#673) — 위 imageKeys를 IDB 복원 effect로 나르는 통로다.
  // null이면 저장분이 없거나 그 필드가 없던 옛 저장분이라 IDB를 그대로 믿는다.
  const restoredImageKeysRef = useRef<ImageDbKey[] | null>(null);
  // 사용자가 밝기 슬라이더를 직접 만졌는지 추적(#146). 한번 만지면 이후 material/coating 전환에서
  // 기본 밝기를 덮어쓰지 않고 사용자 값을 존중한다.
  const brightnessTouchedRef = useRef(false);
  // 강도 슬라이더 직접 조작 추적(#434 → #475 축별 분리) — brightnessTouchedRef와 같은 패턴. 한번
  // 만지면 이후 그 축 전환에서 기본 강도로 덮지 않고 사용자 값을 존중한다. 밝기와 달리 새 포스터
  // 업로드로는 리셋하지 않는다 — 강도는 포스터 명암이 아니라 재질/코팅 취향에 종속적이다.
  const materialIntensityTouchedRef = useRef(false);
  const coatingIntensityTouchedRef = useRef(false);
  // 자동저장 디바운스 타이머 핸들 — clearDraft가 직접 취소하는 용도(아래 effect 참고).
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AUTOSAVE_MAX_WAIT_MS 계산용 — 저장이 안 걸린 채로 dirtyTick이 연속 갱신되는 구간의 시작 시각.
  // 저장(디바운스 fire·visibilitychange flush)이나 clearDraft가 일어나면 null로 되돌아간다.
  const autoSaveFirstDirtyAtRef = useRef<number | null>(null);
  // 크롭 원본 시드 경로의 latest-ref(saveDraftRef와 동일 패턴) — handleImageUpload는 소비자가
  // 많아 stable해야 하는데 아래 usePosterCrop보다 먼저 정의되므로 이 ref로 순환을 끊는다.
  const seedOriginalRef = useRef<(url: string | null) => void>(() => {});

  const handleImageUpload = useCallback((croppedUrl: string, originalUrl?: string | null) => {
    // 새 포스터 업로드는 밝기 슬레이트를 초기화한다 — 이후 texture 전환에서 그 texture의
    // 기본 밝기가 다시 적용된다(#146 리뷰). fieldVisibility(첫 업로드에만 리셋)와 달리
    // 밝기는 포스터 콘텐츠(어두운/밝은 포스터)에 종속적이라 매 업로드마다 리셋한다.
    brightnessTouchedRef.current = false;
    // 포스터 업로드도 실사용자 편집이라 dirtyTick을 올린다 — 첫 업로드는 fieldVisibility를
    // DEFAULT_VISIBILITY_ON_UPLOAD로 갈아끼우는데(영속 대상), 안 올리면 "포스터만 올리고 다른
    // 편집은 안 함" 케이스에서 그 변경이 다음 update*까지 자동저장에 안 실린다. 마운트 복원
    // 경로는 setState로 croppedImageUrl을 직접 넣고 이 콜백을 안 거치므로 재발동 걱정은 없다.
    setDirtyTick((t) => t + 1);
    // 크롭 파이프라인을 거친 호출은 이미 같은 원본을 쥔 채 들어오므로 이 시드는 no-op이고,
    // 훅을 직접 부르는 경로(테스트·프로그램적 주입)만 여기서 원본을 채운다(#548).
    seedOriginalRef.current(originalUrl ?? null);
    setState((prev) => {
      if (prev.croppedImageUrl) URL.revokeObjectURL(prev.croppedImageUrl);
      latestUrlRef.current = croppedUrl;
      // 복원된 draft에 포스터가 있었으면(restoredDraftHadPosterRef) 이번 업로드가
      // croppedImageUrl===null이어도 "첫 업로드"가 아니다 — IDB 이미지 복원이 실패해 재업로드를
      // 유도한 경우, 이미 복원된 fieldVisibility를 덮어쓰면 안 된다(#489 서브버그). 포스터가
      // 없던 텍스트 전용 draft라면 이 게이트가 안 걸려 진짜 첫 업로드로 정상 처리된다.
      const isFirstUpload = prev.croppedImageUrl === null && !restoredDraftHadPosterRef.current;
      return {
        ...prev,
        croppedImageUrl: croppedUrl,
        ...(isFirstUpload ? { fieldVisibility: DEFAULT_VISIBILITY_ON_UPLOAD } : {}),
        // 형압 마스크 폐기(#509 c8) — 이 콜백이 포스터 교체·재크롭 양쪽의 단일 진입점이라(usePosterCrop
        // → onCropComplete가 재크롭도 여기로 보낸다), 마스크가 옛 포스터 픽셀을 가리키는 채로
        // 새 포스터에 얹히는 orphan을 여기 한 곳에서 막는다. embossPaths(2단계 올가미)도 같은
        // 좌표계·같은 orphan 위험이라 나란히 폐기한다.
        embossStamps: [],
        embossPaths: [],
      };
    });
  }, []);

  // 크롭 전 원본 objectURL과 크롭 모달 상태의 단일 소유자(#548) — 소비자(ImageUploader ·
  // MobileEditorShell)가 아니라 이 훅과 같은 수명을 갖는다. 셸이 언마운트돼도(브레이크포인트
  // 전환) 원본이 안 죽으므로, 아래 saveDraft가 읽는 URL도 항상 살아있다.
  const posterCrop = usePosterCrop(handleImageUpload);
  seedOriginalRef.current = posterCrop.seedOriginal;

  // 마운트 시 localStorage에서 텍스트·설정을 복원한다. SSR 하이드레이션 불일치를 피하려
  // useState 초기화가 아니라 effect에서 한다(서버는 INITIAL_STATE로 렌더, 클라가 마운트 후 복원).
  // 얕은 병합이라 누락/추가 필드는 INITIAL_STATE 기본값으로 자연히 메워진다(#178).
  useEffect(() => {
    const saved = loadPersisted();
    // 스크립트는 키의 **존재**만 봤으므로 손상·구버전이면 여기서 복원이 실패한다 — 그때 게이트를
    // 안 거두면 랜딩이 영영 안 뜬다(#675). 복원에 성공한 경로는 아래 draftRestored가 랜딩을 자기
    // 판정으로 숨기므로 게이트를 그대로 둬도 무해하고, 여기서 거두면 리렌더 전 한 프레임이 샌다.
    if (!saved) {
      clearDraftPaintGate();
      return;
    }
    setDraftRestored(true);
    // 복원된 draft에 포스터가 있었다는 표시 — handleImageUpload의 isFirstUpload 판정이 이걸로
    // 게이트된다(#489 서브버그: IDB 이미지 복원이 실패해도 croppedImageUrl은 null인 채로
    // 재업로드를 유도하는데, 그 재업로드를 "첫 업로드"로 오판해 방금 복원한 fieldVisibility를
    // 리셋하면 안 된다). 텍스트만 있던 draft(hadPoster=false/undefined)는 그대로 첫 업로드로
    // 취급해 DEFAULT_VISIBILITY_ON_UPLOAD가 정상 적용되게 한다(claude-review PR #515 P1).
    restoredDraftHadPosterRef.current = saved.hadPoster === true;
    // 아래 IDB 복원 effect가 되살려도 되는 축의 화이트리스트(#673). 이 effect는 선언 순서상 먼저
    // 돌고 동기라, 비동기 IDB 복원이 읽을 땐 이미 확정돼 있다(restoredDraftHadPosterRef와 동일 패턴).
    restoredImageKeysRef.current = Array.isArray(saved.imageKeys) ? saved.imageKeys : null;
    if (restoredDraftHadPosterRef.current) setAwaitingPosterRestore(true);
    // 옛 단일 texture 저장분을 {material, coating, ...Intensity}로 매핑(#475 c4) — 이미 새
    // shape면 그대로 통과. 이후 touched 판정·merge 모두 이 결과를 쓴다.
    const migratedComponents = saved.components
      ? (migrateLegacyComponents(saved.components as unknown as Record<string, unknown>) as Partial<TicketComponents>)
      : undefined;
    // 저장된 밝기가 기본값과 다르면 사용자가 만진 값이므로 touched로 표시한다 — 안 그러면
    // brightnessTouchedRef(false)가 복원 직후 첫 전환에서 기본 밝기로 저장된 값을 덮어쓴다
    // (#178 리뷰 P1). ref라 영속화엔 안 들어가 복원 시 따로 복구.
    if (
      migratedComponents?.posterOpacity !== undefined &&
      migratedComponents.posterOpacity !== INITIAL_STATE.components.posterOpacity
    ) {
      brightnessTouchedRef.current = true;
    }
    // 저장된 강도가 그 축 기본값과 다르면 사용자가 만진 값이므로 touched로 표시한다(#434/#475,
    // 위 밝기와 동일 패턴). 구버전 저장본엔 materialIntensity/coatingIntensity가 없어(undefined)
    // 기본값과 갈리므로 touched로 오판할 수 있으나, undefined는 아래 얕은 병합에서 INITIAL_STATE
    // 기본값(1)으로 메워지고 'gloss' 기본 강도도 1이라 실질 오판이 없다.
    if (
      migratedComponents?.materialIntensity !== undefined &&
      migratedComponents.materialIntensity !==
        defaultIntensityForTexture(migratedComponents.material ?? INITIAL_STATE.components.material)
    ) {
      materialIntensityTouchedRef.current = true;
    }
    if (
      migratedComponents?.coatingIntensity !== undefined &&
      migratedComponents.coatingIntensity !==
        defaultIntensityForTexture(migratedComponents.coating ?? INITIAL_STATE.components.coating)
    ) {
      coatingIntensityTouchedRef.current = true;
    }
    setState((prev) => ({
      ...prev,
      movieInfo: { ...prev.movieInfo, ...(saved.movieInfo ?? {}) },
      components: { ...prev.components, ...(migratedComponents ?? {}) },
      fieldVisibility: { ...prev.fieldVisibility, ...(saved.fieldVisibility ?? {}) },
    }));
  }, []);

  // 자동저장 on/off 취향값 복원 — 문서 복원과 키가 갈려 독립 effect(#436).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(AUTOSAVE_PREF_KEY);
      if (raw !== null) setAutoSaveEnabled(raw === '1');
    } catch {
      // 손상·접근 차단은 기본값(ON) 유지 — best-effort.
    }
  }, []);

  // 이미지(포스터·원본·로고·서명) 복원 — IndexedDB는 비동기라 localStorage 복원과 별도 effect다.
  // 실패(미지원·프라이빗 모드·용량 초과)는 catch에서 조용히 흡수 — croppedImageUrl이 null인 채로
  // 남아 현재(lossy) 동작대로 재업로드를 유도한다(#489 결정 5). StrictMode 이중 마운트에서 두
  // 번째 실행이 먼저 끝나 setState한 뒤 첫 번째 실행이 뒤늦게 도착하는 경우를 cancelled로 막는다.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    loadImages()
      .then((images) => {
        if (cancelled) return;
        // 마지막 저장이 기록한 축만 되살린다(#673) — 이미지를 제거한 뒤 IDB 쓰기가 큐에 걸린 채
        // 탭이 닫혔거나 쿼터로 throw했으면 IDB엔 옛 Blob이 남아 있는데, 그걸 그대로 믿으면 지운
        // 이미지가 새로고침에 되돌아온다. 목록이 없는 옛 저장분(null)은 전부 허용해 하위호환.
        const allowedKeys = restoredImageKeysRef.current;
        const allows = (key: ImageDbKey) => allowedKeys === null || allowedKeys.includes(key);
        const chainUrl = images.chain && allows('chain') ? URL.createObjectURL(images.chain) : null;
        const formatUrl = images.format && allows('format') ? URL.createObjectURL(images.format) : null;
        const signatureUrl =
          images.signature && allows('signature') ? URL.createObjectURL(images.signature) : null;
        // 배경 이미지(#672) — 로고 3종과 완전히 같은 모양이다.
        const bgUrl = images.background && allows('background') ? URL.createObjectURL(images.background) : null;
        const posterUrl = images.poster && allows('poster') ? URL.createObjectURL(images.poster) : null;
        // 크롭 원본 복원(#489) — 크롭 파이프라인(posterCrop)이 이 URL의 단일 소유자이고,
        // saveDraft도 거기서 읽어 다음 저장에 다시 실어보낸다(안 하면 복원 직후 첫 자동저장이
        // 원본을 빈 값으로 갈아치워 IndexedDB에서 지운다). seedOriginal은 이미 원본이 있으면
        // 무시하므로, 이 비동기 복원이 그 사이 사용자가 올린 포스터를 덮어쓰지 않는다.
        if (images.posterOriginal && allows('posterOriginal')) {
          seedOriginalRef.current(URL.createObjectURL(images.posterOriginal));
        }
        if (!chainUrl && !formatUrl && !signatureUrl && !bgUrl && !posterUrl) return;
        // #683 fresh-context 리뷰 — 이 복원은 IndexedDB라 도착까지 시간이 걸리는데, 그 창이 이제
        // (awaitingPosterRestore, 위 canvasReady) 조작 가능한 편집 캔버스 + 필드 드로어로 열려
        // 있다. posterOriginal과 같은 "이미 있으면 무시" 처방을 나머지 네 축에도 준다 — prev를
        // setState 콜백 안에서 봐야 그사이 사용자가 실제로 채운 값을 정확히 판정할 수 있다(effect
        // 바깥에서 만든 시점의 state는 이미 stale할 수 있다). 버려지는 objectURL은 여기서 바로
        // revoke하고, 실제로 쓰는 URL만 owned 집합(#673)에 등록해 언마운트/히스토리 이탈 revoke가
        // orphan이 아니라 화면에 진짜 쓰이는 URL을 대상으로 삼게 한다.
        const owned = ownedComponentBlobUrlsRef.current;
        setState((prev) => {
          const componentsPatch: Partial<TicketComponents> = {};
          if (chainUrl) {
            if (prev.components.chain) URL.revokeObjectURL(chainUrl);
            else {
              trackComponentBlobUrl(latestChainUrlRef, chainUrl, owned);
              componentsPatch.chain = chainUrl;
            }
          }
          if (formatUrl) {
            if (prev.components.format) URL.revokeObjectURL(formatUrl);
            else {
              trackComponentBlobUrl(latestFormatUrlRef, formatUrl, owned);
              componentsPatch.format = formatUrl;
            }
          }
          if (signatureUrl) {
            if (prev.components.signatureImage) URL.revokeObjectURL(signatureUrl);
            else {
              trackComponentBlobUrl(latestSignatureUrlRef, signatureUrl, owned);
              componentsPatch.signatureImage = signatureUrl;
            }
          }
          if (bgUrl) {
            if (prev.components.backgroundPatternImage) URL.revokeObjectURL(bgUrl);
            else {
              trackComponentBlobUrl(latestBgPatternUrlRef, bgUrl, owned);
              componentsPatch.backgroundPatternImage = bgUrl;
            }
          }
          let croppedImageUrlPatch: string | null = null;
          if (posterUrl) {
            if (prev.croppedImageUrl) URL.revokeObjectURL(posterUrl);
            else {
              latestUrlRef.current = posterUrl;
              croppedImageUrlPatch = posterUrl;
            }
          }
          if (!croppedImageUrlPatch && Object.keys(componentsPatch).length === 0) return prev;
          return {
            ...prev,
            ...(croppedImageUrlPatch ? { croppedImageUrl: croppedImageUrlPatch } : {}),
            components: { ...prev.components, ...componentsPatch },
          };
        });
      })
      .catch(() => {
        // IndexedDB 미지원·프라이빗 모드·용량 초과(#645 C5) — croppedImageUrl은 null인 채로
        // 현재 lossy 동작(재업로드 유도)으로 폴백한다. restoredDraftHadPosterRef는 위 localStorage
        // 복원 effect(선언 순서상 먼저 실행)가 동기로 채워두므로, 이 비동기 catch 시점엔 이미
        // 확정돼 있다 — 포스터가 있던 draft에서만 알린다. 포스터가 아예 없던 draft·첫 방문(=이
        // 환경이 그냥 IndexedDB를 지원 안 함)까지 "다시 올려주세요"를 띄우면 잃은 것도 없는데
        // 매번 경고가 뜬다.
        if (restoredDraftHadPosterRef.current) {
          showError('저장된 포스터를 불러오지 못했어요. 포스터를 다시 올려주세요.', { persistent: true });
        }
      })
      .finally(() => {
        // 복원 시도가 끝났다 — 성공(포스터 도착)이든 실패(재업로드 유도)든 대기 게이트를 푼다.
        if (!cancelled) setAwaitingPosterRestore(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateFieldVisibility = useCallback((partial: Partial<Record<TicketField, boolean>>) => {
    setState((prev) => ({
      ...prev,
      fieldVisibility: { ...prev.fieldVisibility, ...partial },
    }));
    setDirtyTick((t) => t + 1);
  }, []);

  const updateMovieInfo = useCallback((info: Partial<MovieInfo>) => {
    setState((prev) => {
      // title만 단독으로(movieCd 없이) 바뀌면 수동 편집이라 본다 — 이전 KOBIS 선택의 movieCd는
      // 더 이상 화면의 title과 대응하지 않으므로 같이 무효화한다. 안 그러면 바코드 fallback(#379)이
      // 스테일 movieCd를 계속 인코딩한다(claude-review PR #397 P1). KOBIS 선택/보강과 OCR undo
      // 스냅샷은 title과 movieCd를 항상 같은 patch에 실어 보내므로 이 분기를 타지 않는다.
      const staleMovieCd = 'title' in info && !('movieCd' in info) && info.title !== prev.movieInfo.title;
      const capped = typeof info.seat === 'string' ? { ...info, seat: capSeatTokens(info.seat) } : info;
      return {
        ...prev,
        movieInfo: { ...prev.movieInfo, ...capped, ...(staleMovieCd ? { movieCd: undefined } : {}) },
      };
    });
    setDirtyTick((t) => t + 1);
  }, []);

  // 비동기 자동 보강 전용 — updateMovieInfo와 달리 이미 값이 있는 필드는 덮지 않는다. 사용자가
  // 먼저 손으로 채운 필드를 뒤늦게 도착한 보강이 지워버리면 안 되기 때문이다.
  // prev 기준으로 빈 필드를 판정하므로 호출 시점 클로저가 stale해도 안전하다(레이스 없음).
  //
  // **지금 호출부가 0이다** — 유일한 소비자였던 TMDB 포스터 확정 경로(#537 c8)가 #665에서
  // 철거됐다. 그래도 남긴다: 이 규칙과 아래 #638 P2 회귀(숫자 0 오판 금지)는 다음 자동 보강
  // 경로(#635의 OCR 체인이 첫 후보)가 붙을 때 그대로 다시 필요하고,
  // __tests__/fillEmptyMovieInfoRatingZero.test.tsx가 계속 그걸 지킨다.
  const fillEmptyMovieInfo = useCallback((info: Partial<MovieInfo>) => {
    setState((prev) => {
      const patch: Partial<MovieInfo> = {};
      for (const key of Object.keys(info) as (keyof MovieInfo)[]) {
        const current = prev.movieInfo[key];
        // truthy 체크(`!current`)는 숫자 0(rating의 미입력 sentinel과 우연히 같은 값)까지
        // 빈 값으로 오판한다(#638 P2) — nullish/빈 문자열만 빈 값으로 본다.
        if (current === undefined || current === null || current === '') {
          (patch as Record<string, unknown>)[key] = info[key];
        }
      }
      return Object.keys(patch).length === 0 ? prev : { ...prev, movieInfo: { ...prev.movieInfo, ...patch } };
    });
    setDirtyTick((t) => t + 1);
  }, []);

  const updateComponents = useCallback((components: Partial<TicketComponents>) => {
    // posterOpacity가 직접 실려오면 슬라이더 조작이므로 touched로 기록한다. ref 뮤테이션은
    // setState updater 밖에서 한다 — updater는 순수해야 하고(StrictMode 이중 호출), 이 갱신은
    // prev에 의존하지 않으므로 바깥이 맞다(latestUrlRef 패턴과 동일).
    if (components.posterOpacity !== undefined) {
      brightnessTouchedRef.current = true;
    }
    if (components.materialIntensity !== undefined) {
      materialIntensityTouchedRef.current = true;
    }
    if (components.coatingIntensity !== undefined) {
      coatingIntensityTouchedRef.current = true;
    }
    setState((prev) => {
      const nextComponents = { ...prev.components, ...components };
      // 제거(빈 문자열)면 ref는 null이 되지만 소유 집합엔 옛 URL이 남는다 — 그게 #673의 핵심이다.
      const owned = ownedComponentBlobUrlsRef.current;
      trackComponentBlobUrl(latestChainUrlRef, nextComponents.chain, owned);
      trackComponentBlobUrl(latestFormatUrlRef, nextComponents.format, owned);
      trackComponentBlobUrl(latestSignatureUrlRef, nextComponents.signatureImage, owned);
      trackComponentBlobUrl(latestBgPatternUrlRef, nextComponents.backgroundPatternImage, owned);

      const materialChanged = components.material !== undefined && components.material !== prev.components.material;
      const coatingChanged = components.coating !== undefined && components.coating !== prev.components.coating;

      // #146 확정 b → #475 2축 확장: material/coating 전환 시 그 조합의 기본 밝기를 적용 — 단,
      // 슬라이더를 직접 만진 적이 없고(touched=false) posterOpacity가 이 업데이트에 실려오지
      // 않았을 때만. 두 축 중 하나만 바뀌어도 조합이 바뀌므로 재계산한다.
      if (components.posterOpacity === undefined && (materialChanged || coatingChanged) && !brightnessTouchedRef.current) {
        nextComponents.posterOpacity = defaultBrightnessForTexture(nextComponents.material, nextComponents.coating);
      }

      // 강도도 동일 규칙(#434/#475) — 축 전환 시 그 축 기본 강도를 적용, 단 사용자가 그 축 강도
      // 슬라이더를 직접 만진 적 없고(touched=false) 그 축 intensity가 이 업데이트에 실려오지 않았을 때만.
      if (components.materialIntensity === undefined && materialChanged && !materialIntensityTouchedRef.current) {
        nextComponents.materialIntensity = defaultIntensityForTexture(components.material!);
      }
      if (components.coatingIntensity === undefined && coatingChanged && !coatingIntensityTouchedRef.current) {
        nextComponents.coatingIntensity = defaultIntensityForTexture(components.coating!);
      }

      // 형압 마스크는 layout(무드)·posterFit(#527 "꽉 채우기") 전환에도 안 비운다(#509 재매핑).
      // 마스크가 이제 포스터 "박스" 분율이 아니라 자연 이미지 분율로 저장되고(EmbossStamp, c7 원래
      // 의도), 렌더 시점에 그 순간의 fit/align으로 박스 분율로 다시 투영하므로(projectEmbossStamps,
      // compositeRaster와 동일한 매핑) 박스-이미지 대응 관계가 바뀌어도 좌표가 안 흔들린다. 포스터
      // 교체·재크롭(handleImageUpload)은 원본 자체가 달라지므로 그쪽 폐기는 그대로 유지한다.

      return { ...prev, components: nextComponents };
    });
    setDirtyTick((t) => t + 1);
  }, []);

  const setRecommendedColors = useCallback((colors: string[]) => {
    setState((prev) => ({ ...prev, recommendedColors: colors }));
  }, []);

  // 형압(#509) — 마스크는 dirtyTick(자동저장 트리거)을 안 올린다. embossStamps/embossIntensity는
  // PersistedState/HistorySnapshot의 Pick 목록 밖이라(c8) 애초에 저장되지 않으므로, tick을 올려도
  // 효과가 없는 헛 리렌더만 하나 더 생긴다.
  const addEmbossStamp = useCallback((stamp: EmbossStamp) => {
    setState((prev) => ({ ...prev, embossStamps: [...prev.embossStamps, stamp] }));
  }, []);

  // 올가미(2단계)는 브러시처럼 포인트마다 커밋하지 않는다 — 트레이스가 닫힌 다각형 하나로
  // 완성된 뒤(포인터업) 한 번에 들어온다(EmbossBrushLayer의 onPath).
  const addEmbossPath = useCallback((path: EmbossPath) => {
    setState((prev) => ({ ...prev, embossPaths: [...prev.embossPaths, path] }));
  }, []);

  const clearEmbossMask = useCallback(() => {
    setState((prev) => (prev.embossStamps.length || prev.embossPaths.length ? { ...prev, embossStamps: [], embossPaths: [] } : prev));
  }, []);

  const setEmbossIntensity = useCallback((embossIntensity: number) => {
    setState((prev) => ({ ...prev, embossIntensity }));
  }, []);

  // undo/redo(#356) 복원 전용 경로 — updateComponents를 거치지 않는다. 거치면 posterOpacity가
  // 항상 실려와 brightnessTouchedRef가 오염되고 texture 기본 밝기 로직이 스냅샷을 덮는다.
  // 언마운트 revoke 대상 ref만 복원된 로고에 맞춰 갱신한다.
  const restoreSnapshot = useCallback((snap: HistorySnapshot) => {
    const owned = ownedComponentBlobUrlsRef.current;
    trackComponentBlobUrl(latestChainUrlRef, snap.components.chain, owned);
    trackComponentBlobUrl(latestFormatUrlRef, snap.components.format, owned);
    trackComponentBlobUrl(latestSignatureUrlRef, snap.components.signatureImage, owned);
    trackComponentBlobUrl(latestBgPatternUrlRef, snap.components.backgroundPatternImage, owned);
    // touched도 스냅샷 시점 기준으로 재유도(#178의 loadPersisted 패턴, PR #361 리뷰 P1) —
    // 안 하면 밝기 조작 이전 시점으로 undo해도 ref가 true로 남아, 이후 전환에서 기본 밝기
    // 적용이 스킵된다.
    brightnessTouchedRef.current =
      snap.components.posterOpacity !== defaultBrightnessForTexture(snap.components.material, snap.components.coating);
    materialIntensityTouchedRef.current =
      snap.components.materialIntensity !== defaultIntensityForTexture(snap.components.material);
    coatingIntensityTouchedRef.current =
      snap.components.coatingIntensity !== defaultIntensityForTexture(snap.components.coating);
    setState((prev) => ({
      ...prev,
      movieInfo: snap.movieInfo,
      components: snap.components,
      fieldVisibility: snap.fieldVisibility,
    }));
  }, []);

  // 소유 집합을 통째로 회수 — 히스토리째 버리는 두 순간(clearDraft·언마운트) 전용.
  const releaseAllOwnedBlobUrls = useCallback(() => {
    ownedComponentBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    ownedComponentBlobUrlsRef.current.clear();
    latestChainUrlRef.current = null;
    latestFormatUrlRef.current = null;
    latestSignatureUrlRef.current = null;
    latestBgPatternUrlRef.current = null;
  }, []);

  // 히스토리에서 완전히 빠져나간 blob URL만 회수한다(#673) — 제거 순간이 아니라 여기가 revoke
  // 시점인 이유는, 제거 직후 undo(#356)가 그 이미지를 그대로 되살려야 하기 때문이다. 인자는
  // useEditHistory가 쥔 스냅샷 JSON 배열이고, 캡 초과 축출·redo 가지 절단으로 스냅샷이 사라진
  // 뒤에야 그 안에만 있던 URL이 풀린다.
  //
  // 스냅샷에서 URL을 뽑는 건 JSON.parse가 아니라 문자열 훑기다 — 스냅샷은 JSON.stringify 결과이고
  // blob: URL엔 이스케이프될 문자가 없어 정확히 잡히는데, 매 변경마다 최대 80개를 파싱하는 것보다
  // 싸다. 사용자 텍스트에 우연히 'blob:'가 들어가면 오탐이 나지만 그건 URL을 더 살려두는 방향이라
  // 안전하고(누수 지연일 뿐), 반대로 놓쳐서 살아있는 URL을 푸는 일은 구조상 없다.
  const releaseBlobUrlsOutsideHistory = useCallback((snapshots: string[]) => {
    const owned = ownedComponentBlobUrlsRef.current;
    if (owned.size === 0) return;
    const kept = new Set(snapshots.join('\n').match(/blob:[^"]+/g) ?? []);
    // 지금 화면이 쓰는 URL은 아직 어느 스냅샷에도 없을 수 있다 — 히스토리 push는 350ms 디바운스라
    // 방금 올린 로고가 그 창 안에서는 스택 밖이다.
    for (const ref of [latestChainUrlRef, latestFormatUrlRef, latestSignatureUrlRef, latestBgPatternUrlRef]) {
      if (ref.current) kept.add(ref.current);
    }
    owned.forEach((url) => {
      if (kept.has(url)) return;
      URL.revokeObjectURL(url);
      owned.delete(url);
    });
  }, []);

  // #310이 폐지했던 자동저장을 #436이 enabled 게이트 뒤에 되살린다 — 명시적 트리거(버튼 클릭)는 그대로 유지.
  // 반환값은 localStorage 쓰기(텍스트/설정, 동기) 성공 여부 — 호출부(자동저장 effect·임시저장
  // 버튼)가 이걸로 "저장됐다"는 인디케이터/토스트를 게이팅한다(#645 C1: 실패해도 무조건 성공
  // 표시하던 거짓 성공 제거). IndexedDB 이미지 쓰기는 비동기라 이 반환값엔 안 실린다 — 실패는
  // 아래에서 별도로 showError한다.
  const saveDraft = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;
    // 이미지 6축의 (IndexedDB 키, 현재 URL) — 아래 imageKeys·지문·IDB 쓰기가 전부 이 하나를 읽어,
    // 축이 늘 때 세 곳이 갈리지 않는다.
    const imageSources: [ImageDbKey, string | null | undefined][] = [
      ['poster', state.croppedImageUrl],
      ['posterOriginal', posterCrop.originalSrc],
      ['chain', state.components.chain],
      ['format', state.components.format],
      ['signature', state.components.signatureImage],
      ['background', state.components.backgroundPatternImage],
    ];
    let textSaved = true;
    try {
      const payload: PersistedState = {
        movieInfo: state.movieInfo,
        // chain/format이 업로드 로고의 blob: URL이면 비운다 — 포스터와 같은 이유로 재시작 후
        // 죽은 참조다. 라벨·토글은 유지되어 복원 시 dashed placeholder로 재업로드를 유도한다.
        components: {
          ...state.components,
          chain: state.components.chain.startsWith('blob:') ? '' : state.components.chain,
          format: state.components.format.startsWith('blob:') ? '' : state.components.format,
          signatureImage: state.components.signatureImage?.startsWith('blob:') ? '' : state.components.signatureImage,
          // 배경 이미지도 blob:이면 비운다(재시작 후 죽은 참조라서) — 대신 아래 IndexedDB에
          // Blob으로 실어 새로고침에 왕복 복원한다(#672). #671이 남겼던 비대칭(배경만 IDB에 안
          // 실려 새로고침에 조용히 사라짐)이 여기서 닫힌다: 프리셋이 없어진 뒤로 배경 이미지가
          // 이 축의 전부라, 유실되면 티켓 위에 흔적조차 안 남아 레일을 열어야만 알 수 있었다.
          backgroundPatternImage: state.components.backgroundPatternImage?.startsWith('blob:')
            ? ''
            : state.components.backgroundPatternImage,
        },
        fieldVisibility: state.fieldVisibility,
        hadPoster: state.croppedImageUrl !== null,
        // 아래 IndexedDB 쓰기가 못 끝나도(탭 닫힘·쿼터 throw) 이 목록은 이미 확정 저장돼, 다음
        // 복원이 IDB의 옛 Blob을 되살리지 못하게 막는다(#673).
        imageKeys: imageSources.filter(([, url]) => url?.startsWith('blob:')).map(([key]) => key),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 저장 실패(쿼터 초과·프라이빗 모드, #645 C1) — 예전엔 무시하고 아래 setLastSavedAt이
      // 무조건 실행돼 인디케이터가 성공처럼 반짝였다. 이제 실패를 알리고 false를 돌려준다.
      textSaved = false;
      showError('저장에 실패했어요. 브라우저 저장 공간이 가득 찼거나 비공개 모드일 수 있어요.', { persistent: true });
    }

    // 이미지는 텍스트와 별도로 IndexedDB에 저장 — 위 localStorage 쓰기가 이미 끝났으므로 여기서
    // 실패해도(미지원·프라이빗 모드·용량 초과) 텍스트/설정 복원은 지켜진다(#489 결정 5).
    // blob: URL을 Blob으로 되돌려 저장하고, 다음 새로고침에서 위 IDB 복원 effect가 새
    // objectURL을 재발급한다.
    //
    // 직전 저장과 이미지 URL 조합이 같으면(텍스트만 바뀐 autosave tick) 스킵 — fetch(blob:)+IDB
    // 재기록을 매번 반복하지 않는다(claude-review PR #515 P1). 실제로 쓸 게 있을 때만
    // imagePersistChainRef에 이어붙여 호출 순서를 지킨다 — 안 하면 autosave와 수동 저장이 겹쳐
    // 늦게 시작한 쪽이 먼저 끝나며 최신 상태를 옛 상태가 덮어쓸 수 있다(같은 리뷰 P1).
    const fingerprint = imageSources.map(([, url]) => url).join('|');
    // textSaved 게이트(#673 리뷰) — imageKeys가 localStorage에 있으므로, 그 쓰기가 실패한
    // 저장에서 이미지만 IndexedDB에 넣으면 다음 복원이 그 이미지를 목록 밖이라고 버린다.
    // 쓰고 나서 못 읽는 결과가 되므로 아예 안 쓴다. 지문도 안 갱신돼 다음 저장이 다시 시도한다.
    if (textSaved && fingerprint !== lastPersistedImageFingerprintRef.current) {
      imagePersistChainRef.current = imagePersistChainRef.current.then(async () => {
        try {
          const blobs = await Promise.all(imageSources.map(([, url]) => blobUrlToBlob(url)));
          const entries: Partial<Record<ImageDbKey, Blob | undefined>> = {};
          imageSources.forEach(([key], i) => {
            entries[key] = blobs[i];
          });
          await saveImages(entries);
          lastPersistedImageFingerprintRef.current = fingerprint;
        } catch {
          // IndexedDB 미지원·프라이빗 모드·용량 초과(#645 C1 자매) — fingerprint를 안 갱신해 다음
          // 저장 시도에서 다시 시도한다. 비동기라 saveDraft의 반환값엔 안 실리므로 별도로 알린다.
          // ephemeral인 이유: 실패가 이어지면 매 autosave tick마다 다시 호출되는데, showError의
          // 동일 메시지 dedup이 재생 애니메이션 없이 타이머만 늘려 스팸 없이 계속 보인다.
          showError('포스터 이미지 저장에 실패했어요.');
        }
      });
    }
    return textSaved;
  }, [state.movieInfo, state.components, state.fieldVisibility, state.croppedImageUrl, posterCrop.originalSrc]);

  // 디바운스 타이머 콜백이 항상 최신 saveDraft를 호출하도록 하는 latest-ref 패턴 — 매 렌더 갱신.
  // dirtyTick은 "언제 예약할지"만 게이팅하고, 실행 시점엔 이 ref로 그 사이 바뀐 최신 state를
  // 저장한다. restoreSnapshot(undo/redo)처럼 dirtyTick을 안 올리는 갱신도 이 ref엔 반영되므로,
  // 예약된 타이머가 undo 이전 옛 state를 저장하는 사고를 막는다(claude-review PR #488 2차 P1).
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  // 자동저장 토글(#436) — 취향값이라 TB_STORAGE_KEY와 동일하게 즉시 동기 저장(디바운스 불필요, 클릭당 1회).
  const toggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(AUTOSAVE_PREF_KEY, next ? '1' : '0');
        } catch {
          // best-effort — 저장 실패해도 이번 세션 토글은 유효.
        }
      }
      return next;
    });
  }, []);

  // 자동저장 디바운스 effect(#436) — dirtyTick(실사용자 편집만 증가)이 "언제 예약할지"의 게이트다.
  // clearDraft/마운트 복원도 movieInfo 등을 바꾸지만 dirtyTick은 그대로라 재발동하지 않는다
  // (claude-review PR #488 1차 P1). dirtyTick===0(아직 편집 없음)이면 마운트 직후에도 발동 안 함.
  // 실행 시점엔 saveDraftRef로 항상 최신 state를 저장하므로, undo/redo처럼 dirtyTick을 안 올리는
  // 변경이 예약 중에 끼어들어도 그 옛 state가 아니라 최신 state가 저장된다(2차 P1). 편집 직후
  // clearDraft가 오면 예약된 타이머 자체를 clearDraft가 직접 취소해 지운 키가 재생성되지 않는다.
  //
  // 지연 시간은 고정 AUTOSAVE_DEBOUNCE_MS가 아니라 AUTOSAVE_MAX_WAIT_MS 상한까지 남은 시간과 비교한
  // 더 짧은 쪽이다(#651 시나리오②) — 슬라이더 드래그처럼 dirtyTick이 쉬지 않고 오르면 매 tick마다
  // cleanup이 타이머를 지우고 새로 걸어, 고정 지연만으로는 드래그가 끝날 때까지 한 번도 안 걸린다.
  // firstDirtyAt을 기준으로 상한에 가까워질수록 지연이 짧아지므로, 드래그가 계속돼도 상한 시점에는
  // 반드시 저장이 걸린다.
  useEffect(() => {
    if (!autoSaveEnabled) {
      // 꺼져 있던 동안 흐른 시간이 firstDirtyAt에 그대로 쌓이면, 나중에 다시 켰을 때 그 정지
      // 시간까지 경과로 잡혀 remaining이 음수가 되고 재활성화 즉시 강제 저장이 걸려버린다 —
      // 여기서 리셋해야 다시 켰을 때 새 5초 창을 받는다.
      autoSaveFirstDirtyAtRef.current = null;
      return;
    }
    if (dirtyTick === 0) return;
    const now = Date.now();
    if (autoSaveFirstDirtyAtRef.current === null) autoSaveFirstDirtyAtRef.current = now;
    const remaining = AUTOSAVE_MAX_WAIT_MS - (now - autoSaveFirstDirtyAtRef.current);
    const delay = Math.max(0, Math.min(AUTOSAVE_DEBOUNCE_MS, remaining));
    const timer = setTimeout(() => {
      // 실패 시(#645 C1) 인디케이터를 안 반짝인다 — saveDraft 내부가 이미 showError로 알린다.
      if (saveDraftRef.current()) setLastSavedAt(Date.now());
      autoSaveTimerRef.current = null;
      autoSaveFirstDirtyAtRef.current = null;
    }, delay);
    autoSaveTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      // ref를 안 지우면 autoSaveEnabled를 끄는 순간(cleanup만 돌고 재예약은 안 됨) 죽은 타이머
      // ID가 그대로 남아, 아래 visibilitychange flush(#651)가 "대기 중"으로 오판해 꺼둔 자동저장을
      // 강행해버린다.
      autoSaveTimerRef.current = null;
    };
  }, [autoSaveEnabled, dirtyTick]);

  // 탭 이탈 flush(#651) — 마지막 편집 후 AUTOSAVE_DEBOUNCE_MS(1s) 안에 탭을 벗어나면(전환·닫기)
  // 위 디바운스 타이머가 아직 안 끝난 채로 페이지가 언마운트될 수 있어 그 편집분이 통째로
  // 유실된다. visibilitychange(hidden)는 언마운트보다 먼저 오므로, 대기 중인 타이머가 있으면
  // 기다리지 않고 즉시 saveDraftRef로 저장한다. autoSaveEnabled가 꺼져 있으면 애초에 타이머가
  // 없어 autoSaveTimerRef.current가 null이라 별도 게이팅이 필요 없다.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden' || !autoSaveTimerRef.current) return;
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
      autoSaveFirstDirtyAtRef.current = null;
      if (saveDraftRef.current()) setLastSavedAt(Date.now());
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // #310: 저장분 삭제 + 상태를 INITIAL_STATE로 되돌린다(파괴적 — 호출부에서 확인 UX를 거친다).
  // croppedImageUrl은 handleImageUpload의 revoke 패턴과 동일하게 교체 전 먼저 해제한다.
  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // 삭제 실패(프라이빗 모드 등)는 무시 — best-effort.
      }
    }
    void clearImages().catch(() => {
      // IndexedDB 삭제 실패(미지원·프라이빗 모드)는 무시 — best-effort.
    });
    // 편집 직후(디바운스 대기 중) clearDraft가 호출되는 경우, 예약된 자동저장이 옛 state로
    // 저장 키를 되살리지 못하게 직접 취소한다(claude-review PR #488 P1).
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    autoSaveFirstDirtyAtRef.current = null;
    // 복원 관련 상태도 전체 슬레이트 리셋 대상 — 안 하면 초기화 후 새로 업로드해도 "복원된 draft에
    // 포스터가 있었다"는 표시가 남아 isFirstUpload가 영구히 오판된다(#489).
    restoredDraftHadPosterRef.current = false;
    setAwaitingPosterRestore(false);
    // 초기화는 저장분을 지우는 것이므로 "복원된 세션"도 아니게 된다 — 안 되돌리면 랜딩이
    // 영영 안 뜨고, 포스터도 draft도 없는 빈 편집 셸에 남는다(#614). 첫 페인트 게이트(#675)도
    // 같은 명제를 CSS 쪽에서 들고 있으므로 나란히 거둔다 — 한쪽만 되돌리면 같은 빈 셸이 된다.
    setDraftRestored(false);
    clearDraftPaintGate();
    // 형압 편집 모드도 전체 슬레이트 리셋 대상 — 안 하면 초기화 후에도 브러시 레이어가 뜬 채 남는다.
    setEmbossEditMode(false);
    // 크롭 원본·모달 상태도 전체 슬레이트 리셋 — 원본 blob은 posterCrop의 revoke effect가 푼다.
    posterCrop.reset();
    // 이미지 지문도 리셋 — 안 하면 초기화 직후 저장(이미지 없음)이 "직전과 동일"로 오판돼
    // IndexedDB가 안 비워질 수 있다(claude-review PR #515 P1 fingerprint 최적화와의 상호작용).
    lastPersistedImageFingerprintRef.current = '';
    brightnessTouchedRef.current = false;
    // 초기화는 전체 슬레이트 리셋이라 강도 touched도 함께 되돌린다(#434 PR #472 리뷰 P1, #475 축분리) —
    // 안 하면 초기화 후 축을 바꿔도 그 축 기본 강도가 적용되지 않고 리셋 전 touched가 남는다.
    // (handleImageUpload은 강도를 의도적으로 유지하지만 clearDraft는 밝기와 대칭으로 리셋한다.)
    materialIntensityTouchedRef.current = false;
    coatingIntensityTouchedRef.current = false;
    // 로고·서명·배경은 소유 집합을 통째로 푼다 — 초기화는 히스토리도 같이 파기하므로(호출부가
    // useEditHistory.clear()를 잇달아 부른다) 과거 스냅샷만 쥐고 있던 URL까지 여기서 회수한다.
    // 예전엔 현재 상태의 4개만 풀어서, 그 사이 제거·교체된 옛 URL은 그대로 남았다(#673).
    // setState updater 밖에서 하는 이유는 prev에 안 기대기 때문(updateComponents의 ref 갱신과 동일).
    releaseAllOwnedBlobUrls();
    setState((prev) => {
      if (prev.croppedImageUrl) URL.revokeObjectURL(prev.croppedImageUrl);
      latestUrlRef.current = null;
      return INITIAL_STATE;
    });
  }, [posterCrop.reset, releaseAllOwnedBlobUrls]);

  useEffect(() => {
    return () => {
      if (latestUrlRef.current) URL.revokeObjectURL(latestUrlRef.current);
      // 현재값 4개가 아니라 소유 집합 전체 — 히스토리도 이 훅과 함께 죽으므로 과거 스냅샷만
      // 쥐고 있던 URL도 여기서 같이 회수한다(#673).
      releaseAllOwnedBlobUrls();
    };
  }, [releaseAllOwnedBlobUrls]);

  return {
    state,
    handleImageUpload,
    updateMovieInfo,
    fillEmptyMovieInfo,
    updateComponents,
    setRecommendedColors,
    addEmbossStamp,
    addEmbossPath,
    clearEmbossMask,
    setEmbossIntensity,
    embossEditMode,
    setEmbossEditMode,
    embossBrushRadius,
    setEmbossBrushRadius,
    embossTool,
    setEmbossTool,
    updateFieldVisibility,
    restoreSnapshot,
    releaseBlobUrlsOutsideHistory,
    saveDraft,
    clearDraft,
    autoSaveEnabled,
    lastSavedAt,
    toggleAutoSave,
    draftRestored,
    awaitingPosterRestore,
    // 포스터 크롭 파이프라인(#548) — 원본 objectURL·모달 상태의 단일 소유자. 셸/패널은 소비만 한다.
    posterCrop,
  };
}
