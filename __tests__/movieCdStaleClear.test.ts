/**
 * claude-review PR #397 P1(#379 후속) — title을 movieCd 없이 단독으로 바꾸면(수동 편집)
 * 이전 KOBIS 선택의 movieCd가 그대로 남아 바코드 fallback이 화면과 다른 영화의 movieCd를
 * 계속 인코딩했다. title+movieCd를 같이 실어 보내는 KOBIS 선택/보강·OCR undo 스냅샷 경로는
 * 그대로 유지되는지도 함께 검증한다.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePhototicket } from '../src/hooks/usePhototicket';

afterEach(() => {
  cleanup();
});

describe('usePhototicket.updateMovieInfo — stale movieCd 무효화', () => {
  test('title만 단독으로 바뀌면(수동 편집) movieCd가 함께 지워진다', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ title: '그랜드 부다페스트 호텔', movieCd: '20147727' });
    });
    expect(result.current.state.movieInfo.movieCd).toBe('20147727');

    act(() => {
      result.current.updateMovieInfo({ title: '다른 제목' });
    });
    expect(result.current.state.movieInfo.movieCd).toBeUndefined();
    expect(result.current.state.movieInfo.title).toBe('다른 제목');
  });

  test('title과 movieCd를 같이 보내면(KOBIS 재선택) 새 movieCd로 그대로 반영된다', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ title: '영화A', movieCd: 'M001' });
    });
    act(() => {
      result.current.updateMovieInfo({ title: '영화B', movieCd: 'M002' });
    });
    expect(result.current.state.movieInfo.movieCd).toBe('M002');
  });

  test('title 없는 patch(다른 필드)는 movieCd를 건드리지 않는다', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ title: '그랜드 부다페스트 호텔', movieCd: '20147727' });
    });
    act(() => {
      result.current.updateMovieInfo({ theater: 'CGV 용산아이파크몰' });
    });
    expect(result.current.state.movieInfo.movieCd).toBe('20147727');
  });

  test('title이 같은 값으로 다시 와도(no-op) movieCd는 지워지지 않는다', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ title: '그랜드 부다페스트 호텔', movieCd: '20147727' });
    });
    act(() => {
      result.current.updateMovieInfo({ title: '그랜드 부다페스트 호텔' });
    });
    expect(result.current.state.movieInfo.movieCd).toBe('20147727');
  });
});
