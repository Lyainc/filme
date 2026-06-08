import { useCallback, useEffect, useState } from 'react';
import type { PhototicketState } from '@/types';

export type Phase = 1 | 2;

const PHASE_KEY = 'phototicket:phase';
const LEGACY_STEP_KEY = 'phototicket:step';

export interface CanAdvance1Params {
  hasPoster: boolean;
  title: string;
  titleOg: string;
  releaseDate: string | undefined;
  pendingFetch: boolean;
}

export function canAdvance1({
  hasPoster,
  title,
  titleOg,
  releaseDate,
  pendingFetch,
}: CanAdvance1Params): boolean {
  if (pendingFetch) return false;
  const release = (releaseDate ?? '').trim();
  return (
    hasPoster &&
    title.trim().length > 0 &&
    titleOg.trim().length > 0 &&
    release.length >= 4
  );
}

function migrateAndReadPhase(): Phase {
  if (typeof window === 'undefined') return 1;
  try {
    const stored = window.sessionStorage.getItem(PHASE_KEY);
    if (stored === '1' || stored === '2') return Number(stored) as Phase;

    const legacyStep = window.sessionStorage.getItem(LEGACY_STEP_KEY);
    const step = legacyStep == null ? null : Number(legacyStep);
    const phase: Phase = step != null && step >= 3 ? 2 : 1;

    window.sessionStorage.removeItem(LEGACY_STEP_KEY);
    window.sessionStorage.setItem(PHASE_KEY, String(phase));
    return phase;
  } catch {
    return 1;
  }
}

export interface UsePhaseOptions {
  state: PhototicketState;
  pendingFetch: boolean;
}

export interface UsePhase {
  phase: Phase;
  hydrated: boolean;
  goTo: (phase: Phase) => void;
  canAdvance: (phase: Phase) => boolean;
}

export function usePhase({ state, pendingFetch }: UsePhaseOptions): UsePhase {
  const [phase, setPhase] = useState<Phase>(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPhase(migrateAndReadPhase());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(PHASE_KEY, String(phase));
    } catch {
      /* sessionStorage unavailable */
    }
  }, [phase, hydrated]);

  const canAdvance = useCallback(
    (p: Phase): boolean => {
      if (p === 1) {
        return canAdvance1({
          hasPoster: !!state.croppedImageUrl,
          title: state.movieInfo.title,
          titleOg: state.movieInfo.titleOg,
          releaseDate: state.movieInfo.releaseDate,
          pendingFetch,
        });
      }
      return false;
    },
    [
      state.croppedImageUrl,
      state.movieInfo.title,
      state.movieInfo.titleOg,
      state.movieInfo.releaseDate,
      pendingFetch,
    ]
  );

  const goTo = useCallback((target: Phase) => {
    setPhase(target);
  }, []);

  return { phase, hydrated, goTo, canAdvance };
}
