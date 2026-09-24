import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useKobisSearch } from '@/hooks/useKobisSearch';
import { usePhototicket } from '@/hooks/usePhototicket';
import type { KobisMovie } from '@/types';

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  window.localStorage.clear();
});
const movie = (id: string): KobisMovie => ({ movieCd: id, movieNm: `영화 ${id}`, movieNmEn: id, openDt: '20260101', genreAlt: '', nationAlt: '', prdtYear: '2026' });
const detail = (actor = 'B 배우', runtime = '120') => Response.json({ movieInfoResult: { movieInfo: { actors: [{ peopleNm: actor }], showTm: runtime } } });

function setup() {
  const pending: ((response: Response) => void)[] = [];
  globalThis.fetch = (() => new Promise<Response>(resolve => pending.push(resolve))) as unknown as typeof fetch;
  const photo = renderHook(() => usePhototicket());
  act(() => photo.result.current.updateMovieInfo({ title: '영화 A', movieCd: 'A', actors: 'A 배우', runtime: '90 MIN' }));
  const mountPanel = () => renderHook(() => useKobisSearch({ apply: photo.result.current.beginMovieSelection }));
  const panel = mountPanel();
  let request: unknown;
  act(() => { request = panel.result.current.selectMovie(movie('B')); });
  const finish = async (index = 0, response = detail()) => {
    await act(async () => { pending[index](response); await request; });
  };
  return { photo, panel, mountPanel, finish, pending };
}

test('closing the input panel preserves detail enrichment for the same ticket', async () => {
  const { photo, panel, finish } = setup();
  expect(photo.result.current.state.movieInfo.title).toBe('영화 B');
  panel.unmount();
  await finish();
  expect(photo.result.current.state.movieInfo).toMatchObject({ title: '영화 B', actors: 'B 배우', runtime: '120 MIN' });
});

test('a new document rejects the old detail even after selecting the same movie', async () => {
  const { photo, panel, mountPanel, finish, pending } = setup();
  panel.unmount();
  act(() => photo.result.current.resetDocument());
  const nextPanel = mountPanel();
  let nextRequest: unknown;
  act(() => { nextRequest = nextPanel.result.current.selectMovie(movie('B')); });
  await act(async () => { pending[1](detail('새 문서 배우', '150')); await nextRequest; });
  await finish();
  expect(photo.result.current.state.movieInfo).toMatchObject({ title: '영화 B', actors: '새 문서 배우', runtime: '150 MIN' });
});

test('reset without another movie selection also rejects the old detail', async () => {
  const { photo, panel, finish } = setup();
  panel.unmount();
  act(() => photo.result.current.resetDocument());
  const before = photo.result.current.state.movieInfo;
  await finish();
  expect(photo.result.current.state.movieInfo).toEqual(before);
});

test('a reopened panel selecting another movie invalidates the old panel request', async () => {
  const { photo, panel, mountPanel, finish, pending } = setup();
  panel.unmount();
  const nextPanel = mountPanel();
  let nextRequest: unknown;
  act(() => { nextRequest = nextPanel.result.current.selectMovie(movie('C')); });
  await act(async () => { pending[1](detail('C 배우', '180')); await nextRequest; });
  await finish();
  expect(photo.result.current.state.movieInfo).toMatchObject({ title: '영화 C', actors: 'C 배우', runtime: '180 MIN' });
});

test('editing the title while detail is pending rejects the old movie response', async () => {
  const { photo, finish } = setup();
  act(() => photo.result.current.updateMovieInfo({ title: '직접 입력' }));
  await finish();
  expect(photo.result.current.state.movieInfo).toMatchObject({ title: '직접 입력', actors: 'A 배우', runtime: '90 MIN' });
});

test('unrelated ticket edits do not cancel detail enrichment', async () => {
  const { photo, panel, finish } = setup();
  panel.unmount();
  act(() => photo.result.current.updateMovieInfo({ seat: 'A1' }));
  await finish();
  expect(photo.result.current.state.movieInfo).toMatchObject({ seat: 'A1', actors: 'B 배우', runtime: '120 MIN' });
});

test('undo snapshot restoration invalidates pending detail', async () => {
  const { photo, finish } = setup();
  const { movieInfo, components, fieldVisibility } = photo.result.current.state;
  const snapshot = { movieInfo: { ...movieInfo, title: '복원된 영화', movieCd: 'A' }, components, fieldVisibility };
  act(() => photo.result.current.restoreSnapshot(snapshot));
  await finish();
  expect(photo.result.current.state.movieInfo).toEqual(snapshot.movieInfo);
});

test('undo to a snapshot of the same movie keeps pending detail', async () => {
  const { photo, finish } = setup();
  const { movieInfo, components, fieldVisibility } = photo.result.current.state;
  act(() => photo.result.current.restoreSnapshot({ movieInfo: { ...movieInfo }, components, fieldVisibility }));
  await finish();
  expect(photo.result.current.state.movieInfo).toMatchObject({ title: '영화 B', actors: 'B 배우', runtime: '120 MIN' });
});

test('rewriting the same title keeps pending detail', async () => {
  const { photo, finish } = setup();
  act(() => photo.result.current.updateMovieInfo({ title: '영화 B' }));
  await finish();
  expect(photo.result.current.state.movieInfo).toMatchObject({ title: '영화 B', movieCd: 'B', actors: 'B 배우' });
});

test('changing only movieCd rejects the old movie response', async () => {
  const { photo, finish } = setup();
  act(() => photo.result.current.updateMovieInfo({ movieCd: 'Z' }));
  await finish();
  expect(photo.result.current.state.movieInfo).toMatchObject({ movieCd: 'Z', actors: 'A 배우', runtime: '90 MIN' });
});
