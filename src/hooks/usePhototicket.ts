import { useState, useCallback, useEffect } from 'react';
import { PhototicketState, MovieInfo, TicketComponents } from '@/types';
import { cropImage } from '@/utils/imageCrop';

export function usePhototicket() {
  const [state, setState] = useState<PhototicketState>({
    croppedImageUrl: null,
    movieInfo: {
      title: '',
      watchDate: '',
      theater: '',
      screen: '',
      seat: '',
    },
    components: {
      chain: '',
      format: '',
      texture: 'none',
    },
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

  // Handle image upload with memory optimization
  const handleImageUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const croppedUrl = await cropImage(file);
      setState((prev) => ({ ...prev, croppedImageUrl: croppedUrl }));
    } catch (error) {
      console.error('이미지 처리 실패:', error);
      alert('이미지 처리에 실패했습니다.');
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
  };
}
