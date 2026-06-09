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

  // 의도적으로 phase=1로 시작해 SSR(window 없음 → 1)과 첫 클라 렌더를 일치시킨다.
  // 마운트 후 effect에서 sessionStorage를 읽어 갱신 → 하이드레이션 미스매치 방지.
  // ⚠️ useState(() => migrateAndReadPhase()) 레이지 이니셜라이저로 바꾸지 말 것:
  //    클라 초기 렌더가 저장된 phase=2를 읽으면 서버 HTML(1)과 어긋나 미스매치가 난다.
  // persistence는 아래 effect에서 hydrated 게이트로 막아 두 effect 간 경쟁도 없다.
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

  // setPhase는 React가 보장하는 안정 참조 — 래핑 useCallback 불필요.
  const goTo = setPhase;

  return { phase, hydrated, goTo, canAdvance };
}
