import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { triggerKobisLookup, clearKobisLookupCache } from './kobisLookup';

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
  return mock((url: string) => {
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
  mock.restore();
  clearKobisLookupCache(); // 모듈 스코프 dedup 캐시를 테스트 간 격리
});

// U-4: triggerKobisLookup 분기 테스트
describe('triggerKobisLookup — U-4', () => {
  it('단일 매치: titleOg/releaseDate(search) + actors/runtime(detail) 주입, detail 1회', async () => {
    const fetchMock = mockFetch([BASE_MOVIE], DETAIL_KOR);
    spyOn(global, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);

    const result = await triggerKobisLookup('인터스텔라');

    expect(result.title).toBe('인터스텔라');
    expect(result.titleOg).toBe('Interstellar');
    expect(result.releaseDate).toBe('2014-11-06');
    expect(result.actors).toBe('Matthew McConaughey, Anne Hathaway');
    expect(result.runtime).toBe('169 MIN');

    // detail 1회만 호출
    const calls = fetchMock.mock.calls.map((c: [string]) => c[0]);
    const detailCalls = calls.filter((u: string) => u.includes('/api/kobis/detail'));
    expect(detailCalls).toHaveLength(1);

    // seat/bookingNumber 절대 없음
    expect(Object.keys(result)).not.toContain('seat');
    expect(Object.keys(result)).not.toContain('bookingNumber');
  });

  it('한국 영화: actors = peopleNm (한글)', async () => {
    spyOn(global, 'fetch').mockImplementation(
      mockFetch([{ ...BASE_MOVIE, movieNm: '기생충' }], DETAIL_KOREAN_MOVIE) as unknown as typeof fetch
    );

    const result = await triggerKobisLookup('기생충');

    expect(result.actors).toBe('송강호, 이선균');
  });

  it('외화: actors = peopleNmEn', async () => {
    spyOn(global, 'fetch').mockImplementation(
      mockFetch([BASE_MOVIE], DETAIL_KOR) as unknown as typeof fetch
    );

    const result = await triggerKobisLookup('인터스텔라');

    expect(result.actors).toBe('Matthew McConaughey, Anne Hathaway');
  });

  it('2건 이상 → { title } 만, detail 0회 호출', async () => {
    const fetchMock = mockFetch([BASE_MOVIE, { ...BASE_MOVIE, movieCd: 'M002' }]);
    spyOn(global, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);

    const result = await triggerKobisLookup('인터스텔라');

    expect(result).toEqual({ title: '인터스텔라' });

    const calls = fetchMock.mock.calls.map((c: [string]) => c[0]);
    const detailCalls = calls.filter((u: string) => u.includes('/api/kobis/detail'));
    expect(detailCalls).toHaveLength(0);
  });

  it('0건 → { title } 만, throw 없음', async () => {
    spyOn(global, 'fetch').mockImplementation(
      mockFetch([]) as unknown as typeof fetch
    );

    const result = await triggerKobisLookup('존재하지않는영화');

    expect(result).toEqual({ title: '존재하지않는영화' });
  });

  it('fetch 실패 → { title } 만, throw 없음', async () => {
    spyOn(global, 'fetch').mockImplementation(
      (() => Promise.reject(new Error('network error'))) as unknown as typeof fetch
    );

    const result = await triggerKobisLookup('오류영화');

    expect(result).toEqual({ title: '오류영화' });
  });
});

// #7: 모듈 스코프 dedup 캐시
describe('triggerKobisLookup — dedup cache', () => {
  it('동일 title 재호출은 캐시 Promise 재사용 (search+detail 재실행 안 함)', async () => {
    const fetchMock = mockFetch([BASE_MOVIE], DETAIL_KOR);
    spyOn(global, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);

    const r1 = await triggerKobisLookup('인터스텔라');
    const r2 = await triggerKobisLookup('인터스텔라');

    expect(r2).toEqual(r1);
    // 첫 호출의 search 1회 + detail 1회 = 총 2회. 재호출은 캐시라 추가 fetch 없음.
    expect(fetchMock.mock.calls).toHaveLength(2);
  });

  it('검색 실패({title}만)는 캐시하지 않아 재시도가 재요청한다', async () => {
    spyOn(global, 'fetch').mockImplementation(mockFetch([]) as unknown as typeof fetch);
    const first = await triggerKobisLookup('재시도영화');
    expect(first).toEqual({ title: '재시도영화' });

    const fetchMock2 = mockFetch([BASE_MOVIE], DETAIL_KOR);
    spyOn(global, 'fetch').mockImplementation(fetchMock2 as unknown as typeof fetch);
    const retry = await triggerKobisLookup('재시도영화');

    // 첫 결과가 캐시되지 않았으므로 재시도가 실제 fetch를 수행
    expect(fetchMock2.mock.calls.length).toBeGreaterThan(0);
    expect(retry.titleOg).toBe('Interstellar');
  });
});
