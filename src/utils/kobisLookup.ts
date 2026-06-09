import { openDtToIso } from '@/utils/dateFormat';
import type { MovieInfo } from '@/types';

interface KobisNation {
  nationNm: string;
}

interface KobisActor {
  peopleNm: string;
  peopleNmEn: string;
}

export interface KobisMovieInfo {
  nations?: KobisNation[];
  actors?: KobisActor[];
  showTm?: string;
}

/**
 * KOBIS movie detail → 티켓용 actors/runtime 문자열.
 *
 * - actors: 비한국 영화면 영문명(peopleNmEn) 우선, 없으면 한글명. 한국 영화는 한글명.
 *   빈 항목은 제외(filter)해 ", ," 잔재를 막는다.
 * - runtime: showTm이 있으면 "NN MIN".
 *
 * triggerKobisLookup과 MovieInfoForm.handleSelectMovie 양쪽이 호출 — 추출 규칙을
 * 한 곳에서만 관리한다.
 */
export function extractKobisActorsRuntime(info: KobisMovieInfo): { actors: string; runtime: string } {
  const isKorean = info.nations?.some((n) => n.nationNm === '한국') ?? false;
  const actors =
    info.actors
      ?.map((a) => (!isKorean && a.peopleNmEn ? a.peopleNmEn : a.peopleNm))
      .filter(Boolean)
      .join(', ') ?? '';
  const runtime = info.showTm ? `${info.showTm} MIN` : '';
  return { actors, runtime };
}

interface KobisListMovie {
  movieCd: string;
  movieNm: string;
  movieNmEn: string;
  openDt: string;
}

/**
 * title → in-flight/완료된 lookup Promise. 동일 티켓 재업로드나 동시 호출 시
 * search+detail 재실행을 막는다(모듈 스코프 dedup). 검색 실패/무매치({ title }만
 * 반환)는 캐시에 남기지 않아 재시도를 허용한다.
 */
const lookupCache = new Map<string, Promise<Partial<MovieInfo>>>();

/** 테스트/리셋용 — dedup 캐시 비우기. */
export function clearKobisLookupCache(): void {
  lookupCache.clear();
}

/**
 * Look up a movie title via the KOBIS search + detail APIs.
 *
 * - Exactly 1 result  → full enrichment: title, titleOg, releaseDate, actors, runtime
 * - 0 or 2+ results  → { title } only; detail is NOT fetched (overkill-match guard)
 *
 * Shares actors/runtime extraction with MovieInfoForm.handleSelectMovie via
 * extractKobisActorsRuntime. Never throws; returns { title } on any fetch failure.
 *
 * 모듈 스코프 dedup: 같은 title은 in-flight/완료 Promise를 재사용.
 */
export function triggerKobisLookup(title: string): Promise<Partial<MovieInfo>> {
  const cached = lookupCache.get(title);
  if (cached) return cached;

  const promise = fetchKobisLookup(title).then((result) => {
    // enrichment 없이 title만 돌아온 경우(실패·무매치·다중매치)는 캐시에서 제거 → 재시도 허용
    if (Object.keys(result).length <= 1) lookupCache.delete(title);
    return result;
  });
  lookupCache.set(title, promise);
  return promise;
}

async function fetchKobisLookup(title: string): Promise<Partial<MovieInfo>> {
  try {
    const searchRes = await fetch(`/api/kobis/search?movieNm=${encodeURIComponent(title)}`);
    if (!searchRes.ok) return { title };

    const searchData = await searchRes.json();
    const list: KobisListMovie[] = searchData.movieListResult?.movieList ?? [];

    if (list.length !== 1) {
      // Multi-match or no-match: hand title to the user for manual search
      return { title };
    }

    const movie = list[0];
    // titleOg and releaseDate come from the search result, not detail
    const titleOg = movie.movieNmEn || '';
    const releaseDate = openDtToIso(movie.openDt);

    const detailRes = await fetch(`/api/kobis/detail?movieCd=${movie.movieCd}`);
    if (!detailRes.ok) {
      const partial: Partial<MovieInfo> = { title };
      if (titleOg) partial.titleOg = titleOg;
      if (releaseDate) partial.releaseDate = releaseDate;
      return partial;
    }

    const detailData = await detailRes.json();
    const info: KobisMovieInfo = detailData.movieInfoResult?.movieInfo ?? {};

    const { actors, runtime } = extractKobisActorsRuntime(info);

    const result: Partial<MovieInfo> = { title };
    if (titleOg) result.titleOg = titleOg;
    if (releaseDate) result.releaseDate = releaseDate;
    if (actors) result.actors = actors;
    if (runtime) result.runtime = runtime;

    return result;
  } catch {
    return { title };
  }
}
