import { useState, useRef, useEffect } from 'react';
import { MovieInfo, KobisMovie, DateFormatToken, DateGranularity, TicketField } from '@/types';
import { formatDate, openDtToIso } from '@/utils/dateFormat';
import { extractKobisActorsRuntime } from '@/utils/kobisLookup';
import Field from './ui/Field';
import VisibilityCheckbox from './ui/VisibilityCheckbox';
import InfoTooltip from './ui/InfoTooltip';

interface MovieInfoFormProps {
  movieInfo: MovieInfo;
  onChange: (info: Partial<MovieInfo>) => void;
  /** Reports KOBIS detail-fetch in-flight state so a parent wizard can gate "Next" */
  onPendingFetchChange?: (pending: boolean) => void;
  /** 티켓 표시 여부(인라인 체크박스) — #116 */
  fieldVisibility: Record<TicketField, boolean>;
  onFieldVisibilityChange: (partial: Partial<Record<TicketField, boolean>>) => void;
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
  fieldVisibility,
  onFieldVisibilityChange,
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
  // Monotonic id guarding handleSelectMovie's async detail fetch: a stale
  // response from a previously selected movie must not overwrite the latest one.
  const detailRunIdRef = useRef(0);

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
      // Abort any in-flight fetch so a stale response can't overwrite the cached results.
      abortControllerRef.current?.abort();
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

    const runId = ++detailRunIdRef.current;
    try {
      setIsSearching(true);
      setIsFetchingDetail(true);
      const res = await fetch(`/api/kobis/detail?movieCd=${movie.movieCd}`);
      if (detailRunIdRef.current !== runId) return; // stale — a newer selection took over
      if (!res.ok) return;
      const data = await res.json();
      if (detailRunIdRef.current !== runId) return;
      const info = data.movieInfoResult?.movieInfo;
      if (!info) return;
      const { actors, runtime } = extractKobisActorsRuntime(info);
      onChange({ actors, ...(runtime ? { runtime } : {}) });
    } catch (error) {
      console.error('영화 상세 정보 검색 오류:', error);
    } finally {
      // Only the latest selection may clear the loading/pending flags.
      if (detailRunIdRef.current === runId) {
        setIsSearching(false);
        setIsFetchingDetail(false);
      }
    }
  };

  const releaseGran = movieInfo.releaseDateGranularity || 'date';
  const releaseFmt = movieInfo.releaseDateFormat || 'kr-compact';

  return (
    <section className="space-y-5">
      <div className="relative" ref={searchContainerRef}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <VisibilityCheckbox
              checked={fieldVisibility.title}
              onChange={(v) => onFieldVisibilityChange({ title: v })}
              label="제목"
            />
            <label
              htmlFor="movieTitle"
              className="text-mono text-[10px] uppercase tracking-widest text-fg-muted"
            >
              Title
            </label>
          </span>
          <span className="text-mono text-[10px] uppercase tracking-widest text-fg-faint">
            KOBIS lookup
          </span>
        </div>
        <div className="mt-1.5 flex items-stretch gap-2">
          <input
            id="movieTitle"
            type="text"
            value={movieInfo.title}
            // IME note: search is scheduled on every onChange, including
            // mid-composition values. Korean IMEs keep the last syllable in
            // composition until an explicit commit (space/enter/blur), so
            // gating on compositionend used to silently drop the search when
            // the user simply stopped typing (#82). The 300ms debounce bounds
            // the extra mid-composition queries.
            onCompositionEnd={(e) => {
              // Some IMEs adjust the value at commit time without a trailing
              // change event — reschedule with the final committed value.
              const value = e.currentTarget.value.trim();
              if (value) scheduleSearch(value);
            }}
            onChange={(e) => {
              const value = e.target.value;
              onChange({ title: value });
              const term = value.trim();
              // 1-char titles exist in KOBIS (e.g. «돈», «굿») — debounce +
              // per-term cache keep the API load acceptable, so search from
              // the first non-space character.
              if (!term) {
                clearDebounce();
                setShowResults(false);
                return;
              }
              scheduleSearch(term);
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
            className="text-mono inline-flex min-h-touch shrink-0 items-center justify-center rounded-field bg-accent px-4 text-[11px] uppercase tracking-widest text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
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
        labelAccessory={
          <>
            <VisibilityCheckbox
              checked={fieldVisibility.titleOg}
              onChange={(v) => onFieldVisibilityChange({ titleOg: v })}
              label="원제"
            />
            <InfoTooltip
              text="원제 또는 한글 제목의 영문 표기를 입력해 주세요."
              label="원제 도움말"
            />
          </>
        }
        value={movieInfo.titleOg}
        onChange={(e) => onChange({ titleOg: e.target.value })}
        placeholder="Interstellar"
      />

      <DateBlock
        label="Released"
        value={movieInfo.releaseDate || ''}
        granularity={releaseGran}
        token={releaseFmt}
        visible={fieldVisibility.releaseDate}
        onVisibleChange={(v) => onFieldVisibilityChange({ releaseDate: v })}
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
        visible={fieldVisibility.reissue}
        onVisibleChange={(v) => onFieldVisibilityChange({ reissue: v })}
        onToggle={(isReissue) => onChange({ isReissue })}
        onDateChange={(reissueDate) => onChange({ reissueDate })}
      />

      <Field
        id="signature"
        label="Signature"
        optional
        labelAccessory={
          <>
            <VisibilityCheckbox
              checked={fieldVisibility.signature}
              onChange={(v) => onFieldVisibilityChange({ signature: v })}
              label="서명"
            />
            <InfoTooltip
              text="닉네임이나 한마디를 남겨보세요. 입력한 서명은 티켓에 그대로 공개로 표시돼요."
              label="서명 도움말"
            />
          </>
        }
        value={movieInfo.signature || ''}
        dimmed={!fieldVisibility.signature}
        onChange={(e) => onChange({ signature: e.target.value })}
        placeholder="@minji · 티켓에 공개돼요"
        maxLength={20}
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
  visible,
  onVisibleChange,
  onGranularityChange,
  onTokenChange,
}: {
  label: string;
  value: string;
  granularity: DateGranularity;
  token: DateFormatToken;
  visible: boolean;
  onVisibleChange: (next: boolean) => void;
  onGranularityChange: (next: DateGranularity) => void;
  onTokenChange: (next: DateFormatToken) => void;
}) {
  const hasValue = !!value;
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <VisibilityCheckbox checked={visible} onChange={onVisibleChange} label="개봉일" />
          <span className="text-mono block text-[10px] uppercase tracking-widest text-fg-muted">
            {label}
          </span>
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
  visible,
  onVisibleChange,
  onToggle,
  onDateChange,
}: {
  checked: boolean;
  reissueDate: string;
  granularity: DateGranularity;
  token: DateFormatToken;
  visible: boolean;
  onVisibleChange: (next: boolean) => void;
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
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-stretch gap-2">
            <DateInput value={reissueDate} granularity={granularity} onChange={onDateChange} />
            <span className="text-mono inline-flex items-center text-[10px] uppercase tracking-widest text-fg-faint">
              표기: {formatDate(reissueDate, token, granularity) || '—'}
            </span>
          </div>
          {/* 재개봉일 티켓 표시 여부 — 'Display Fields' 칩 대체(#116). isReissue와 구분 위해 재개봉작일 때만 노출. */}
          <span className="flex items-center gap-2">
            <VisibilityCheckbox checked={visible} onChange={onVisibleChange} label="재개봉" />
            <span className="text-mono text-[10px] uppercase tracking-widest text-fg-muted">
              티켓에 재개봉일 표시
            </span>
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
