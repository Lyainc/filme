/**
 * TMDB 인앱 포스터 검색 진입 회귀(#537).
 *
 * posterCropPipeline.test.tsx가 검증하는 크롭 상태머신은 여기서 다시 재지 않는다 — 이 파일이
 * 지키는 계약은 "TMDB 경로가 파일 선택 경로와 같은 crop.openFile 합류점에서 만난다"는 것
 * 하나다(c1·c7). getCroppedImg는 canvas 의존이라 posterCropPipeline과 같은 이유로 mock한다.
 *
 * fetch는 titleSheetSearch.test.tsx 컨벤션대로 전역 스왑(mock.module 미사용 — 전역 누수 회피).
 */
import { describe, expect, test, afterAll, afterEach, mock, spyOn } from 'bun:test';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mobileShellProps } from './shellHarness';

let cropN = 0;
const realImageCrop = { ...require('@/utils/imageCrop') };
mock.module('@/utils/imageCrop', () => ({
  ...realImageCrop,
  getCroppedImg: () => Promise.resolve(`blob:cropped-${++cropN}`),
}));

const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } = require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');

const MOVIE_A = { id: 1, title: '인터스텔라', release_date: '2014-11-06', poster_path: '/a.jpg' };
const MOVIE_B = { id: 2, title: '인터스텔라 리마스터', release_date: '2024-01-01', poster_path: null };
const POSTER_1 = { file_path: '/p1.jpg', width: 2000, height: 3000 };
const POSTER_2 = { file_path: '/p2.jpg', width: 2000, height: 3000 };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

let kobisSearchCalls: string[];
function mockFetch(opts: {
  searchResults?: typeof MOVIE_A[];
  posters?: typeof POSTER_1[];
  imageFails?: boolean;
  kobisDetail?: { actors?: string; runtime?: string };
} = {}) {
  const { searchResults = [MOVIE_A], posters = [POSTER_1, POSTER_2], imageFails = false, kobisDetail } = opts;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/tmdb/search')) {
      return Promise.resolve(jsonResponse({ results: searchResults }));
    }
    if (url.startsWith('/api/tmdb/images')) {
      return Promise.resolve(jsonResponse({ posters }));
    }
    if (url.startsWith('/api/tmdb/image')) {
      if (imageFails) return Promise.resolve(new Response(null, { status: 500 }));
      return Promise.resolve(new Response(new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' })));
    }
    if (url.startsWith('/api/kobis/search')) {
      kobisSearchCalls.push(new URLSearchParams(url.split('?')[1]).get('movieNm') ?? '');
      if (!kobisDetail) return Promise.resolve(jsonResponse({ movieListResult: { movieList: [] } }));
      return Promise.resolve(jsonResponse({
        movieListResult: { movieList: [{ movieCd: 'M001', movieNm: '인터스텔라', movieNmEn: 'Interstellar', openDt: '20141106' }] },
      }));
    }
    if (url.startsWith('/api/kobis/detail')) {
      return Promise.resolve(jsonResponse({
        movieInfoResult: {
          movieInfo: {
            nations: [{ nationNm: '미국' }],
            actors: kobisDetail?.actors ? [{ peopleNm: '', peopleNmEn: kobisDetail.actors }] : [],
            showTm: kobisDetail?.runtime,
          },
        },
      }));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  }) as typeof fetch;
}

function MobileHarness({ onPhoto }: { onPhoto?: (p: ReturnType<typeof usePhototicket>) => void } = {}) {
  const photo = usePhototicket();
  onPhoto?.(photo);
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

const openTmdb = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: '영화 검색해서 가져오기' }));
const dialog = () => screen.getByRole('dialog', { name: '영화 검색해서 포스터 가져오기' });
const cropDialog = () => screen.queryByRole('dialog', { name: '포스터 크롭' });

async function searchAndPick(user: ReturnType<typeof userEvent.setup>, movieTitle = '인터스텔라') {
  await openTmdb(user);
  await user.type(screen.getByRole('textbox', { name: '영화 제목 검색' }), movieTitle);
  await user.click(screen.getByRole('button', { name: '검색' }));
  await user.click(await screen.findByText(movieTitle));
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  cropN = 0;
  kobisSearchCalls = [];
});

afterAll(() => {
  mock.module('@/utils/imageCrop', () => realImageCrop);
});

describe('TMDB 포스터 검색 진입(#537)', () => {
  test('랜딩에 보조 CTA가 있고, 탭하면 검색 모달이 열린다', async () => {
    mockFetch();
    const user = userEvent.setup();
    render(<MobileHarness />);

    await openTmdb(user);
    expect(dialog()).toBeTruthy();
  });

  test('검색 → 결과 선택 → 판본 선택 → 크롭 파이프라인 합류(c1·c7)', async () => {
    mockFetch();
    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);

    await searchAndPick(user);
    // posters 뷰 — 판본 그리드가 뜬다.
    const posterBtn = await screen.findByRole('button', { name: `포스터 판본 선택 ${POSTER_1.file_path}` });
    await user.click(posterBtn);

    // TMDB에서 받은 File이 그대로 crop.openFile로 들어가 기존 크롭 모달이 뜬다 — 이 시점부터는
    // posterCropPipeline.test.tsx가 이미 검증한 파일-선택 경로와 완전히 같은 코드다.
    await screen.findByRole('dialog', { name: '포스터 크롭' });
    expect(dialog).toThrow(); // 검색 모달은 닫혔다 — dialog()는 못 찾으면 throw.

    const img = document.querySelector('[role="dialog"] img') as HTMLImageElement;
    Object.defineProperty(img, 'naturalWidth', { value: 2000, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 3000, configurable: true });
    Object.defineProperty(img, 'width', { value: 2000, configurable: true });
    Object.defineProperty(img, 'height', { value: 3000, configurable: true });
    fireEvent.load(img);
    await user.click(screen.getByRole('button', { name: '적용' }));

    expect(photo.state.croppedImageUrl).toBe(`blob:cropped-${cropN}`);
    expect(cropDialog()).toBeNull();
  });

  test('c8 — 빈 필드만 KOBIS로 채워진다(이미 입력한 값은 안 덮는다)', async () => {
    mockFetch({ kobisDetail: { actors: 'Matthew McConaughey', runtime: '169' } });
    const user = userEvent.setup();
    let photo!: ReturnType<typeof usePhototicket>;
    render(<MobileHarness onPhoto={(p) => { photo = p; }} />);

    // 사용자가 이미 손으로 채운 값 — TMDB 확정 후에도 안 덮여야 한다.
    act(() => { photo.updateMovieInfo({ actors: '내가 직접 입력한 배우' }); });

    await searchAndPick(user);
    const posterBtn = await screen.findByRole('button', { name: `포스터 판본 선택 ${POSTER_1.file_path}` });
    await user.click(posterBtn);
    await screen.findByRole('dialog', { name: '포스터 크롭' });

    await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); // triggerKobisLookup의 .then 마이크로태스크 flush

    expect(kobisSearchCalls).toContain('인터스텔라');
    expect(photo.state.movieInfo.title).toBe('인터스텔라'); // 비어 있던 title은 채워진다
    expect(photo.state.movieInfo.actors).toBe('내가 직접 입력한 배우'); // 이미 있던 값은 유지
  });

  test('ac4 — 검색 결과가 없으면 파일 업로드로 전환하는 버튼이 뜬다', async () => {
    mockFetch({ searchResults: [] });
    const user = userEvent.setup();
    render(<MobileHarness />);

    await openTmdb(user);
    await user.type(screen.getByRole('textbox', { name: '영화 제목 검색' }), '없는영화');
    await user.click(screen.getByRole('button', { name: '검색' }));

    const fallback = await screen.findByRole('button', { name: '파일 업로드로 전환' });
    const posterFileInput = document.querySelector('input[type="file"][accept*="jpeg"]') as HTMLInputElement;
    const openFileDialog = spyOn(posterFileInput, 'click');
    await user.click(fallback);

    expect(openFileDialog).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '영화 검색해서 포스터 가져오기' })).toBeNull();
  });

  test('ac4 — 포스터가 없는 영화는 판본 뷰에서 빈 상태 + 업로드 전환을 보여준다', async () => {
    mockFetch({ posters: [] });
    const user = userEvent.setup();
    render(<MobileHarness />);

    await searchAndPick(user);
    expect(await screen.findByText('이 영화는 포스터가 없어요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '파일 업로드로 전환' })).toBeTruthy();
  });
});
