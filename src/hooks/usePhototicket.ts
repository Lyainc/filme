import { useState, useCallback, useEffect, useRef } from 'react';
import { PhototicketState, MovieInfo, TicketComponents } from '@/types';

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
    showRating: true,
    runtime: '',
    bookingNumber: '',
  },
  components: {
    layout: 'minimal',
    chain: '',
    format: '',
    texture: 'none',
    posterOpacity: 0.5,
    themeColor: '#FFFFFF',
    textureIntensity: 0.65,
    vignette: 0.3,
    temperature: 0,
    grain: 0.25,
    genreFinish: true,
  },
  recommendedColors: [],
  croppedImageUrl: null,
};

export function usePhototicket() {
  const [state, setState] = useState<PhototicketState>(INITIAL_STATE);
  const latestUrlRef = useRef<string | null>(null);

  const handleImageUpload = useCallback((croppedUrl: string) => {
    setState((prev) => {
      if (prev.croppedImageUrl) URL.revokeObjectURL(prev.croppedImageUrl);
      latestUrlRef.current = croppedUrl;
      return { ...prev, croppedImageUrl: croppedUrl };
    });
  }, []);

  const updateMovieInfo = useCallback((info: Partial<MovieInfo>) => {
    setState((prev) => ({ ...prev, movieInfo: { ...prev.movieInfo, ...info } }));
  }, []);

  const updateComponents = useCallback((components: Partial<TicketComponents>) => {
    setState((prev) => ({ ...prev, components: { ...prev.components, ...components } }));
  }, []);

  const setRecommendedColors = useCallback((colors: string[]) => {
    setState((prev) => ({ ...prev, recommendedColors: colors }));
  }, []);

  useEffect(() => {
    return () => {
      if (latestUrlRef.current) URL.revokeObjectURL(latestUrlRef.current);
    };
  }, []);

  return {
    state,
    handleImageUpload,
    updateMovieInfo,
    updateComponents,
    setRecommendedColors,
  };
}
