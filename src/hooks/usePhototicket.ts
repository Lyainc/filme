import { useState, useCallback, useEffect, useRef } from 'react';
import { PhototicketState, MovieInfo, TicketComponents, TicketField } from '@/types';
import { defaultBrightnessForTexture } from '@/components/moods/_shared';

export const ALL_FIELDS_ON: Record<TicketField, boolean> = {
  title: true,
  titleOg: true,
  actors: true,
  watchDate: true,
  watchTime: true,
  theater: true,
  screen: true,
  seat: true,
  runtime: true,
  rating: true,
  releaseDate: true,
  reissue: true,
  bookingNo: true,
  signature: true,
};

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
    rating: 5.0,
    runtime: '',
    bookingNumber: '',
    signature: '',
  },
  components: {
    layout: 'minimal',
    chain: '',
    format: '',
    texture: 'none',
    posterOpacity: 0.5,
    themeColor: '#FFFFFF',
    chainVisible: false,
    formatVisible: false,
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
    setState((prev) => {
      const nextComponents = { ...prev.components, ...components };
      latestChainUrlRef.current = nextComponents.chain.startsWith('blob:') ? nextComponents.chain : null;
      latestFormatUrlRef.current = nextComponents.format.startsWith('blob:') ? nextComponents.format : null;

      // #146 확정 b: texture 전환 시 그 texture의 기본 밝기를 적용 — 단, 사용자가 슬라이더로
      // 밝기를 직접 만진 적이 없을 때만(만진 뒤엔 그 값을 존중). posterOpacity가 이 업데이트에
      // 직접 실려오면 슬라이더 조작이므로 touched로 기록한다.
      if (components.posterOpacity !== undefined) {
        brightnessTouchedRef.current = true;
      } else if (
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
  };
}
