import { openDtToIso } from '@/utils/dateFormat';
import type { MovieInfo } from '@/types';

interface KobisNation {
  nationNm: string;
}

interface KobisActor {
  peopleNm: string;
  peopleNmEn: string;
}

interface KobisMovieInfo {
  nations?: KobisNation[];
  actors?: KobisActor[];
  showTm?: string;
}

interface KobisListMovie {
  movieCd: string;
  movieNm: string;
  movieNmEn: string;
  openDt: string;
}

/**
 * Look up a movie title via the KOBIS search + detail APIs.
 *
 * - Exactly 1 result  → full enrichment: title, titleOg, releaseDate, actors, runtime
 * - 0 or 2+ results  → { title } only; detail is NOT fetched (overkill-match guard)
 *
 * Mirrors the search→detail logic in MovieInfoForm.handleSelectMovie without
 * touching that component. Never throws; returns { title } on any fetch failure.
 */
export async function triggerKobisLookup(title: string): Promise<Partial<MovieInfo>> {
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

    // Replicate MovieInfoForm.tsx:140-146 actors extraction exactly
    const isKorean = info.nations?.some((n) => n.nationNm === '한국') ?? false;
    const actors =
      info.actors
        ?.map((a) => (!isKorean && a.peopleNmEn ? a.peopleNmEn : a.peopleNm))
        .filter(Boolean)
        .join(', ') ?? '';

    const runtime = info.showTm ? `${info.showTm} MIN` : '';

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
