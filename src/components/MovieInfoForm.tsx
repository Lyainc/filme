import { useState, useRef, useEffect } from 'react';
import { MovieInfo, KobisMovie } from '@/types';

interface MovieInfoFormProps {
  movieInfo: MovieInfo;
  onChange: (info: Partial<MovieInfo>) => void;
}

export default function MovieInfoForm({ movieInfo, onChange }: MovieInfoFormProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<KobisMovie[]>([]);
  const [searchError, setSearchError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 검색 결과 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = async () => {
    if (!movieInfo.title.trim()) {
      setSearchError('검색할 영화 제목을 입력해주세요.');
      setShowResults(true);
      return;
    }
    
    setIsSearching(true);
    setSearchError('');
    setShowResults(true);
    
    try {
      const res = await fetch(`/api/kobis/search?movieNm=${encodeURIComponent(movieInfo.title.trim())}`);
      if (!res.ok) {
        throw new Error('API 요청 실패');
      }
      
      const data = await res.json();
      const list = data.movieListResult?.movieList || [];
      setSearchResults(list);
      
      if (list.length === 0) {
        setSearchError('검색 결과가 없습니다.');
      }
    } catch (error) {
      console.error('영화 검색 오류:', error);
      setSearchError('영화를 검색하는 중 문제가 발생했습니다.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSelectMovie = (movie: KobisMovie) => {
    onChange({ title: movie.movieNm });
    setShowResults(false);
  };

  const formatOpenDt = (dt: string) => {
    if (!dt || dt.length !== 8) return dt;
    return `${dt.substring(0, 4)}.${dt.substring(4, 6)}.${dt.substring(6, 8)}`;
  };

  return (
    <section className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">2. 영화 정보</h2>
      <div className="space-y-4">
        <div className="relative" ref={searchContainerRef}>
          <label htmlFor="movieTitle" className="block text-sm font-medium mb-1">
            영화 제목
          </label>
          <div className="flex gap-2">
            <input
              id="movieTitle"
              type="text"
              value={movieInfo.title}
              onChange={(e) => {
                onChange({ title: e.target.value });
                setShowResults(false); // 타이핑 시 검색 결과 닫기
              }}
              onKeyDown={handleKeyDown}
              placeholder="인터스텔라"
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 whitespace-nowrap"
            >
              {isSearching ? '검색 중...' : '검색'}
            </button>
          </div>

          {/* 검색 결과 레이어 */}
          {showResults && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  데이터를 불러오는 중입니다...
                </div>
              ) : searchError ? (
                <div className="p-4 text-center text-sm text-red-500">
                  {searchError}
                </div>
              ) : searchResults.length > 0 ? (
                <ul className="py-1">
                  {searchResults.map((movie) => (
                    <li key={movie.movieCd}>
                      <button
                        type="button"
                        onClick={() => handleSelectMovie(movie)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900">
                          {movie.movieNm}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          {movie.openDt && <span>개봉: {formatOpenDt(movie.openDt)}</span>}
                          {movie.genreAlt && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                              <span>{movie.genreAlt.split(',')[0]}</span>
                            </>
                          )}
                          {movie.nationAlt && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
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

        <div>
          <label htmlFor="watchDate" className="block text-sm font-medium mb-1">
            관람일
          </label>
          <input
            id="watchDate"
            type="text"
            value={movieInfo.watchDate}
            onChange={(e) => onChange({ watchDate: e.target.value })}
            placeholder="2024. 11. 28."
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="theater" className="block text-sm font-medium mb-1">
            극장 위치
          </label>
          <input
            id="theater"
            type="text"
            value={movieInfo.theater}
            onChange={(e) => onChange({ theater: e.target.value })}
            placeholder="CGV 용산아이파크몰"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="screen" className="block text-sm font-medium mb-1">
              상영관 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              id="screen"
              type="text"
              value={movieInfo.screen || ''}
              onChange={(e) => onChange({ screen: e.target.value })}
              placeholder="IMAX관"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="seat" className="block text-sm font-medium mb-1">
              좌석 번호 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              id="seat"
              type="text"
              value={movieInfo.seat || ''}
              onChange={(e) => onChange({ seat: e.target.value })}
              placeholder="G14, G15"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
