/**
 * Regression tests for #82 — KOBIS autocomplete dropout.
 *
 * Covers the three confirmed code-level bugs:
 *  1. IME composition: Korean IMEs keep the last syllable composing until an
 *     explicit commit, so a compositionend-gated search never fired when the
 *     user simply stopped typing. Search must now schedule mid-composition.
 *  2. 2-char gate: single-character titles (e.g. «돈») could never enter the
 *     autocomplete path. Search must fire from the first non-space character.
 *  3. Detail race: rapidly selecting movie A then movie B let A's slower
 *     /api/kobis/detail response overwrite B's actors/runtime.
 */
import React, { useState } from 'react';
import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import MovieInfoForm from '../src/components/MovieInfoForm';
import type { MovieInfo } from '../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOVIE_A = {
  movieCd: 'M001',
  movieNm: '영화A',
  movieNmEn: 'Movie A',
  openDt: '20141106',
  genreAlt: '드라마',
  nationAlt: '한국',
  prdtYear: '2014',
};

const MOVIE_B = {
  movieCd: 'M002',
  movieNm: '영화B',
  movieNmEn: 'Movie B',
  openDt: '20190320',
  genreAlt: 'SF',
  nationAlt: '한국',
  prdtYear: '2019',
};

const SEARCH_RESPONSE = {
  movieListResult: { movieList: [MOVIE_A, MOVIE_B] },
};

function detailResponse(actorName: string, showTm: string) {
  return {
    movieInfoResult: {
      movieInfo: {
        nations: [{ nationNm: '한국' }],
        actors: [{ peopleNm: actorName, peopleNmEn: '' }],
        showTm,
      },
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Harness — owns MovieInfo state like the real EditorCanvas parent
// ---------------------------------------------------------------------------

let latestInfo: MovieInfo;
let latestPending = false;

function Harness() {
  const [info, setInfo] = useState<MovieInfo>({ title: '', titleOg: '', rating: 0 });
  latestInfo = info;
  return (
    <MovieInfoForm
      movieInfo={info}
      onChange={(patch) => setInfo((prev) => ({ ...prev, ...patch }))}
      onPendingFetchChange={(pending) => {
        latestPending = pending;
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Past the 300ms debounce + a settle margin. */
const flushDebounce = () => act(async () => { await sleep(380); });

function setNativeValue(input: HTMLInputElement, value: string) {
  // Controlled inputs: write through the native setter so React's value
  // tracking detects the change, then emit a real `input` event.
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    'value'
  )?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function typeValue(input: HTMLInputElement, value: string) {
  return act(async () => {
    setNativeValue(input, value);
  });
}

function dispatchComposition(input: HTMLInputElement, type: 'compositionstart' | 'compositionend') {
  return act(async () => {
    input.dispatchEvent(new Event(type, { bubbles: true }));
  });
}

function titleInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('#movieTitle') as HTMLInputElement;
}

function resultButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('ul button')) as HTMLButtonElement[];
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
let container: HTMLElement;
let root: Root;
let searchCalls: string[];

function mockFetch(detailImpl: (movieCd: string) => Promise<Response>) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/kobis/search')) {
      const term = new URLSearchParams(url.split('?')[1]).get('movieNm') ?? '';
      searchCalls.push(term);
      return Promise.resolve(jsonResponse(SEARCH_RESPONSE));
    }
    if (url.startsWith('/api/kobis/detail')) {
      const movieCd = new URLSearchParams(url.split('?')[1]).get('movieCd') ?? '';
      return detailImpl(movieCd);
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as typeof fetch;
}

beforeEach(async () => {
  searchCalls = [];
  latestPending = false;
  mockFetch((movieCd) => Promise.resolve(jsonResponse(detailResponse(`배우-${movieCd}`, '120'))));
  container = document.createElement('div');
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<Harness />);
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// 1. IME composition
// ---------------------------------------------------------------------------

describe('IME composition (#82 suspect 1)', () => {
  test('search fires while composition is still open (no compositionend)', async () => {
    const input = titleInput(container);

    await dispatchComposition(input, 'compositionstart');
    await typeValue(input, '기생충'); // last syllable still composing
    await flushDebounce();

    expect(searchCalls).toEqual(['기생충']);
    expect(resultButtons(container).length).toBe(2);
  });

  test('compositionend still reschedules with the committed value', async () => {
    const input = titleInput(container);

    await dispatchComposition(input, 'compositionstart');
    await typeValue(input, '기생충');
    await dispatchComposition(input, 'compositionend');
    await flushDebounce();

    // Debounce collapses the onChange + compositionend schedules into one call.
    expect(searchCalls).toEqual(['기생충']);
    expect(resultButtons(container).length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2. Single-character gate
// ---------------------------------------------------------------------------

describe('single-character titles (#82 suspect 2)', () => {
  test('a 1-char title like «돈» triggers autocomplete', async () => {
    const input = titleInput(container);

    await typeValue(input, '돈');
    await flushDebounce();

    expect(searchCalls).toEqual(['돈']);
    expect(resultButtons(container).length).toBe(2);
  });

  test('1-char value committed via compositionend also schedules a search', async () => {
    const input = titleInput(container);

    await dispatchComposition(input, 'compositionstart');
    await typeValue(input, '돈');
    await dispatchComposition(input, 'compositionend');
    await flushDebounce();

    expect(searchCalls).toEqual(['돈']);
  });

  test('clearing the input hides the dropdown and schedules nothing', async () => {
    const input = titleInput(container);

    await typeValue(input, '돈');
    await flushDebounce();
    expect(resultButtons(container).length).toBe(2);

    await typeValue(input, '');
    await flushDebounce();

    expect(searchCalls).toEqual(['돈']); // no extra call for the empty value
    expect(resultButtons(container).length).toBe(0);
  });

  test('whitespace-only input never searches', async () => {
    const input = titleInput(container);

    await typeValue(input, '   ');
    await flushDebounce();

    expect(searchCalls).toEqual([]);
    expect(resultButtons(container).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Detail-fetch race on rapid consecutive selection
// ---------------------------------------------------------------------------

describe('detail fetch race (#82 suspect 4)', () => {
  test('stale detail response from a previous selection cannot overwrite the latest', async () => {
    const pendingDetails = new Map<string, (res: Response) => void>();
    mockFetch(
      (movieCd) =>
        new Promise<Response>((resolve) => {
          pendingDetails.set(movieCd, resolve);
        })
    );

    const input = titleInput(container);
    await typeValue(input, '영화');
    await flushDebounce();
    expect(resultButtons(container).length).toBe(2);

    // Select movie A — its detail fetch stays in flight.
    await act(async () => {
      resultButtons(container)[0].click();
    });
    expect(latestInfo.title).toBe('영화A');
    expect(latestPending).toBe(true);

    // Re-open results (cache hit) and select movie B while A is unresolved.
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });
    expect(resultButtons(container).length).toBe(2);
    await act(async () => {
      resultButtons(container)[1].click();
    });
    expect(latestInfo.title).toBe('영화B');

    // B's detail resolves first…
    await act(async () => {
      pendingDetails.get('M002')!(jsonResponse(detailResponse('배우B', '95')));
      await sleep(10);
    });
    expect(latestInfo.actors).toBe('배우B');
    expect(latestPending).toBe(false);

    // …then A's stale detail arrives late and must be discarded.
    await act(async () => {
      pendingDetails.get('M001')!(jsonResponse(detailResponse('배우A', '170')));
      await sleep(10);
    });

    expect(latestInfo.actors).toBe('배우B');
    expect(latestInfo.runtime).not.toBe('170분');
    expect(latestPending).toBe(false);
  });

  test('happy path: a single selection fills actors/runtime from detail', async () => {
    const input = titleInput(container);
    await typeValue(input, '영화');
    await flushDebounce();

    await act(async () => {
      resultButtons(container)[0].click();
      await sleep(10);
    });

    expect(latestInfo.title).toBe('영화A');
    expect(latestInfo.titleOg).toBe('Movie A');
    expect(latestInfo.releaseDate).toBe('2014-11-06');
    expect(latestInfo.actors).toContain('배우-M001');
    expect(latestPending).toBe(false);
  });
});
