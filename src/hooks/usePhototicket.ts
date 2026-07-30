import { useState, useCallback, useEffect, useRef } from 'react';
import { PhototicketState, MovieInfo, TicketComponents, TicketField } from '@/types';
import { defaultBrightnessForTexture } from '@/components/moods/_shared';
import { defaultIntensityForTexture, migrateLegacyComponents } from '@/utils/textureRecipes';
import { ALL_FIELDS_ON } from '@/constants/fieldVisibility';
import { saveImages, loadImages, clearImages } from '@/utils/imageDb';
import { usePosterCrop } from '@/hooks/usePosterCrop';

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
const STORAGE_KEY = 'filme:phototicket:v1';

// 자동저장 on/off는 문서(STORAGE_KEY)가 아니라 UI 취향값이라 별도 키로 영속(TB_STORAGE_KEY 선례, #436).
const AUTOSAVE_PREF_KEY = 'filme:autosave:v1';
// 프리뷰 디바운스(280ms, index.tsx)보다 느슨하게 — 저장은 프리뷰만큼 즉각적일 필요가 없다(#436).
const AUTOSAVE_DEBOUNCE_MS = 1000;

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
};

export function usePhototicket() {
  const [state, setState] = useState<PhototicketState>(INITIAL_STATE);
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
    if (!saved) return;
    setDraftRestored(true);
    // 복원된 draft에 포스터가 있었다는 표시 — handleImageUpload의 isFirstUpload 판정이 이걸로
    // 게이트된다(#489 서브버그: IDB 이미지 복원이 실패해도 croppedImageUrl은 null인 채로
    // 재업로드를 유도하는데, 그 재업로드를 "첫 업로드"로 오판해 방금 복원한 fieldVisibility를
    // 리셋하면 안 된다). 텍스트만 있던 draft(hadPoster=false/undefined)는 그대로 첫 업로드로
    // 취급해 DEFAULT_VISIBILITY_ON_UPLOAD가 정상 적용되게 한다(claude-review PR #515 P1).
    restoredDraftHadPosterRef.current = saved.hadPoster === true;
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
        const componentsPatch: Partial<TicketComponents> = {};
        if (images.chain) {
          const url = URL.createObjectURL(images.chain);
          latestChainUrlRef.current = url;
          componentsPatch.chain = url;
        }
        if (images.format) {
          const url = URL.createObjectURL(images.format);
          latestFormatUrlRef.current = url;
          componentsPatch.format = url;
        }
        if (images.signature) {
          const url = URL.createObjectURL(images.signature);
          latestSignatureUrlRef.current = url;
          componentsPatch.signatureImage = url;
        }
        const posterUrl = images.poster ? URL.createObjectURL(images.poster) : null;
        if (posterUrl) latestUrlRef.current = posterUrl;
        // 크롭 원본 복원(#489) — 크롭 파이프라인(posterCrop)이 이 URL의 단일 소유자이고,
        // saveDraft도 거기서 읽어 다음 저장에 다시 실어보낸다(안 하면 복원 직후 첫 자동저장이
        // 원본을 빈 값으로 갈아치워 IndexedDB에서 지운다). seedOriginal은 이미 원본이 있으면
        // 무시하므로, 이 비동기 복원이 그 사이 사용자가 올린 포스터를 덮어쓰지 않는다.
        if (images.posterOriginal) {
          seedOriginalRef.current(URL.createObjectURL(images.posterOriginal));
        }
        if (posterUrl || Object.keys(componentsPatch).length > 0) {
          setState((prev) => ({
            ...prev,
            ...(posterUrl ? { croppedImageUrl: posterUrl } : {}),
            components: { ...prev.components, ...componentsPatch },
          }));
        }
      })
      .catch(() => {
        // IndexedDB 미지원·프라이빗 모드·용량 초과 — 무시하고 현재 lossy 동작으로 폴백.
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
      latestChainUrlRef.current = nextComponents.chain.startsWith('blob:') ? nextComponents.chain : null;
      latestFormatUrlRef.current = nextComponents.format.startsWith('blob:') ? nextComponents.format : null;
      latestSignatureUrlRef.current = nextComponents.signatureImage?.startsWith('blob:') ? nextComponents.signatureImage : null;

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

      return { ...prev, components: nextComponents };
    });
    setDirtyTick((t) => t + 1);
  }, []);

  const setRecommendedColors = useCallback((colors: string[]) => {
    setState((prev) => ({ ...prev, recommendedColors: colors }));
  }, []);

  // undo/redo(#356) 복원 전용 경로 — updateComponents를 거치지 않는다. 거치면 posterOpacity가
  // 항상 실려와 brightnessTouchedRef가 오염되고 texture 기본 밝기 로직이 스냅샷을 덮는다.
  // 언마운트 revoke 대상 ref만 복원된 로고에 맞춰 갱신한다.
  const restoreSnapshot = useCallback((snap: HistorySnapshot) => {
    latestChainUrlRef.current = snap.components.chain.startsWith('blob:') ? snap.components.chain : null;
    latestFormatUrlRef.current = snap.components.format.startsWith('blob:') ? snap.components.format : null;
    latestSignatureUrlRef.current = snap.components.signatureImage?.startsWith('blob:') ? snap.components.signatureImage : null;
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

  // #310이 폐지했던 자동저장을 #436이 enabled 게이트 뒤에 되살린다 — 명시적 트리거(버튼 클릭)는 그대로 유지.
  const saveDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
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
        },
        fieldVisibility: state.fieldVisibility,
        hadPoster: state.croppedImageUrl !== null,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 저장 실패(쿼터 초과·프라이빗 모드)는 무시 — 영속화는 best-effort다.
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
    const fingerprint = [
      state.croppedImageUrl,
      posterCrop.originalSrc,
      state.components.chain,
      state.components.format,
      state.components.signatureImage,
    ].join('|');
    if (fingerprint !== lastPersistedImageFingerprintRef.current) {
      imagePersistChainRef.current = imagePersistChainRef.current.then(async () => {
        try {
          const [poster, posterOriginal, chain, format, signature] = await Promise.all([
            blobUrlToBlob(state.croppedImageUrl),
            blobUrlToBlob(posterCrop.originalSrc),
            blobUrlToBlob(state.components.chain),
            blobUrlToBlob(state.components.format),
            blobUrlToBlob(state.components.signatureImage),
          ]);
          await saveImages({ poster, posterOriginal, chain, format, signature });
          lastPersistedImageFingerprintRef.current = fingerprint;
        } catch {
          // IndexedDB 미지원·프라이빗 모드·용량 초과 — 무시. fingerprint를 안 갱신해 다음
          // 저장 시도에서 다시 시도한다.
        }
      });
    }
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
  useEffect(() => {
    if (!autoSaveEnabled || dirtyTick === 0) return;
    const timer = setTimeout(() => {
      saveDraftRef.current();
      setLastSavedAt(Date.now());
      autoSaveTimerRef.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);
    autoSaveTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [autoSaveEnabled, dirtyTick]);

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
    // 복원 관련 상태도 전체 슬레이트 리셋 대상 — 안 하면 초기화 후 새로 업로드해도 "복원된 draft에
    // 포스터가 있었다"는 표시가 남아 isFirstUpload가 영구히 오판된다(#489).
    restoredDraftHadPosterRef.current = false;
    // 초기화는 저장분을 지우는 것이므로 "복원된 세션"도 아니게 된다 — 안 되돌리면 랜딩이
    // 영영 안 뜨고, 포스터도 draft도 없는 빈 편집 셸에 남는다(#614).
    setDraftRestored(false);
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
    setState((prev) => {
      if (prev.croppedImageUrl) URL.revokeObjectURL(prev.croppedImageUrl);
      latestUrlRef.current = null;
      // chain/format 로고도 poster와 동일하게 처리 — 안 하면 blob이 탭 닫힐 때까지 안 풀린다.
      if (prev.components.chain.startsWith('blob:')) URL.revokeObjectURL(prev.components.chain);
      if (prev.components.format.startsWith('blob:')) URL.revokeObjectURL(prev.components.format);
      if (prev.components.signatureImage?.startsWith('blob:')) URL.revokeObjectURL(prev.components.signatureImage);
      latestChainUrlRef.current = null;
      latestFormatUrlRef.current = null;
      latestSignatureUrlRef.current = null;
      return INITIAL_STATE;
    });
  }, [posterCrop.reset]);

  useEffect(() => {
    return () => {
      if (latestUrlRef.current) URL.revokeObjectURL(latestUrlRef.current);
      if (latestChainUrlRef.current) URL.revokeObjectURL(latestChainUrlRef.current);
      if (latestFormatUrlRef.current) URL.revokeObjectURL(latestFormatUrlRef.current);
      if (latestSignatureUrlRef.current) URL.revokeObjectURL(latestSignatureUrlRef.current);
    };
  }, []);

  return {
    state,
    handleImageUpload,
    updateMovieInfo,
    updateComponents,
    setRecommendedColors,
    updateFieldVisibility,
    restoreSnapshot,
    saveDraft,
    clearDraft,
    autoSaveEnabled,
    lastSavedAt,
    toggleAutoSave,
    draftRestored,
    // 포스터 크롭 파이프라인(#548) — 원본 objectURL·모달 상태의 단일 소유자. 셸/패널은 소비만 한다.
    posterCrop,
  };
}
