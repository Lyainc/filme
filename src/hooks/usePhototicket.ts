import { useState, useCallback, useEffect, useRef } from 'react';
import { PhototicketState, MovieInfo, TicketComponents, TicketField } from '@/types';

const ALL_FIELDS_ON: Record<TicketField, boolean> = {
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
  edition: true,
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
  edition: false,
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
    serialNo: '',
    collectionNo: '',
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

  const handleImageUpload = useCallback((croppedUrl: string) => {
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
