import { useState, useCallback, useEffect, useRef } from 'react';
import { PhototicketState, MovieInfo, TicketComponents } from '@/types';

const INITIAL_STATE: PhototicketState = {
  croppedImageUrl: null,
  movieInfo: {
    title: '',
    titleOg: '',
    actors: '',
    releaseDate: '',
    watchDate: '',
    theater: '',
    screen: '',
    seat: '',
    rating: 5.0,
    showRating: true,
  },
  components: {
    chain: '',
    format: '',
    texture: 'none',
    posterOpacity: 0.5,
    themeColor: '#FFFFFF',
  },
  recommendedColors: [],
};

export function usePhototicket() {
  const [state, setState] = useState<PhototicketState>(INITIAL_STATE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [debouncedState, setDebouncedState] = useState<PhototicketState>(state);
  const latestUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedState(state), 300);
    return () => clearTimeout(handler);
  }, [state]);

  const handleImageUpload = useCallback((croppedUrl: string) => {
    setIsProcessing(true);
    setState((prev) => {
      if (prev.croppedImageUrl) URL.revokeObjectURL(prev.croppedImageUrl);
      latestUrlRef.current = croppedUrl;
      return { ...prev, croppedImageUrl: croppedUrl };
    });
    setIsProcessing(false);
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
    debouncedState,
    isProcessing,
    handleImageUpload,
    updateMovieInfo,
    updateComponents,
    setRecommendedColors,
  };
}
