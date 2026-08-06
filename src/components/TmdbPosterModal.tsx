import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

interface TmdbSearchResult {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
}

interface TmdbPoster {
  file_path: string;
  width: number;
  height: number;
}

type View = 'search' | 'posters';

export interface TmdbPosterModalProps {
  onClose: () => void;
  /** 판본 선택 확정 — Blob을 File로 감싸 넘긴다. 이후는 기존 크롭 파이프라인(usePosterCrop.openFile)이 그대로 이어받는다(#537 c1·c7). */
  onSelect: (file: File, title: string) => void;
  /** ac4 — 검색 결과·포스터가 비어 있을 때 그 자리에서 기존 파일 업로드로 전환. */
  onFallbackUpload: () => void;
}

const IMG_BASE = '/api/tmdb/image';

/** 불투명 카드(#569/#580) — --overlay-fill 위 muted·accent·faint 잉크는 AA 대비를 못 넘으므로
 *  텍스트 행은 --surface에 얹는다. AdvancedSettingsModal의 CARD와 같은 값·같은 근거(#656). */
const CARD = 'rounded-[12px] bg-surface p-1';

/**
 * TMDB 인앱 포스터 검색 모달(#537 c6) — search/posters 두 뷰를 한 모달 안에서 전환한다.
 * 모달을 두 개 띄우지 않는 이유: 국내 개봉작은 TMDB 대표 포스터가 해외판인 경우가 흔해
 * 판본 고르기가 예외가 아니라 기본 동선이라, 검색→판본 전환이 잦다.
 *
 * 셸 형태는 AdvancedSettingsModal과 같은 패턴(포털 없이 직접 렌더 + focusin 기반 포커스 가둠) —
 * 이 모달도 MobileEditorShell 최상위에서 직접 렌더돼 PhoneFrame의 contain:paint 조상 안에
 * 이미 있으므로 ImageCropModal처럼 별도 포털이 필요 없다.
 */
export function TmdbPosterModal({ onClose, onSelect, onFallbackUpload }: TmdbPosterModalProps) {
  const [view, setView] = useState<View>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<TmdbSearchResult | null>(null);
  const [posters, setPosters] = useState<TmdbPoster[]>([]);
  const [loadingPosters, setLoadingPosters] = useState(false);
  const [postersError, setPostersError] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  // useKobisSearch의 detailRunRef와 같은 패턴 — 결과 없이 연달아 두 영화를 고르면(뒤로가기 →
  // 다른 영화 선택) 먼저 보낸 fetch가 나중 것보다 늦게 돌아올 수 있어, 응답 순서가 아니라
  // 이 카운터로 "지금 보고 있는 선택이 맞는지"를 판정한다.
  const pickRunRef = useRef(0);

  useBodyScrollLock(true);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
    const keepFocus = (e: FocusEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        panelRef.current.focus();
      }
    };
    document.addEventListener('focusin', keepFocus);
    return () => document.removeEventListener('focusin', keepFocus);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, applying]);

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      const list: TmdbSearchResult[] = data.results ?? [];
      setResults(list);
      if (list.length === 0) setSearchError('검색 결과가 없어요.');
    } catch {
      setSearchError('검색에 실패했어요.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function pickMovie(movie: TmdbSearchResult) {
    const run = ++pickRunRef.current;
    setSelected(movie);
    setView('posters');
    setPosters([]);
    setPostersError('');
    setApplyError('');
    setLoadingPosters(true);
    try {
      const res = await fetch(`/api/tmdb/images?id=${movie.id}`);
      if (run !== pickRunRef.current) return; // 그 사이 다른 영화를 골랐다 — 이 응답은 버린다.
      if (!res.ok) throw new Error('images failed');
      const data = await res.json();
      setPosters(data.posters ?? []);
    } catch {
      if (run !== pickRunRef.current) return;
      setPostersError('포스터를 불러오지 못했어요.');
    } finally {
      if (run === pickRunRef.current) setLoadingPosters(false);
    }
  }

  async function pickPoster(poster: TmdbPoster) {
    if (!selected || applying) return;
    setApplying(true);
    setApplyError('');
    try {
      const res = await fetch(`${IMG_BASE}?path=${encodeURIComponent(poster.file_path)}&size=original`);
      if (!res.ok) throw new Error('image fetch failed');
      const blob = await res.blob();
      const file = new File([blob], `tmdb-${selected.id}.jpg`, { type: blob.type || 'image/jpeg' });
      onSelect(file, selected.title);
    } catch {
      setApplyError('포스터를 가져오지 못했어요. 다시 시도해 주세요.');
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-black/30" onClick={applying ? undefined : onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="영화 검색해서 포스터 가져오기"
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-card border-t outline-none"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 44px)',
          background: 'var(--overlay-fill)',
          borderColor: 'var(--overlay-border)',
          backdropFilter: 'blur(13px)',
          WebkitBackdropFilter: 'blur(13px)',
        }}
      >
        <div className="shrink-0 px-4 pt-3">
          <div className={`flex items-center justify-between gap-2 px-1.5 py-1 ${CARD}`}>
            {view === 'posters' ? (
              <button
                type="button"
                onClick={() => setView('search')}
                disabled={applying}
                aria-label="검색으로 돌아가기"
                data-touch="44"
                className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-field-sm text-fg-muted hover:bg-accent-soft hover:text-fg disabled:opacity-30"
              >
                ←
              </button>
            ) : (
              <h2 className="truncate text-body font-semibold text-fg">영화 검색</h2>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              aria-label="닫기"
              data-touch="44"
              className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-field-sm text-fg-muted hover:bg-accent-soft hover:text-fg disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          {view === 'search' ? (
            <>
              <form onSubmit={runSearch} className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="영화 제목"
                  aria-label="영화 제목 검색"
                  className="min-h-touch flex-1 rounded-field-sm border border-line bg-surface px-3 text-body text-fg"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="min-h-touch rounded-field-sm bg-accent px-4 text-body font-medium text-accent-ink disabled:opacity-50"
                >
                  검색
                </button>
              </form>

              {/* searchError 하나로 충분하다 — runSearch가 결과 0건일 때도 이걸 세팅하므로
                  "검색 전 초기 상태"(results도 비어 있다)와 "검색했지만 0건"이 안 섞인다.
                  muted·accent 잉크가 섞이는 행이라 --overlay-fill 위 직접 노출 대신 CARD에 얹는다(#656). */}
              {(searchError || results.length > 0) && (
                <div className={`mt-3 ${CARD}`}>
                  {searchError && <p className="px-2.5 py-2 text-body text-fg-muted">{searchError}</p>}
                  {searchError && (
                    <button
                      type="button"
                      onClick={onFallbackUpload}
                      className="px-2.5 pb-2 text-body font-medium text-fg underline"
                    >
                      파일 업로드로 전환
                    </button>
                  )}

                  <ul className="space-y-1">
                    {results.map((movie) => (
                      <li key={movie.id}>
                        <button
                          type="button"
                          onClick={() => pickMovie(movie)}
                          className="flex w-full items-center gap-3 rounded-field-sm px-2 py-2 text-left hover:bg-accent-soft"
                        >
                          {movie.poster_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`${IMG_BASE}?path=${encodeURIComponent(movie.poster_path)}&size=w342`}
                              alt=""
                              className="h-14 w-10 shrink-0 rounded-field-sm object-cover"
                            />
                          ) : (
                            <span className="h-14 w-10 shrink-0 rounded-field-sm border border-dashed border-line" aria-hidden="true" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-body font-medium text-fg">{movie.title}</span>
                            {movie.release_date && (
                              <span className="block text-caption text-fg-muted">{movie.release_date.slice(0, 4)}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              {/* muted·accent 잉크가 섞이는 행이라 --overlay-fill 위 직접 노출 대신 CARD에 얹는다(#656). */}
              {loadingPosters && <p className={`px-2.5 py-2 text-body text-fg-muted ${CARD}`}>포스터를 불러오는 중…</p>}
              {applyError && <p className={`px-2.5 py-2 text-body text-fg-muted ${CARD}`}>{applyError}</p>}

              {/* postersError(요청 실패)와 진짜 0건을 분리한다 — 안 그러면 네트워크 에러도
                  "이 영화는 포스터가 없어요"로 잘못 안내한다. */}
              {!loadingPosters && postersError && (
                <div className={`flex flex-col items-start gap-2 px-2.5 py-2 ${CARD}`}>
                  <p className="text-body text-fg-muted">{postersError}</p>
                  <button
                    type="button"
                    onClick={onFallbackUpload}
                    className="text-body font-medium text-fg underline"
                  >
                    파일 업로드로 전환
                  </button>
                </div>
              )}
              {!loadingPosters && !postersError && posters.length === 0 && (
                <div className={`flex flex-col items-start gap-2 px-2.5 py-2 ${CARD}`}>
                  <p className="text-body text-fg-muted">이 영화는 포스터가 없어요.</p>
                  <button
                    type="button"
                    onClick={onFallbackUpload}
                    className="text-body font-medium text-fg underline"
                  >
                    파일 업로드로 전환
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {posters.map((poster) => (
                  <button
                    key={poster.file_path}
                    type="button"
                    onClick={() => pickPoster(poster)}
                    disabled={applying}
                    aria-label={`포스터 판본 선택 ${poster.file_path}`}
                    className="aspect-[2/3] overflow-hidden rounded-field-sm border border-line disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${IMG_BASE}?path=${encodeURIComponent(poster.file_path)}&size=w342`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* TMDB 필수 귀속 표시(#537 c3) — 실제로 TMDB를 쓰는 화면에서만, 생성된 티켓엔 안 들어간다.
            faint 잉크라 --overlay-fill 위 직접 노출 대신 CARD에 얹는다(#656). */}
        <div className="shrink-0 px-4 pb-3 pt-2">
          <p className={`px-2.5 py-2 text-micro leading-snug text-fg-muted ${CARD}`}>
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
      </div>
    </div>
  );
}
