import { useState, useRef, useEffect } from 'react';
import { MovieInfo, DateFormatToken, DateGranularity, TicketField } from '@/types';
import { formatDate, openDtToIso } from '@/utils/dateFormat';
import { useKobisSearch } from '@/hooks/useKobisSearch';
import Field from './ui/Field';
import VisibilityCheckbox from './ui/VisibilityCheckbox';
import InfoTooltip from './ui/InfoTooltip';
import { Eyebrow } from './v2/Eyebrow';
import { DATE_FORMAT_TOKENS, GRANULARITY_OPTIONS } from '@/constants/dateTokens';

interface MovieInfoFormProps {
  movieInfo: MovieInfo;
  onChange: (info: Partial<MovieInfo>) => void;
  /** Reports KOBIS detail-fetch in-flight state so a parent wizard can gate "Next" */
  onPendingFetchChange?: (pending: boolean) => void;
  /** 티켓 표시 여부(인라인 체크박스) — #116 */
  fieldVisibility: Record<TicketField, boolean>;
  onFieldVisibilityChange: (partial: Partial<Record<TicketField, boolean>>) => void;
}

export default function MovieInfoForm({
  movieInfo,
  onChange,
  onPendingFetchChange,
  fieldVisibility,
  onFieldVisibilityChange,
}: MovieInfoFormProps) {
  // 자동완성 키보드 내비 — 하이라이트된 옵션 인덱스(-1 = 없음). aria-activedescendant로
  // 노출하고 Enter가 이 항목을 선택한다(#198).
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 검색 코어(디바운스·abort·캐시·detail 경합)는 공용 훅이 소유. 표현·키보드 내비만 여기서.
  const {
    results: searchResults,
    loading: isSearching,
    error: searchError,
    open: showResults,
    setOpen: setShowResults,
    scheduleSearch,
    runSearch,
    selectMovie: handleSelectMovie,
  } = useKobisSearch({
    apply: onChange,
    onDetailPending: onPendingFetchChange,
    messages: {
      empty: '검색할 영화 제목을 입력해주세요.',
      noResults: '검색 결과가 없습니다.',
      requestFailed: '영화를 검색하는 중 문제가 발생했습니다.',
    },
  });

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
  }, [setShowResults]);

  // 결과가 갈리거나 드롭다운이 닫히면 하이라이트 초기화 — 스테일 인덱스가 엉뚱한 항목을
  // 가리키지 않게.
  useEffect(() => {
    setHighlightIndex(-1);
  }, [searchResults, showResults]);

  // 하이라이트 이동 + 스크롤 동기화 — 리스트가 max-h-72 overflow-y-auto라 KOBIS 기본
  // 10개 중 하단 항목은 뷰 밖이다. 하이라이트만 옮기면 키보드 사용자가 안 보이는 항목을
  // 고르게 되므로 해당 옵션을 뷰로 끌어온다(#198 리뷰 P1).
  const moveHighlight = (next: number) => {
    setHighlightIndex(next);
    document.getElementById(`movieTitle-opt-${next}`)?.scrollIntoView({ block: 'nearest' });
  };

  const releaseGran = movieInfo.releaseDateGranularity || 'date';
  const releaseFmt = movieInfo.releaseDateFormat || 'kr-compact';
  // listbox는 결과가 있을 때만 렌더되므로 aria-controls도 그때만 — 로딩/에러 상태에서
  // 없는 요소를 가리키지 않게(ARIA 1.2, #198 리뷰 P1).
  const hasListbox = showResults && !isSearching && !searchError && searchResults.length > 0;

  return (
    <section className="space-y-group">
      <div className="relative" ref={searchContainerRef}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {/* 제목은 필수 필드(#260 REQUIRED_FIELDS) — 숨김 눈 토글 없음(다른 세 경로와 동일 규칙). */}
            <Eyebrow as="label" htmlFor="movieTitle">
              Title
            </Eyebrow>
          </span>
          <Eyebrow tone="faint">KOBIS lookup</Eyebrow>
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
              // 1-char titles exist in KOBIS (e.g. «돈», «굿») — debounce +
              // per-term cache keep the API load acceptable, so search from
              // the first non-space character. 빈 값은 scheduleSearch가 드롭다운을 닫는다.
              scheduleSearch(value.trim());
            }}
            onKeyDown={(e) => {
              const items = searchResults;
              if (e.key === 'ArrowDown') {
                if (!showResults || items.length === 0) return;
                e.preventDefault();
                moveHighlight((highlightIndex + 1) % items.length);
              } else if (e.key === 'ArrowUp') {
                if (!showResults || items.length === 0) return;
                e.preventDefault();
                moveHighlight(highlightIndex <= 0 ? items.length - 1 : highlightIndex - 1);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                // 하이라이트된 항목이 있으면 그걸 선택, 없으면 검색 실행.
                if (showResults && highlightIndex >= 0 && items[highlightIndex]) {
                  handleSelectMovie(items[highlightIndex]);
                } else {
                  runSearch(movieInfo.title.trim());
                }
              } else if (e.key === 'Escape') {
                if (showResults) {
                  e.preventDefault();
                  setShowResults(false);
                  setHighlightIndex(-1);
                }
              }
            }}
            role="combobox"
            aria-expanded={showResults}
            aria-controls={hasListbox ? 'movieTitle-listbox' : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              showResults && highlightIndex >= 0 ? `movieTitle-opt-${highlightIndex}` : undefined
            }
            aria-invalid={(showResults && !!searchError) || undefined}
            aria-describedby={showResults && searchError ? 'movieTitle-error' : undefined}
            className="flex-1 rounded-field border border-line bg-paper px-3.5 py-3 text-[16px] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
          <button
            type="button"
            onClick={() => runSearch(movieInfo.title.trim())}
            disabled={isSearching}
            aria-busy={isSearching}
            data-touch="44"
            className="text-mono inline-flex min-h-touch shrink-0 items-center justify-center rounded-field bg-accent px-4 text-[11px] uppercase tracking-widest text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {isSearching ? '…' : '↗ Search'}
          </button>
        </div>

        {/* 로딩/결과수 announce — sr-only 요약(리스트 전체를 라이브로 두면 항목이 통째로
            읽혀 과하다). 에러는 아래 role="alert"가 따로 처리. */}
        <div role="status" aria-live="polite" className="sr-only">
          {showResults && isSearching
            ? '영화 검색 중'
            : showResults && !searchError && searchResults.length > 0
              ? `검색 결과 ${searchResults.length}개`
              : ''}
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
              <ul id="movieTitle-listbox" role="listbox" aria-label="검색 결과">
                {searchResults.map((movie, i) => (
                  <li
                    key={movie.movieCd}
                    id={`movieTitle-opt-${i}`}
                    role="option"
                    aria-selected={i === highlightIndex}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleSelectMovie(movie)}
                      data-touch="44"
                      className={`block w-full border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent-soft ${
                        i === highlightIndex ? 'bg-accent-soft' : ''
                      }`}
                    >
                      <div className="text-[15px] font-medium text-fg">{movie.movieNm}</div>
                      <Eyebrow as="div" tone="faint" className="mt-1 flex items-center gap-2">
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
                      </Eyebrow>
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
      />

      <ReleaseDateBlock
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
        reissueChecked={!!movieInfo.isReissue}
        reissueDate={movieInfo.reissueDate || ''}
        reissueVisible={fieldVisibility.reissue}
        onReissueVisibleChange={(v) => onFieldVisibilityChange({ reissue: v })}
        onReissueToggle={(isReissue) => onChange({ isReissue })}
        onReissueDateChange={(reissueDate) => onChange({ reissueDate })}
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
        maxLength={20}
      />
    </section>
  );
}

/**
 * Release date block. Source-of-truth is KOBIS — user only picks granularity & format.
 * 재개봉(reissue) 토글을 RELEASED 헤더 옆 인라인으로 통합(#141 (14)) — 이전엔 별도
 * ReissueBlock으로 분리돼 있었다. 재개봉작 체크 시 개봉일과 같은 정밀도/표기 토큰을
 * 공유하는 재개봉일 입력이 아래에 펼쳐진다.
 */
function ReleaseDateBlock({
  label,
  value,
  granularity,
  token,
  visible,
  onVisibleChange,
  onGranularityChange,
  onTokenChange,
  reissueChecked,
  reissueDate,
  reissueVisible,
  onReissueVisibleChange,
  onReissueToggle,
  onReissueDateChange,
}: {
  label: string;
  value: string;
  granularity: DateGranularity;
  token: DateFormatToken;
  visible: boolean;
  onVisibleChange: (next: boolean) => void;
  onGranularityChange: (next: DateGranularity) => void;
  onTokenChange: (next: DateFormatToken) => void;
  reissueChecked: boolean;
  reissueDate: string;
  reissueVisible: boolean;
  onReissueVisibleChange: (next: boolean) => void;
  onReissueToggle: (next: boolean) => void;
  onReissueDateChange: (next: string) => void;
}) {
  const hasValue = !!value;
  return (
    <div className="space-y-field">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-2">
            <VisibilityCheckbox checked={visible} onChange={onVisibleChange} label="개봉일" />
            <Eyebrow className="block">{label}</Eyebrow>
          </span>
          {/* 재개봉 토글 — RELEASED 헤더 옆 인라인(#141 (14)) */}
          <Eyebrow as="label" className="inline-flex cursor-pointer items-center gap-1.5 hover:text-fg">
            <input
              type="checkbox"
              checked={reissueChecked}
              onChange={(e) => onReissueToggle(e.target.checked)}
              className="h-3.5 w-3.5 accent-accent"
            />
            재개봉작
          </Eyebrow>
        </span>
        <Eyebrow tone="faint">{formatDate(value, token, granularity) || '—'}</Eyebrow>
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        <select
          value={granularity}
          onChange={(e) => onGranularityChange(e.target.value as DateGranularity)}
          className="text-mono rounded-field border border-line bg-paper px-3 py-3 text-[16px] uppercase tracking-widest text-fg outline-none focus:border-accent"
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
        {DATE_FORMAT_TOKENS.map((opt) => {
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
                ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-paper text-fg hover:bg-accent-soft'}`}
            >
              {opt.sample}
            </button>
          );
        })}
      </div>

      {/* 재개봉일 입력 — 토글 ON일 때만. 개봉일과 같은 정밀도/토큰을 공유한다. */}
      {reissueChecked && (
        <div className="space-y-field border-l-2 border-line pl-3">
          <div className="flex flex-wrap items-stretch gap-2">
            <DateInput value={reissueDate} granularity={granularity} onChange={onReissueDateChange} ariaLabel="재개봉일" />
            <Eyebrow tone="faint" className="inline-flex items-center">
              표기: {formatDate(reissueDate, token, granularity) || '—'}
            </Eyebrow>
          </div>
          {/* 재개봉일 티켓 표시 여부 — 'Display Fields' 칩 대체(#116). isReissue와 구분 위해 재개봉작일 때만 노출. */}
          <span className="flex items-center gap-2">
            <VisibilityCheckbox checked={reissueVisible} onChange={onReissueVisibleChange} label="재개봉" />
            <Eyebrow>티켓에 재개봉일 표시</Eyebrow>
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

// 필드 편집 시트(#215)의 개봉일/재개봉일 입력도 이 granularity 인식 입력을 재사용한다.
export function DateInput({
  value,
  granularity,
  onChange,
  ariaLabel,
}: {
  value: string;
  granularity: DateGranularity;
  onChange: (next: string) => void;
  /** placeholder만 있던 스핀버튼에 접근명을 부여 — SR이 무라벨로 읽지 않게(#198). */
  ariaLabel?: string;
}) {
  const base =
    'flex-1 min-w-[160px] rounded-field border border-line bg-paper px-3.5 py-3 text-[16px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft';
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
        aria-label={ariaLabel}
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
        aria-label={ariaLabel}
        className={base}
      />
    );
  }
  return (
    <input
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={base}
    />
  );
}
