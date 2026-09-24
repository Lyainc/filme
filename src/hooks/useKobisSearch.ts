import { useEffect, useRef, useState } from 'react';
import type { KobisMovie, MovieInfo } from '@/types';
import { openDtToIso } from '@/utils/dateFormat';
import { extractKobisActorsRuntime } from '@/utils/kobisLookup';

/**
 * KOBIS 자동완성 검색의 공용 상태·부작용 코어 — 디바운스·abort·per-term 캐시·detail 경합
 * 가드를 한 곳에 둔다. FieldEditorBody의 TitleSheet와 InPlaceFieldEditor(데스크톱/모바일
 * 공용 본문)가 이 훅만 쓴다. 예전엔 데스크톱 전용 MovieInfoForm이 같은 로직을 따로 복제했고,
 * 그 drift가 #242의 onCompositionEnd 회귀를 낳았다(MovieInfoForm은 #479 이후 미사용 dead
 * code가 되어 제거됨).
 *
 * ARIA 키보드 내비(#198), 드롭다운 마크업 같은 표현 계층은 각 컴포넌트가 소유한다. 에러 문구는
 * #677 톤 정비로 이 훅이 기본값을 쥔다 — 호출부 둘이 같은 문자열을 각자 들고 있어 한쪽만 고치면
 * 같은 KOBIS 무매칭이 자리에 따라 다른 격으로 떴다(docs/COPY_TONE_GUIDE.md 축 3). 자리마다
 * 달라야 하면 `messages`로 덮어쓴다.
 */

export interface KobisSearchMessages {
  /** 빈 검색어로 명시 검색(버튼/Enter) 시 노출. 없으면 빈 검색은 조용히 무시. */
  empty?: string;
  noResults: string;
  requestFailed: string;
}

/** 축 3([무슨 일] + [다음 행동]) 기본 문구 — 덮어쓰지 않으면 이게 쓰인다. */
const DEFAULT_MESSAGES: KobisSearchMessages = {
  noResults: '검색 결과가 없어요. 제목을 다시 확인해 주세요.',
  requestFailed: '검색 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
};

export interface UseKobisSearchOptions {
  /** 기본 필드를 반영하고, 문서/영화 선택이 여전히 유효할 때만 보강하는 콜백을 반환한다. */
  apply: (patch: Partial<MovieInfo>) => (detail: Partial<MovieInfo>) => void;
  messages?: Partial<KobisSearchMessages>;
}

export interface UseKobisSearch {
  results: KobisMovie[];
  loading: boolean;
  error: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** 300ms 디바운스 후 검색. 빈 검색어면 드롭다운만 닫는다(무검색). */
  scheduleSearch: (term: string) => void;
  /** 디바운스 취소 후 즉시 검색 — 버튼/Enter용. */
  runSearch: (term: string) => void;
  /** 결과 선택 → 기본 필드 반영 + detail 경합 가드로 배우/러닝타임 보강. */
  selectMovie: (movie: KobisMovie) => void;
}

export function useKobisSearch({ apply, messages: overrides }: UseKobisSearchOptions): UseKobisSearch {
  const messages = { ...DEFAULT_MESSAGES, ...overrides };
  const [results, setResults] = useState<KobisMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const cacheRef = useRef<Map<string, KobisMovie[]>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 단조 증가 id — selectMovie의 async detail 응답이 더 최근 선택을 덮어쓰지 못하게 가드.
  const detailRunRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const clearDebounce = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  async function search(term: string) {
    if (!term) {
      // 명시 검색만 이 경로로 온다(디바운스는 scheduleSearch에서 빈 값을 걸러냄).
      if (messages.empty) {
        setError(messages.empty);
        setOpen(true);
      }
      return;
    }

    if (cacheRef.current.has(term)) {
      // in-flight fetch를 중단해 stale 응답이 캐시 결과를 덮지 못하게.
      abortRef.current?.abort();
      const cached = cacheRef.current.get(term)!;
      setResults(cached);
      setError(cached.length === 0 ? messages.noResults : '');
      // 캐시 히트 = 결과 확보. selectMovie의 detail이 아직 loading을 물고 있어도 내려서
      // 드롭다운이 결과 대신 Loading에 갇히지 않게(모바일 시트는 결과 표시를 loading에 게이팅).
      setLoading(false);
      setOpen(true);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    setOpen(true);

    try {
      const res = await fetch(`/api/kobis/search?movieNm=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      const list: KobisMovie[] = data.movieListResult?.movieList || [];
      cacheRef.current.set(term, list);
      setResults(list);
      if (list.length === 0) setError(messages.noResults);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      console.error('영화 검색 오류:', e);
      setError(messages.requestFailed);
      setResults([]);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }

  function scheduleSearch(term: string) {
    clearDebounce();
    if (!term) {
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => search(term), 300);
  }

  function runSearch(term: string) {
    clearDebounce();
    search(term);
  }

  async function selectMovie(movie: KobisMovie) {
    const iso = openDtToIso(movie.openDt);
    const applyDetail = apply({
      title: movie.movieNm,
      titleOg: movie.movieNmEn || '',
      releaseDate: iso,
      releaseDateGranularity: iso ? 'date' : undefined,
      movieCd: movie.movieCd,
    });
    setOpen(false);

    const runId = ++detailRunRef.current;
    try {
      setLoading(true);
      const res = await fetch(`/api/kobis/detail?movieCd=${movie.movieCd}`);
      if (detailRunRef.current !== runId) return; // stale — 더 최근 선택이 인수
      if (!res.ok) return;
      const data = await res.json();
      if (detailRunRef.current !== runId) return;
      const detail = data.movieInfoResult?.movieInfo;
      if (!detail) return;
      const { actors, runtime } = extractKobisActorsRuntime(detail);
      applyDetail({ actors, ...(runtime ? { runtime } : {}) });
    } catch (e) {
      console.error('영화 상세 정보 검색 오류:', e);
    } finally {
      // 최신 선택만 loading 플래그를 내린다.
      if (detailRunRef.current === runId) {
        setLoading(false);
      }
    }
  }

  return { results, loading, error, open, setOpen, scheduleSearch, runSearch, selectMovie };
}
