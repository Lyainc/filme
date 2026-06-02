import { useState, useRef, useEffect } from 'react';
import { MovieInfo, KobisMovie, DateFormatToken, DateGranularity } from '@/types';
import { formatDate, openDtToIso } from '@/utils/dateFormat';
import Field from './ui/Field';

interface MovieInfoFormProps {
  movieInfo: MovieInfo;
  onChange: (info: Partial<MovieInfo>) => void;
  /** Reports KOBIS detail-fetch in-flight state so a parent wizard can gate "Next" */
  onPendingFetchChange?: (pending: boolean) => void;
}

const GRANULARITY_OPTIONS: { value: DateGranularity; label: string }[] = [
  { value: 'year', label: '연만' },
  { value: 'year-month', label: '연·월' },
  { value: 'date', label: '연·월·일' },
];

const FORMAT_TOKENS: { value: DateFormatToken; sample: string }[] = [
  { value: 'iso', sample: '2014-11-06' },
  { value: 'kr-compact', sample: '2014.11.06' },
  { value: 'cinema-mono', sample: '06·NOV·2014' },
  { value: 'en-long', sample: 'November 6, 2014' },
];

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
  const searchCacheRef = useRef<Map<string, KobisMovie[]>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    onPendingFetchChange?.(isFetchingDetail);
    return () => onPendingFetchChange?.(false);
  }, [isFetchingDetail, onPendingFetchChange]);

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

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  const clearDebounce = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  };

  const scheduleSearch = (term: string) => {
    clearDebounce();
    debounceTimerRef.current = setTimeout(() => handleSearch(term), 300);
  };

  const handleSearch = async (term: string) => {
    if (!term) {
      setSearchError('검색할 영화 제목을 입력해주세요.');
      setShowResults(true);
      return;
    }

    if (searchCacheRef.current.has(term)) {
      const cached = searchCacheRef.current.get(term)!;
      setSearchResults(cached);
      setSearchError(cached.length === 0 ? '검색 결과가 없습니다.' : '');
      setShowResults(true);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsSearching(true);
    setSearchError('');
    setShowResults(true);

    try {
      const res = await fetch(
        `/api/kobis/search?movieNm=${encodeURIComponent(term)}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error('API 요청 실패');
      const data = await res.json();
      const list: KobisMovie[] = data.movieListResult?.movieList || [];
      searchCacheRef.current.set(term, list);
      setSearchResults(list);
      if (list.length === 0) setSearchError('검색 결과가 없습니다.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('영화 검색 오류:', error);
      setSearchError('영화를 검색하는 중 문제가 발생했습니다.');
      setSearchResults([]);
    } finally {
      if (abortControllerRef.current === controller) {
        setIsSearching(false);
      }
    }
  };

  const handleSelectMovie = async (movie: KobisMovie) => {
    const isoOpen = openDtToIso(movie.openDt);
    onChange({
      title: movie.movieNm,
      titleOg: movie.movieNmEn || '',
      releaseDate: isoOpen,
      releaseDateGranularity: isoOpen ? 'date' : undefined,
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
          ?.map((a: { peopleNm: string; peopleNmEn: string }) =>
            !isKorean && a.peopleNmEn ? a.peopleNmEn : a.peopleNm
          )
          .join(', ') || '';
      const runtime = info.showTm ? `${info.showTm} MIN` : '';
      onChange({ actors, ...(runtime ? { runtime } : {}) });
    } catch (error) {
      console.error('영화 상세 정보 검색 오류:', error);
    } finally {
      setIsSearching(false);
      setIsFetchingDetail(false);
    }
  };

  const releaseGran = movieInfo.releaseDateGranularity || 'date';
  const releaseFmt = movieInfo.releaseDateFormat || 'kr-compact';

  return (
    <section className="space-y-5">
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
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              const value = e.currentTarget.value.trim();
              if (value.length >= 2) scheduleSearch(value);
            }}
            onChange={(e) => {
              const value = e.target.value;
              onChange({ title: value });
              setShowResults(false);
              clearDebounce();
              if (isComposingRef.current || value.trim().length < 2) return;
              scheduleSearch(value.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                clearDebounce();
                handleSearch(movieInfo.title.trim());
              }
            }}
            placeholder="인터스텔라"
            aria-invalid={(showResults && !!searchError) || undefined}
            aria-describedby={showResults && searchError ? 'movieTitle-error' : undefined}
            className="flex-1 rounded-field border border-line bg-paper px-3.5 py-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="button"
            onClick={() => {
              clearDebounce();
              handleSearch(movieInfo.title.trim());
            }}
            disabled={isSearching}
            data-touch="44"
            className="text-mono inline-flex min-h-touch shrink-0 items-center justify-center rounded-field bg-accent px-4 text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-accent-ink disabled:opacity-40"
          >
            {isSearching ? '…' : '↗ Search'}
          </button>
        </div>

        {showResults && (
          <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-card border border-line bg-paper shadow-card">
            {isSearching ? (
              <div className="text-mono px-4 py-6 text-center text-[11px] uppercase tracking-widest text-fg-faint">
                Loading…
              </div>
            ) : searchError ? (
              <div
                id="movieTitle-error"
                role="alert"
                className="text-mono px-4 py-6 text-center text-[11px] uppercase tracking-widest text-danger"
              >
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
                      className="block w-full border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent-soft"
                    >
                      <div className="text-[15px] font-medium text-fg">{movie.movieNm}</div>
                      <div className="text-mono mt-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-fg-faint">
                        {movie.openDt && (
                          <span>{formatDate(openDtToIso(movie.openDt), 'kr-compact', 'date')}</span>
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
        id="titleOg"
        label="Original Title"
        value={movieInfo.titleOg}
        onChange={(e) => onChange({ titleOg: e.target.value })}
        placeholder="Interstellar (또는 한글 제목 영문 표기)"
      />
      {!movieInfo.titleOg.trim() && (
        <p className="text-mono -mt-3 text-[10px] uppercase tracking-widest text-fg-faint">
          원제 또는 한글 제목의 영문 표기를 입력해 주세요.
        </p>
      )}

      <DateBlock
        label="Released"
        value={movieInfo.releaseDate || ''}
        granularity={releaseGran}
        token={releaseFmt}
        onGranularityChange={(releaseDateGranularity) => {
          // releaseDate is always kept as full ISO — formatDate handles
          // graceful degradation per granularity, so no truncation here.
          onChange({ releaseDateGranularity });
        }}
        onTokenChange={(releaseDateFormat) => onChange({ releaseDateFormat })}
      />

      <ReissueBlock
        checked={!!movieInfo.isReissue}
        reissueDate={movieInfo.reissueDate || ''}
        granularity={releaseGran}
        token={releaseFmt}
        onToggle={(isReissue) => onChange({ isReissue })}
        onDateChange={(reissueDate) => onChange({ reissueDate })}
      />
    </section>
  );
}

/** Release date block. Source-of-truth is KOBIS — user only picks granularity & format. */
function DateBlock({
  label,
  value,
  granularity,
  token,
  onGranularityChange,
  onTokenChange,
}: {
  label: string;
  value: string;
  granularity: DateGranularity;
  token: DateFormatToken;
  onGranularityChange: (next: DateGranularity) => void;
  onTokenChange: (next: DateFormatToken) => void;
}) {
  const hasValue = !!value;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted">
          {label}
        </span>
        <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
          {formatDate(value, token, granularity) || '—'}
        </span>
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        <select
          value={granularity}
          onChange={(e) => onGranularityChange(e.target.value as DateGranularity)}
          className="text-mono rounded-field border border-line bg-paper px-3 py-3 text-[11px] uppercase tracking-widest text-fg outline-none focus:border-accent"
          aria-label={`${label} 정밀도`}
        >
          {GRANULARITY_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <div
          className={`text-mono inline-flex flex-1 min-w-[160px] items-center rounded-field border border-line px-3.5 py-3 text-[12px] uppercase tracking-widest ${
            hasValue ? 'bg-accent-soft text-fg' : 'bg-paper text-fg-faint'
          }`}
        >
          {hasValue ? formatDate(value, token, granularity) : 'KOBIS 검색으로 자동 입력돼요'}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label={`${label} 표기`}>
        {FORMAT_TOKENS.map((opt) => {
          const active = token === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onTokenChange(opt.value)}
              data-touch="44"
              className={`text-mono inline-flex min-h-touch items-center rounded-chip border px-3 text-[10px] uppercase tracking-widest transition-colors
                ${active ? 'border-accent bg-accent text-white' : 'border-line bg-paper text-fg hover:bg-accent-soft'}`}
            >
              {opt.sample}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReissueBlock({
  checked,
  reissueDate,
  granularity,
  token,
  onToggle,
  onDateChange,
}: {
  checked: boolean;
  reissueDate: string;
  granularity: DateGranularity;
  token: DateFormatToken;
  onToggle: (checked: boolean) => void;
  onDateChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <label className="text-mono inline-flex cursor-pointer items-center gap-2 text-[11px] uppercase tracking-widest text-fg">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 accent-accent"
        />
        재개봉작이에요
      </label>
      {checked && (
        <div className="flex flex-wrap items-stretch gap-2">
          <DateInput value={reissueDate} granularity={granularity} onChange={onDateChange} />
          <span className="text-mono inline-flex items-center text-[10px] uppercase tracking-widest text-fg-faint">
            표기: {formatDate(reissueDate, token, granularity) || '—'}
          </span>
        </div>
      )}
    </div>
  );
}

// Merges coarser-granularity edits onto a full-ISO value so switching year↔date doesn't discard precision.
function mergeDatePrefix(stored: string, edit: string): string {
  if (!stored || !edit) return edit;
  if (stored === edit || stored.startsWith(`${edit}-`)) return stored;
  return edit;
}

function DateInput({
  value,
  granularity,
  onChange,
}: {
  value: string;
  granularity: DateGranularity;
  onChange: (next: string) => void;
}) {
  const base =
    'flex-1 min-w-[160px] rounded-field border border-line bg-paper px-3.5 py-3 text-[15px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft';
  const parts = value ? value.split('-') : [];
  if (granularity === 'year') {
    // Display only the year part; preserve stored month/day on edit.
    const yearView = parts[0] || '';
    return (
      <input
        type="number"
        min={1900}
        max={2099}
        value={yearView}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
          onChange(mergeDatePrefix(value, v));
        }}
        placeholder="2014"
        className={base}
      />
    );
  }
  if (granularity === 'year-month') {
    // type="month" expects YYYY-MM; trim a stored full ISO down to that.
    const monthView = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : '';
    return (
      <input
        type="month"
        value={monthView}
        onChange={(e) => onChange(mergeDatePrefix(value, e.target.value))}
        className={base}
      />
    );
  }
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={base}
    />
  );
}
