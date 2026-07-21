/**
 * #215 PART A — FieldEditorBody TitleSheet의 KOBIS 검색 회귀.
 * (구 FieldEditSheet 하우징은 #355에서 제거 — 본문을 직접 렌더한다.)
 *
 * TitleSheet는 useKobisSearch 공용 훅의 KOBIS 검색(디바운스→/api/kobis/search→선택 시
 * /api/kobis/detail 보강, #82에서 실제 회귀가 있던 코드)을 사용한다. 데스크톱 전용
 * MovieInfoForm이 같은 훅을 쓰던 시절의 회귀 시나리오를 이 본문에도 건다(MovieInfoForm
 * 자체는 #479 이후 dead code로 제거됨): 검색→선택 반영, IME compositionend 재검색,
 * 1글자 제목, 공백 무검색, detail 경합 가드(detailRunRef).
 *
 * fetch는 글로벌 스왑으로 mock(공유 모듈 mock.module 미사용 — 전역 누수 회피). 상호작용은
 * fieldSheets 패턴대로 testing-library render + fireEvent.
 */
import { describe, expect, test, beforeEach, afterEach, jest } from 'bun:test';
import { act, useEffect, useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { useExportReady } from '@/hooks/useExportReady';
import { FieldEditorBody } from '@/components/v2/FieldEditorBody';

const MOVIE_A = {
  movieCd: 'M001', movieNm: '영화A', movieNmEn: 'Movie A', openDt: '20141106', genreAlt: '드라마', nationAlt: '한국', prdtYear: '2014',
  typeNm: '장편', prdtStatNm: '개봉', directors: [{ peopleNm: '감독A' }],
};
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
  return <FieldEditorBody target="title" photo={photo} />;
}

// OCR이 채운 제목을 들고 시트를 여는 상황 재현 — 제목을 먼저 seed하고, 그 값이 이미
// 있는 상태로 TitleSheet를 처음 마운트한다(#383).
function PrefilledHarness({ initialTitle }: { initialTitle: string }) {
  const photo = usePhototicket();
  photoRef = photo;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    photo.updateMovieInfo({ title: initialTitle });
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return mounted ? <FieldEditorBody target="title" photo={photo} /> : null;
}

// 현재 편집 표면(TitleSheet)이 KOBIS 조회 중 export를 게이팅하지 않는지 본다(#284: pendingFetch
// 게이트 제거 회귀). canExport = useExportReady(state 파생) 하나라 셸 없이 시트+훅만으로 검증된다.
function GatingHarness() {
  const photo = usePhototicket();
  photoRef = photo;
  const canExport = useExportReady({ state: photo.state });
  return (
    <>
      <div data-testid="export">{canExport ? 'ready' : 'blocked'}</div>
      <FieldEditorBody target="title" photo={photo} />
    </>
  );
}

// 300ms 디바운스를 fake timer로 발화시킨다 — act(async)가 뒤이은 fetch/json/setState 마이크로태스크
// 체인도 settle될 때까지 흡수한다(React act의 표준 fake-timer 패턴).
const flushDebounce = () => act(async () => { jest.advanceTimersByTime(310); });
// role=combobox(#198 재구현) — textbox가 아니다.
const titleInput = () => screen.getByRole('combobox') as HTMLInputElement;
const resultButtons = () => screen.queryAllByRole('button').filter((b) => /영화[AB]/.test(b.textContent || ''));
const info = () => photoRef.state.movieInfo;

beforeEach(() => {
  window.localStorage.clear();
  searchCalls = [];
  mockFetch((movieCd) => Promise.resolve(jsonResponse(detailResponse(`배우-${movieCd}`, '120'))));
  jest.useFakeTimers();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

describe('TitleSheet KOBIS 검색 (#215 PART A)', () => {
  test('검색→선택: 제목·원제·개봉일 반영 + detail로 배우/러닝타임 보강', async () => {
    render(<Harness />);
    fireEvent.change(titleInput(), { target: { value: '영화' } });
    await flushDebounce();
    expect(searchCalls).toEqual(['영화']);
    const btns = resultButtons();
    expect(btns.length).toBe(2);

    await act(async () => { btns[0].click(); });
    expect(info().title).toBe('영화A');
    expect(info().titleOg).toBe('Movie A');
    expect(info().releaseDate).toBe('2014-11-06');
    expect(info().actors).toContain('배우-M001');
  });

  test('검색 결과 행에 typeNm·감독·개봉여부가 렌더된다(#476 모바일 인플레이스 수렴, KobisResultList 공용화)', async () => {
    render(<Harness />);
    fireEvent.change(titleInput(), { target: { value: '영화' } });
    await flushDebounce();
    const [rowA] = resultButtons();
    expect(rowA.textContent).toContain('장편');
    expect(rowA.textContent).toContain('감독A');
    expect(rowA.textContent).toContain('개봉');
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
    await act(async () => { resultButtons()[0].click(); });
    expect(info().title).toBe('영화A');

    // 다시 검색해 B 선택 — A detail 여전히 미해결.
    fireEvent.change(titleInput(), { target: { value: '영화' } });
    await flushDebounce();
    await act(async () => { resultButtons()[1].click(); });
    expect(info().title).toBe('영화B');

    // B detail 먼저 해결.
    await act(async () => { pending.get('M002')!(jsonResponse(detailResponse('배우B', '95'))); });
    expect(info().actors).toBe('배우B');

    // A stale detail 늦게 도착 → 버려져야 함.
    await act(async () => { pending.get('M001')!(jsonResponse(detailResponse('배우A', '170'))); });
    expect(info().actors).toBe('배우B');
  });

  test('OCR이 채운 제목으로 시트를 열면 마운트 시 자동으로 후보 검색이 뜬다(#383)', async () => {
    render(<PrefilledHarness initialTitle="영화" />);
    await flushDebounce();
    expect(searchCalls).toEqual(['영화']);
    expect(resultButtons().length).toBe(2);
  });

  test('detail 조회가 미해결이어도 export 게이팅은 그대로 열려 있다(#284 pending 게이트 제거)', async () => {
    const pending = new Map<string, (res: Response) => void>();
    mockFetch((movieCd) => new Promise<Response>((resolve) => pending.set(movieCd, resolve)));
    render(<GatingHarness />);
    // 포스터는 검색으로 안 채워지는 유일한 필수 입력이라 직접 seed. 나머지 3필드는 선택으로 채워진다.
    act(() => { photoRef.handleImageUpload('blob:test-poster'); });

    fireEvent.change(titleInput(), { target: { value: '영화' } });
    await flushDebounce();
    // A 선택: 제목·원제·개봉일이 즉시 반영되고 detail(M001)은 미해결로 남는다.
    await act(async () => { resultButtons()[0].click(); });
    expect(pending.has('M001')).toBe(true);
    // detail in-flight인데도 export는 열려 있어야 한다 — 현재 표면은 pending을 게이팅하지 않는다.
    expect(screen.getByTestId('export').textContent).toBe('ready');

    // detail 해결 후에도 동일.
    await act(async () => { pending.get('M001')!(jsonResponse(detailResponse('배우A', '120'))); });
    expect(screen.getByTestId('export').textContent).toBe('ready');
  });
});

describe('TitleSheet 키보드 접근성 (#198 재구현)', () => {
  test('ArrowDown/Up으로 하이라이트가 이동하고 양끝에서 순환한다', async () => {
    render(<Harness />);
    const input = titleInput();
    fireEvent.change(input, { target: { value: '영화' } });
    await flushDebounce();
    expect(resultButtons().length).toBe(2);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(`kobis-option-${MOVIE_A.movieCd}`);
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(`kobis-option-${MOVIE_B.movieCd}`);

    // 마지막에서 ArrowDown → 처음으로 순환
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(`kobis-option-${MOVIE_A.movieCd}`);

    // 첫 항목에서 ArrowUp → 마지막으로 순환
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toBe(`kobis-option-${MOVIE_B.movieCd}`);
  });

  test('Enter로 하이라이트된 항목을 선택한다', async () => {
    render(<Harness />);
    const input = titleInput();
    fireEvent.change(input, { target: { value: '영화' } });
    await flushDebounce();

    fireEvent.keyDown(input, { key: 'ArrowDown' }); // MOVIE_A
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // MOVIE_B
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(info().title).toBe('영화B');
  });

  test('하이라이트 없이 Enter를 눌러도 아무것도 선택하지 않는다', async () => {
    render(<Harness />);
    const input = titleInput();
    fireEvent.change(input, { target: { value: '영화' } });
    await flushDebounce();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(info().title).toBe('영화');
  });

  test('Escape로 드롭다운이 닫히고 aria-expanded가 false로 바뀐다', async () => {
    render(<Harness />);
    const input = titleInput();
    fireEvent.change(input, { target: { value: '영화' } });
    await flushDebounce();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe('kobis-results-listbox');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    expect(resultButtons().length).toBe(0);
  });

  test('로딩 중엔 role=status/aria-live=polite로 안내한다', async () => {
    let resolveSearch: (res: Response) => void = () => {};
    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/kobis/search')) {
        return new Promise<Response>((resolve) => {
          resolveSearch = resolve;
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }) as typeof fetch;

    render(<Harness />);
    fireEvent.change(titleInput(), { target: { value: '영화' } });
    await act(async () => { jest.advanceTimersByTime(310); });

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('Loading…');

    await act(async () => { resolveSearch(jsonResponse(SEARCH_RESPONSE)); });
  });
});
