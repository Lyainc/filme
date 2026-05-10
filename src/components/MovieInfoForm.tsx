import { useState, useRef, useEffect, useCallback } from 'react';
import { MovieInfo, KobisMovie } from '@/types';
import Field from './ui/Field';

interface MovieInfoFormProps {
  movieInfo: MovieInfo;
  onChange: (info: Partial<MovieInfo>) => void;
  /** Reports KOBIS detail-fetch in-flight state so a parent wizard can gate "Next" */
  onPendingFetchChange?: (pending: boolean) => void;
}

/**
 * Required-fields form: Title (with KOBIS lookup), Watched, Theater.
 * Optional fields are rendered separately by OptionalDetailsAccordion in the wizard.
 */
export default function MovieInfoForm({
  movieInfo,
  onChange,
  onPendingFetchChange,
}: MovieInfoFormProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<KobisMovie[]>([]);
  const [searchError, setSearchError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onPendingFetchChange?.(isFetchingDetail);
  }, [isFetchingDetail, onPendingFetchChange]);

  useEffect(() => {
    return () => onPendingFetchChange?.(false);
  }, [onPendingFetchChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!movieInfo.title.trim()) {
      setSearchError('검색할 영화 제목을 입력해주세요.');
      setShowResults(true);
      return;
    }
    setIsSearching(true);
    setSearchError('');
    setShowResults(true);
    try {
      const res = await fetch(
        `/api/kobis/search?movieNm=${encodeURIComponent(movieInfo.title.trim())}`
      );
      if (!res.ok) throw new Error('API 요청 실패');
      const data = await res.json();
      const list = data.movieListResult?.movieList || [];
      setSearchResults(list);
      if (list.length === 0) setSearchError('검색 결과가 없습니다.');
    } catch (error) {
      console.error('영화 검색 오류:', error);
      setSearchError('영화를 검색하는 중 문제가 발생했습니다.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [movieInfo.title]);

  const handleSelectMovie = async (movie: KobisMovie) => {
    onChange({
      title: movie.movieNm,
      titleOg: movie.movieNmEn || '',
      releaseDate: formatOpenDt(movie.openDt) || '',
    });
    setShowResults(false);

    try {
      setIsSearching(true);
      setIsFetchingDetail(true);
      const res = await fetch(`/api/kobis/detail?movieCd=${movie.movieCd}`);
      if (!res.ok) return;
      const data = await res.json();
      const info = data.movieInfoResult?.movieInfo;
      if (!info) return;
      const isKorean = info.nations?.some((n: { nationNm: string }) => n.nationNm === '한국');
      const actors =
        info.actors
          ?.slice(0, 3)
          .map((a: { peopleNm: string; peopleNmEn: string }) =>
            !isKorean && a.peopleNmEn ? a.peopleNmEn : a.peopleNm
          )
          .join(', ') || '';
      onChange({ actors });
    } catch (error) {
      console.error('영화 상세 정보 검색 오류:', error);
    } finally {
      setIsSearching(false);
      setIsFetchingDetail(false);
    }
  };

  return (
    <section className="space-y-5">
      {/* Title with KOBIS search */}
      <div className="relative" ref={searchContainerRef}>
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="movieTitle"
            className="text-mono text-[10px] uppercase tracking-widest text-fg-muted"
          >
            Title
          </label>
          <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
            KOBIS lookup
          </span>
        </div>
        <div className="mt-1.5 flex items-stretch gap-2">
          <input
            id="movieTitle"
            type="text"
            value={movieInfo.title}
            onChange={(e) => {
              onChange({ title: e.target.value });
              setShowResults(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="인터스텔라"
            className="flex-1 rounded-field border hairline bg-paper px-3.5 py-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching}
            data-touch="44"
            className="text-mono inline-flex min-h-touch shrink-0 items-center justify-center rounded-field bg-accent px-4 text-[11px] uppercase tracking-widest text-paper transition-colors hover:bg-accent-ink disabled:opacity-40"
          >
            {isSearching ? '…' : '↗ Search'}
          </button>
        </div>

        {showResults && (
          <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-card border hairline bg-paper shadow-card">
            {isSearching ? (
              <div className="text-mono px-4 py-6 text-center text-[11px] uppercase tracking-widest text-fg-faint">
                Loading…
              </div>
            ) : searchError ? (
              <div className="text-mono px-4 py-6 text-center text-[11px] uppercase tracking-widest text-danger">
                {searchError}
              </div>
            ) : searchResults.length > 0 ? (
              <ul>
                {searchResults.map((movie) => (
                  <li key={movie.movieCd}>
                    <button
                      type="button"
                      onClick={() => handleSelectMovie(movie)}
                      data-touch="44"
                      className="block w-full border-b hairline px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent-soft"
                    >
                      <div className="text-[15px] font-medium text-fg">{movie.movieNm}</div>
                      <div className="text-mono mt-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-fg-faint">
                        {movie.openDt && (
                          <span>{formatOpenDt(movie.openDt).replace(/ /g, '')}</span>
                        )}
                        {movie.genreAlt && (
                          <>
                            <span>·</span>
                            <span>{movie.genreAlt.split(',')[0]}</span>
                          </>
                        )}
                        {movie.nationAlt && (
                          <>
                            <span>·</span>
                            <span>{movie.nationAlt}</span>
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>

      {/* Watched + Theater (required) */}
      <Field
        id="watchDate"
        label="Watched"
        type="date"
        value={
          movieInfo.watchDate
            ? movieInfo.watchDate.replace(/\. /g, '-').replace(/\.$/, '')
            : ''
        }
        onChange={(e) => {
          const val = e.target.value;
          onChange({ watchDate: val ? val.replace(/-/g, '. ') + '.' : '' });
        }}
      />

      <Field
        id="theater"
        label="Theater"
        value={movieInfo.theater}
        onChange={(e) => onChange({ theater: e.target.value })}
        placeholder="CGV 용산아이파크몰"
      />
    </section>
  );
}

export function formatOpenDt(dt: string) {
  if (!dt || dt.length !== 8) return dt;
  return `${dt.substring(0, 4)}. ${dt.substring(4, 6)}. ${dt.substring(6, 8)}.`;
}
