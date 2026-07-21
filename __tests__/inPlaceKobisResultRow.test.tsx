/**
 * #476 회귀 — InPlaceFieldEditor(모바일 인플레이스 title 편집기) aid 패널의 KOBIS 결과 행.
 *
 * PR #478 리뷰 P1 대응:
 * 1. typeNm·directors·prdtStatNm이 행에 렌더되고, directors가 빈 배열이면 "감독 없음"으로 폴백한다.
 * 2. directors 필드 자체가 응답에 없어도(외부 API라 런타임 보증이 없다) 크래시하지 않는다
 *    (movie.directors?.length 가드, InPlaceFieldEditor.tsx).
 *
 * titleSheetSearch.test.tsx와 동일 패턴 — fetch 전역 스왑 + fake timer 디바운스.
 */
import { describe, expect, test, beforeEach, afterEach, jest } from 'bun:test';
import { act, useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { InPlaceFieldEditor } from '@/components/v2/InPlaceFieldEditor';

const MOVIE_WITH_DIRECTOR = {
  movieCd: 'M001', movieNm: '호프', movieNmEn: 'HOPE', openDt: '20260715',
  genreAlt: 'SF', nationAlt: '한국', prdtYear: '2026',
  typeNm: '장편', prdtStatNm: '개봉', directors: [{ peopleNm: '나홍진' }],
};
const MOVIE_NO_DIRECTOR = {
  movieCd: 'M002', movieNm: '외면의 빛', movieNmEn: '', openDt: '',
  genreAlt: '다큐멘터리', nationAlt: '기타', prdtYear: '2026',
  typeNm: '옴니버스', prdtStatNm: '기타', directors: [],
};
// 실제 KOBIS 응답 실측상 directors는 항상 오지만(#476), 외부 API라 런타임 검증이 없다
// (useKobisSearch.ts의 캐스팅) — 필드 자체가 누락된 malformed 응답을 시뮬레이션.
const MOVIE_MISSING_DIRECTORS_FIELD = {
  movieCd: 'M003', movieNm: '미상 영화', movieNmEn: '', openDt: '',
  genreAlt: '', nationAlt: '', prdtYear: '', typeNm: '단편', prdtStatNm: '기타',
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const originalFetch = globalThis.fetch;

function mockSearchFetch(movieList: unknown[]) {
  globalThis.fetch = ((_input: RequestInfo | URL) =>
    Promise.resolve(jsonResponse({ movieListResult: { movieList } }))) as typeof fetch;
}

// 인플레이스 오버레이 input은 rect(measureField의 결과)가 truthy일 때만 렌더된다
// (InPlaceFieldEditor.tsx의 `overlay = rect && (...)`) — wrapperEl/ticketEl에 실제 DOM을
// 줘야 measureField가 [data-field-tap="title"]을 찾아 null이 아닌 rect를 만든다.
// happy-dom은 getBoundingClientRect가 항상 0이지만, 이 테스트는 지오메트리가 아니라
// aid 패널의 KOBIS 결과 행 텍스트만 검증하므로 0-크기 rect로 충분하다.
function Harness() {
  const photo = usePhototicket();
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const [ticketEl, setTicketEl] = useState<HTMLDivElement | null>(null);
  return (
    <div>
      <div ref={setWrapperEl}>
        <div ref={setTicketEl}>
          <span data-field-tap="title"><span>제목</span></span>
        </div>
      </div>
      {wrapperEl && ticketEl && (
        <InPlaceFieldEditor
          photo={photo}
          field="title"
          wrapperEl={wrapperEl}
          ticketEl={ticketEl}
          onField={() => {}}
          onClose={() => {}}
          onLift={() => {}}
        />
      )}
    </div>
  );
}

const flushDebounce = () => act(async () => { jest.advanceTimersByTime(310); });
const titleInput = () => screen.getByRole('textbox') as HTMLInputElement;

beforeEach(() => {
  window.localStorage.clear();
  jest.useFakeTimers();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  globalThis.fetch = originalFetch;
  jest.useRealTimers();
});

describe('InPlaceFieldEditor KOBIS 결과 행 — 장편/단편/옴니버스·감독·개봉여부 (#476)', () => {
  test('감독 있음: typeNm·감독명·prdtStatNm이 행에 렌더된다', async () => {
    mockSearchFetch([MOVIE_WITH_DIRECTOR]);
    render(<Harness />);
    fireEvent.change(titleInput(), { target: { value: '호프' } });
    await flushDebounce();

    const row = screen.getByRole('option');
    expect(row.textContent).toContain('장편');
    expect(row.textContent).toContain('나홍진');
    expect(row.textContent).toContain('개봉');
  });

  test('감독 없음(빈 배열): "감독 없음"으로 폴백한다', async () => {
    mockSearchFetch([MOVIE_NO_DIRECTOR]);
    render(<Harness />);
    fireEvent.change(titleInput(), { target: { value: '외면' } });
    await flushDebounce();

    const row = screen.getByRole('option');
    expect(row.textContent).toContain('옴니버스');
    expect(row.textContent).toContain('감독 없음');
    expect(row.textContent).toContain('기타');
  });

  test('directors 필드 누락(malformed 응답)에도 크래시하지 않는다 (PR #478 리뷰 P1)', async () => {
    mockSearchFetch([MOVIE_MISSING_DIRECTORS_FIELD]);
    render(<Harness />);
    fireEvent.change(titleInput(), { target: { value: '미상' } });
    await flushDebounce();

    const row = screen.getByRole('option');
    expect(row.textContent).toContain('단편');
    expect(row.textContent).toContain('감독 없음');
  });
});
