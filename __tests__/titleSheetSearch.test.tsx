/**
 * #215 PART A — FieldEditSheet의 TitleSheet KOBIS 검색 회귀.
 *
 * TitleSheet는 MovieInfoForm의 KOBIS 검색(디바운스→/api/kobis/search→선택 시
 * /api/kobis/detail 보강, #82에서 실제 회귀가 있던 코드)을 재구현했다. movieInfoFormAutocomplete
 * 테스트와 동일 시나리오를 이 시트에도 건다: 검색→선택 반영, IME compositionend 재검색,
 * 1글자 제목, 공백 무검색, detail 경합 가드(detailRunRef).
 *
 * fetch는 글로벌 스왑으로 mock(공유 모듈 mock.module 미사용 — 전역 누수 회피). vaul 시트는
 * fieldSheets 패턴대로 testing-library render로 띄우고 fireEvent로 상호작용.
 */
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { act } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { FieldEditSheet } from '@/components/v2/FieldEditSheet';

const MOVIE_A = { movieCd: 'M001', movieNm: '영화A', movieNmEn: 'Movie A', openDt: '20141106', genreAlt: '드라마', nationAlt: '한국', prdtYear: '2014' };
const MOVIE_B = { movieCd: 'M002', movieNm: '영화B', movieNmEn: 'Movie B', openDt: '20190320', genreAlt: 'SF', nationAlt: '한국', prdtYear: '2019' };
const SEARCH_RESPONSE = { movieListResult: { movieList: [MOVIE_A, MOVIE_B] } };

function detailResponse(actorName: string, showTm: string) {
  return { movieInfoResult: { movieInfo: { nations: [{ nationNm: '한국' }], actors: [{ peopleNm: actorName, peopleNmEn: '' }], showTm } } };
}
function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const originalFetch = globalThis.fetch;
let searchCalls: string[];

function mockFetch(detailImpl: (movieCd: string) => Promise<Response>) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/kobis/search')) {
      searchCalls.push(new URLSearchParams(url.split('?')[1]).get('movieNm') ?? '');
      return Promise.resolve(jsonResponse(SEARCH_RESPONSE));
    }
    if (url.startsWith('/api/kobis/detail')) {
      return detailImpl(new URLSearchParams(url.split('?')[1]).get('movieCd') ?? '');
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as typeof fetch;
}

let photoRef: ReturnType<typeof usePhototicket>;
function Harness() {
  const photo = usePhototicket();
  photoRef = photo;
  return <FieldEditSheet activeField="title" onClose={() => {}} photo={photo} />;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const flushDebounce = () => act(async () => { await sleep(380); });
const titleInput = () => screen.getByRole('textbox') as HTMLInputElement;
const resultButtons = () => screen.queryAllByRole('button').filter((b) => /영화[AB]/.test(b.textContent || ''));
const info = () => photoRef.state.movieInfo;

beforeEach(() => {
  window.localStorage.clear();
  searchCalls = [];
  mockFetch((movieCd) => Promise.resolve(jsonResponse(detailResponse(`배우-${movieCd}`, '120'))));
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  globalThis.fetch = originalFetch;
});

describe('TitleSheet KOBIS 검색 (#215 PART A)', () => {
  test('검색→선택: 제목·원제·개봉일 반영 + detail로 배우/러닝타임 보강', async () => {
    render(<Harness />);
    fireEvent.change(titleInput(), { target: { value: '영화' } });
    await flushDebounce();
    expect(searchCalls).toEqual(['영화']);
    const btns = resultButtons();
    expect(btns.length).toBe(2);

    await act(async () => { btns[0].click(); await sleep(20); });
    expect(info().title).toBe('영화A');
    expect(info().titleOg).toBe('Movie A');
    expect(info().releaseDate).toBe('2014-11-06');
    expect(info().actors).toContain('배우-M001');
  });

  test('compositionend가 최종 커밋 값으로 재검색(#82 IME)', async () => {
    render(<Harness />);
    const input = titleInput();
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '기생충' } });
    fireEvent.compositionEnd(input);
    await flushDebounce();
    // 디바운스가 onChange+compositionend 스케줄을 한 번으로 합침.
    expect(searchCalls).toEqual(['기생충']);
    expect(resultButtons().length).toBe(2);
  });

  test('1글자 제목도 검색된다(#82 단일 문자 게이트)', async () => {
    render(<Harness />);
    fireEvent.change(titleInput(), { target: { value: '돈' } });
    await flushDebounce();
    expect(searchCalls).toEqual(['돈']);
  });

  test('공백만 입력하면 검색하지 않는다', async () => {
    render(<Harness />);
    fireEvent.change(titleInput(), { target: { value: '   ' } });
    await flushDebounce();
    expect(searchCalls).toEqual([]);
    expect(resultButtons().length).toBe(0);
  });

  test('detail 경합: 늦게 도착한 이전 선택의 detail이 최신을 덮지 않는다(#82 race)', async () => {
    const pending = new Map<string, (res: Response) => void>();
    mockFetch((movieCd) => new Promise<Response>((resolve) => pending.set(movieCd, resolve)));
    render(<Harness />);

    // A 선택 — detail 미해결.
    fireEvent.change(titleInput(), { target: { value: '영화' } });
    await flushDebounce();
    await act(async () => { resultButtons()[0].click(); await sleep(10); });
    expect(info().title).toBe('영화A');

    // 다시 검색해 B 선택 — A detail 여전히 미해결.
    fireEvent.change(titleInput(), { target: { value: '영화' } });
    await flushDebounce();
    await act(async () => { resultButtons()[1].click(); await sleep(10); });
    expect(info().title).toBe('영화B');

    // B detail 먼저 해결.
    await act(async () => { pending.get('M002')!(jsonResponse(detailResponse('배우B', '95'))); await sleep(10); });
    expect(info().actors).toBe('배우B');

    // A stale detail 늦게 도착 → 버려져야 함.
    await act(async () => { pending.get('M001')!(jsonResponse(detailResponse('배우A', '170'))); await sleep(10); });
    expect(info().actors).toBe('배우B');
  });
});
