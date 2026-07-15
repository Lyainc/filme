import { useState, useCallback, useEffect, useRef } from 'react';
import { PhototicketState, MovieInfo, TicketComponents, TicketField } from '@/types';
import { defaultBrightnessForTexture } from '@/components/moods/_shared';
import { ALL_FIELDS_ON } from '@/constants/fieldVisibility';

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
};

// 영속화 키 — 스키마가 깨지게 바뀌면 버전을 올려 옛 데이터를 자연히 무시한다(복원 시 키 불일치 → null).
const STORAGE_KEY = 'filme:phototicket:v1';

// 텍스트·설정만 영속화한다. 포스터(croppedImageUrl)는 objectURL이라 세션이 끝나면 무효라 제외하고,
// recommendedColors는 포스터에서 재추출되므로 제외한다(#178).
type PersistedState = Pick<PhototicketState, 'movieInfo' | 'components' | 'fieldVisibility'>;

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
  },
  components: {
    layout: 'minimal',
    chain: '',
    format: '',
    chainLabel: '',
    formatLabel: '',
    texture: 'none',
    posterOpacity: 0.5,
    componentOpacity: 1,
    themeColor: '#FFFFFF',
    // #141 (8): 로고는 기본 ON — 텍스트 라벨/이미지가 없으면 dashed placeholder(미리보기 전용)로 입력을 유도한다.
    chainVisible: true,
    formatVisible: true,
  },
  recommendedColors: [],
  croppedImageUrl: null,
  fieldVisibility: ALL_FIELDS_ON,
};

export function usePhototicket() {
  const [state, setState] = useState<PhototicketState>(INITIAL_STATE);
  const latestUrlRef = useRef<string | null>(null);
  // chain/format은 picker가 교체 시점에만 revoke하므로, 언마운트 정리를 위해
  // 상태 소유자(hook)가 마지막 blob URL을 추적한다 (latestUrlRef와 동일 패턴).
  const latestChainUrlRef = useRef<string | null>(null);
  const latestFormatUrlRef = useRef<string | null>(null);
  // 사용자가 밝기 슬라이더를 직접 만졌는지 추적(#146). 한번 만지면 이후 texture 전환에서
  // 기본 밝기를 덮어쓰지 않고 사용자 값을 존중한다.
  const brightnessTouchedRef = useRef(false);

  // 마운트 시 localStorage에서 텍스트·설정을 복원한다. SSR 하이드레이션 불일치를 피하려
  // useState 초기화가 아니라 effect에서 한다(서버는 INITIAL_STATE로 렌더, 클라가 마운트 후 복원).
  // 얕은 병합이라 누락/추가 필드는 INITIAL_STATE 기본값으로 자연히 메워진다(#178).
  useEffect(() => {
    const saved = loadPersisted();
    if (!saved) return;
    // 저장된 밝기가 기본값과 다르면 사용자가 만진 값이므로 touched로 표시한다 — 안 그러면
    // brightnessTouchedRef(false)가 복원 직후 첫 texture 전환에서 그 texture 기본 밝기로
    // 저장된 값을 덮어쓴다(#178 리뷰 P1). ref라 영속화엔 안 들어가 복원 시 따로 복구.
    if (
      saved.components?.posterOpacity !== undefined &&
      saved.components.posterOpacity !== INITIAL_STATE.components.posterOpacity
    ) {
      brightnessTouchedRef.current = true;
    }
    setState((prev) => ({
      ...prev,
      movieInfo: { ...prev.movieInfo, ...(saved.movieInfo ?? {}) },
      components: { ...prev.components, ...(saved.components ?? {}) },
      fieldVisibility: { ...prev.fieldVisibility, ...(saved.fieldVisibility ?? {}) },
    }));
  }, []);

  const handleImageUpload = useCallback((croppedUrl: string) => {
    // 새 포스터 업로드는 밝기 슬레이트를 초기화한다 — 이후 texture 전환에서 그 texture의
    // 기본 밝기가 다시 적용된다(#146 리뷰). fieldVisibility(첫 업로드에만 리셋)와 달리
    // 밝기는 포스터 콘텐츠(어두운/밝은 포스터)에 종속적이라 매 업로드마다 리셋한다.
    brightnessTouchedRef.current = false;
    setState((prev) => {
      if (prev.croppedImageUrl) URL.revokeObjectURL(prev.croppedImageUrl);
      latestUrlRef.current = croppedUrl;
      const isFirstUpload = prev.croppedImageUrl === null;
      return {
        ...prev,
        croppedImageUrl: croppedUrl,
        ...(isFirstUpload ? { fieldVisibility: DEFAULT_VISIBILITY_ON_UPLOAD } : {}),
      };
    });
  }, []);

  const updateFieldVisibility = useCallback((partial: Partial<Record<TicketField, boolean>>) => {
    setState((prev) => ({
      ...prev,
      fieldVisibility: { ...prev.fieldVisibility, ...partial },
    }));
  }, []);

  const updateMovieInfo = useCallback((info: Partial<MovieInfo>) => {
    setState((prev) => ({ ...prev, movieInfo: { ...prev.movieInfo, ...info } }));
  }, []);

  const updateComponents = useCallback((components: Partial<TicketComponents>) => {
    // posterOpacity가 직접 실려오면 슬라이더 조작이므로 touched로 기록한다. ref 뮤테이션은
    // setState updater 밖에서 한다 — updater는 순수해야 하고(StrictMode 이중 호출), 이 갱신은
    // prev에 의존하지 않으므로 바깥이 맞다(latestUrlRef 패턴과 동일).
    if (components.posterOpacity !== undefined) {
      brightnessTouchedRef.current = true;
    }
    setState((prev) => {
      const nextComponents = { ...prev.components, ...components };
      latestChainUrlRef.current = nextComponents.chain.startsWith('blob:') ? nextComponents.chain : null;
      latestFormatUrlRef.current = nextComponents.format.startsWith('blob:') ? nextComponents.format : null;

      // #146 확정 b: texture 전환 시 그 texture의 기본 밝기를 적용 — 단, 슬라이더를 직접 만진
      // 적이 없고(touched=false) posterOpacity가 이 업데이트에 실려오지 않았을 때만.
      if (
        components.posterOpacity === undefined &&
        components.texture !== undefined &&
        components.texture !== prev.components.texture &&
        !brightnessTouchedRef.current
      ) {
        nextComponents.posterOpacity = defaultBrightnessForTexture(components.texture);
      }

      return { ...prev, components: nextComponents };
    });
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
    // touched도 스냅샷 시점 기준으로 재유도(#178의 loadPersisted 패턴, PR #361 리뷰 P1) —
    // 안 하면 밝기 조작 이전 시점으로 undo해도 ref가 true로 남아, 이후 texture 전환에서
    // 그 texture 기본 밝기 적용이 스킵된다.
    brightnessTouchedRef.current =
      snap.components.posterOpacity !== defaultBrightnessForTexture(snap.components.texture);
    setState((prev) => ({
      ...prev,
      movieInfo: snap.movieInfo,
      components: snap.components,
      fieldVisibility: snap.fieldVisibility,
    }));
  }, []);

  // #310: 자동저장(디바운스 effect) 폐지 — 명시적 트리거(버튼 클릭) 1회성이라 디바운스가 불필요하다.
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
        },
        fieldVisibility: state.fieldVisibility,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 저장 실패(쿼터 초과·프라이빗 모드)는 무시 — 영속화는 best-effort다.
    }
  }, [state.movieInfo, state.components, state.fieldVisibility]);

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
    brightnessTouchedRef.current = false;
    setState((prev) => {
      if (prev.croppedImageUrl) URL.revokeObjectURL(prev.croppedImageUrl);
      latestUrlRef.current = null;
      // chain/format 로고도 poster와 동일하게 처리 — 안 하면 blob이 탭 닫힐 때까지 안 풀린다.
      if (prev.components.chain.startsWith('blob:')) URL.revokeObjectURL(prev.components.chain);
      if (prev.components.format.startsWith('blob:')) URL.revokeObjectURL(prev.components.format);
      latestChainUrlRef.current = null;
      latestFormatUrlRef.current = null;
      return INITIAL_STATE;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (latestUrlRef.current) URL.revokeObjectURL(latestUrlRef.current);
      if (latestChainUrlRef.current) URL.revokeObjectURL(latestChainUrlRef.current);
      if (latestFormatUrlRef.current) URL.revokeObjectURL(latestFormatUrlRef.current);
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
  };
}
