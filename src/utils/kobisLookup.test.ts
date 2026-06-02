import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerKobisLookup } from './kobisLookup';

const BASE_MOVIE = {
  movieCd: 'M001',
  movieNm: '인터스텔라',
  movieNmEn: 'Interstellar',
  openDt: '20141106',
};

const DETAIL_KOR = {
  movieInfoResult: {
    movieInfo: {
      nations: [{ nationNm: '미국' }, { nationNm: '영국' }],
      actors: [
        { peopleNm: '매튜 맥커너히', peopleNmEn: 'Matthew McConaughey' },
        { peopleNm: '앤 해서웨이', peopleNmEn: 'Anne Hathaway' },
      ],
      showTm: '169',
    },
  },
};

const DETAIL_KOREAN_MOVIE = {
  movieInfoResult: {
    movieInfo: {
      nations: [{ nationNm: '한국' }],
      actors: [
        { peopleNm: '송강호', peopleNmEn: 'Song Kang-ho' },
        { peopleNm: '이선균', peopleNmEn: 'Lee Sun-kyun' },
      ],
      showTm: '132',
    },
  },
};

function mockFetch(searchList: object[], detailData?: object) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/kobis/search')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ movieListResult: { movieList: searchList } }),
      });
    }
    if (url.includes('/api/kobis/detail')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(detailData ?? DETAIL_KOR),
      });
    }
    return Promise.reject(new Error('unexpected url'));
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// U-4: triggerKobisLookup 분기 테스트
describe('triggerKobisLookup — U-4', () => {
  it('단일 매치: titleOg/releaseDate(search) + actors/runtime(detail) 주입, detail 1회', async () => {
    const fetchMock = mockFetch([BASE_MOVIE], DETAIL_KOR);
    vi.spyOn(global, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);

    const result = await triggerKobisLookup('인터스텔라');

    expect(result.title).toBe('인터스텔라');
    expect(result.titleOg).toBe('Interstellar');
    expect(result.releaseDate).toBe('2014-11-06');
    expect(result.actors).toBe('Matthew McConaughey, Anne Hathaway');
    expect(result.runtime).toBe('169 MIN');

    // detail 1회만 호출
    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: [string]) => c[0]
    );
    const detailCalls = calls.filter((u: string) => u.includes('/api/kobis/detail'));
    expect(detailCalls).toHaveLength(1);

    // seat/bookingNumber 절대 없음
    expect(Object.keys(result)).not.toContain('seat');
    expect(Object.keys(result)).not.toContain('bookingNumber');
  });

  it('한국 영화: actors = peopleNm (한글)', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      mockFetch([{ ...BASE_MOVIE, movieNm: '기생충' }], DETAIL_KOREAN_MOVIE) as unknown as typeof fetch
    );

    const result = await triggerKobisLookup('기생충');

    expect(result.actors).toBe('송강호, 이선균');
  });

  it('외화: actors = peopleNmEn', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      mockFetch([BASE_MOVIE], DETAIL_KOR) as unknown as typeof fetch
    );

    const result = await triggerKobisLookup('인터스텔라');

    expect(result.actors).toBe('Matthew McConaughey, Anne Hathaway');
  });

  it('2건 이상 → { title } 만, detail 0회 호출', async () => {
    const fetchMock = mockFetch([BASE_MOVIE, { ...BASE_MOVIE, movieCd: 'M002' }]);
    vi.spyOn(global, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);

    const result = await triggerKobisLookup('인터스텔라');

    expect(result).toEqual({ title: '인터스텔라' });

    const calls = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: [string]) => c[0]
    );
    const detailCalls = calls.filter((u: string) => u.includes('/api/kobis/detail'));
    expect(detailCalls).toHaveLength(0);
  });

  it('0건 → { title } 만, throw 없음', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      mockFetch([]) as unknown as typeof fetch
    );

    const result = await triggerKobisLookup('존재하지않는영화');

    expect(result).toEqual({ title: '존재하지않는영화' });
  });

  it('fetch 실패 → { title } 만, throw 없음', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

    const result = await triggerKobisLookup('오류영화');

    expect(result).toEqual({ title: '오류영화' });
  });
});
