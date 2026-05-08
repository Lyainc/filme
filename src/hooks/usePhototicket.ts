import { useState, useCallback, useEffect } from 'react';
import { PhototicketState, MovieInfo, TicketComponents } from '@/types';

export function usePhototicket() {
  const [state, setState] = useState<PhototicketState>({
    croppedImageUrl: null,
    movieInfo: {
      title: '',
      watchDate: '',
      theater: '',
      screen: '',
      seat: '',
      rating: 5,
    },
    components: {
      chain: '',
      format: '',
      texture: 'none',
      posterOpacity: 0.8,
      themeColor: '#FFFFFF',
    },
    recommendedColors: [],
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Debounced state for canvas rendering performance
  const [debouncedState, setDebouncedState] = useState<PhototicketState>(state);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedState(state);
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [state]);

  // Handle image upload from UI cropped result
  const handleImageUpload = useCallback((croppedUrl: string) => {
    setIsProcessing(true);
    try {
      setState((prev) => {
        // 이전 이미지가 있다면 메모리 해제
        if (prev.croppedImageUrl) {
          URL.revokeObjectURL(prev.croppedImageUrl);
        }
        return { ...prev, croppedImageUrl: croppedUrl };
      });
    } catch (error) {
      console.error('이미지 상태 업데이트 실패:', error);
      alert('이미지 설정에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Update movie info
  const updateMovieInfo = useCallback((info: Partial<MovieInfo>) => {
    setState((prev) => ({
      ...prev,
      movieInfo: { ...prev.movieInfo, ...info },
    }));
  }, []);

  // Update components
  const updateComponents = useCallback((components: Partial<TicketComponents>) => {
    setState((prev) => ({
      ...prev,
      components: { ...prev.components, ...components },
    }));
  }, []);

  // Set recommended colors
  const setRecommendedColors = useCallback((colors: string[]) => {
    setState((prev) => ({
      ...prev,
      recommendedColors: colors,
    }));
  }, []);

  // Cleanup Object URLs on unmount
  useEffect(() => {
    return () => {
      if (state.croppedImageUrl) {
        URL.revokeObjectURL(state.croppedImageUrl);
      }
    };
  }, [state.croppedImageUrl]);

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
