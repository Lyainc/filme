import { useState, useRef, useEffect, useCallback } from 'react';
import { MovieInfo, KobisMovie } from '@/types';
import SectionHeader from './ui/SectionHeader';
import Field from './ui/Field';

interface MovieInfoFormProps {
  movieInfo: MovieInfo;
  onChange: (info: Partial<MovieInfo>) => void;
}

export default function MovieInfoForm({ movieInfo, onChange }: MovieInfoFormProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<KobisMovie[]>([]);
  const [searchError, setSearchError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
    }
  };

  const handleRatingClick = (e: React.MouseEvent<HTMLDivElement>, starIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isHalf = e.clientX - rect.left < rect.width / 2;
    onChange({ rating: isHalf ? starIndex - 0.5 : starIndex });
  };

  const handleRatingHover = (e: React.MouseEvent<HTMLDivElement>, starIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isHalf = e.clientX - rect.left < rect.width / 2;
    setHoverRating(isHalf ? starIndex - 0.5 : starIndex);
  };

  return (
    <section>
      <SectionHeader index="02" title="Film" caption="Title · cast · date" />

      <div className="space-y-7">
        {/* Search-enabled title */}
        <div className="relative" ref={searchContainerRef}>
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="movieTitle"
              className="text-mono text-[10px] uppercase tracking-widest text-bone-400"
            >
              Title
            </label>
            <span className="text-mono text-[10px] uppercase tracking-widest text-bone-500">
              KOBIS lookup
            </span>
          </div>
          <div className="mt-1.5 flex items-stretch gap-2 border-b border-white/[0.12] focus-within:border-gold">
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
              className="flex-1 border-0 bg-transparent px-0 py-2.5 text-[15px] text-paper outline-none placeholder:text-bone-500/50"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching}
              className="text-mono shrink-0 px-3 py-2.5 text-[10px] uppercase tracking-widest text-gold transition-colors hover:text-paper disabled:opacity-40"
            >
              {isSearching ? 'Searching…' : '↗ Search'}
            </button>
          </div>

          {showResults && (
            <div className="scrollbar-stealth absolute z-30 mt-2 max-h-72 w-full overflow-y-auto border border-white/[0.08] bg-ink-100 shadow-2xl shadow-black/40">
              {isSearching ? (
                <div className="text-mono px-4 py-6 text-center text-[11px] uppercase tracking-widest text-bone-400">
                  Loading…
                </div>
              ) : searchError ? (
                <div className="text-mono px-4 py-6 text-center text-[11px] uppercase tracking-widest text-burn">
                  {searchError}
                </div>
              ) : searchResults.length > 0 ? (
                <ul>
                  {searchResults.map((movie) => (
                    <li key={movie.movieCd}>
                      <button
                        type="button"
                        onClick={() => handleSelectMovie(movie)}
                        className="block w-full border-b border-white/[0.04] px-4 py-3 text-left transition-colors last:border-0 hover:bg-gold/[0.06]"
                      >
                        <div className="text-display text-base font-normal text-paper">
                          {movie.movieNm}
                        </div>
                        <div className="text-mono mt-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-bone-500">
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

        <Field
          id="movieTitleOg"
          label="Original Title"
          value={movieInfo.titleOg || ''}
          onChange={(e) => onChange({ titleOg: e.target.value })}
          placeholder="Interstellar"
        />

        <Field
          id="actors"
          label="Cast"
          value={movieInfo.actors || ''}
          onChange={(e) => onChange({ actors: e.target.value })}
          placeholder="매튜 맥커너히, 앤 해서웨이"
        />

        <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
          <Field
            id="releaseDate"
            label="Released"
            value={movieInfo.releaseDate || ''}
            onChange={(e) => onChange({ releaseDate: e.target.value })}
            placeholder="2014. 11. 06."
          />

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
        </div>

        <div className="grid grid-cols-2 gap-7">
          <Field
            id="watchTime"
            label="Showtime"
            type="time"
            optional
            value={movieInfo.watchTime || ''}
            onChange={(e) => onChange({ watchTime: e.target.value })}
          />
          <Field
            id="runtime"
            label="Runtime"
            optional
            value={movieInfo.runtime || ''}
            onChange={(e) => onChange({ runtime: e.target.value })}
            placeholder="150 MIN"
          />
        </div>

        <Field
          id="theater"
          label="Theater"
          value={movieInfo.theater}
          onChange={(e) => onChange({ theater: e.target.value })}
          placeholder="CGV 용산아이파크몰"
        />

        <div className="grid grid-cols-2 gap-7">
          <Field
            id="screen"
            label="Screen"
            optional
            value={movieInfo.screen || ''}
            onChange={(e) => onChange({ screen: e.target.value })}
            placeholder="IMAX관"
          />
          <Field
            id="seat"
            label="Seat"
            optional
            value={movieInfo.seat || ''}
            onChange={(e) => onChange({ seat: e.target.value })}
            placeholder="G14, G15"
          />
        </div>

        <div className="grid grid-cols-2 gap-7">
          <Field
            id="audienceCert"
            label="Cert"
            optional
            value={movieInfo.audienceCert || ''}
            onChange={(e) => onChange({ audienceCert: e.target.value })}
            placeholder="12"
          />
          <Field
            id="bookingNumber"
            label="Booking No."
            optional
            value={movieInfo.bookingNumber || ''}
            onChange={(e) => onChange({ bookingNumber: e.target.value })}
            placeholder="T-20260510-0014"
          />
        </div>

        {/* Rating */}
        <div className="space-y-3 pt-2">
          <div className="flex items-baseline justify-between">
            <span className="text-mono text-[10px] uppercase tracking-widest text-bone-400">
              Rating
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-mono text-[10px] uppercase tracking-widest text-bone-500">
              <input
                type="checkbox"
                checked={movieInfo.showRating !== false}
                onChange={(e) => onChange({ showRating: e.target.checked })}
                className="h-3 w-3 accent-gold"
              />
              Show on ticket
            </label>
          </div>

          {movieInfo.showRating !== false && (
            <div className="flex items-center gap-5">
              <div className="flex gap-2" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const currentRating = hoverRating || movieInfo.rating || 0;
                  return (
                    <div
                      key={star}
                      className="relative h-7 w-7 cursor-pointer"
                      onClick={(e) => handleRatingClick(e, star)}
                      onMouseMove={(e) => handleRatingHover(e, star)}
                    >
                      <StarSVG className="absolute inset-0 text-white/15" />
                      <div
                        className="absolute inset-0 overflow-hidden transition-[width] duration-100"
                        style={{
                          width:
                            currentRating >= star
                              ? '100%'
                              : currentRating >= star - 0.5
                              ? '50%'
                              : '0%',
                        }}
                      >
                        <StarSVG className="text-gold" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <span className="text-mono text-xs tracking-widest text-bone-400">
                {(hoverRating || movieInfo.rating).toFixed(1)} <span className="text-bone-500/60">/ 5.0</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StarSVG({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-7 w-7 ${className}`} fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function formatOpenDt(dt: string) {
  if (!dt || dt.length !== 8) return dt;
  return `${dt.substring(0, 4)}. ${dt.substring(4, 6)}. ${dt.substring(6, 8)}.`;
}
