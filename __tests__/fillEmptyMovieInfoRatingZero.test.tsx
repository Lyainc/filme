/**
 * #638 P2 회귀 — fillEmptyMovieInfo가 `!prev[key]` 진리성 체크로 "빈 필드"를 판정하면 숫자
 * 필드의 0(rating의 미입력 sentinel, usePhototicket.ts INITIAL_STATE 주석 참고)까지 "비어
 * 있다"고 오판해 덮어쓴다. 지금은 KOBIS 보강(kobisLookup.ts)이 문자열 필드만 채워 넣어 실제
 * 호출부에서 rating이 이 경로를 안 타므로 실질 위험은 없지만, 라우트 테스트를 쓰는 김에
 * 이 truthy 체크 자체를 nullish/빈 문자열 기준으로 고정해 둔다.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('#638 fillEmptyMovieInfo — 숫자 필드의 0을 빈 값으로 오판하지 않는다', () => {
  test('rating이 기본값 0(미입력)이어도 fillEmptyMovieInfo는 덮어쓰지 않는다', () => {
    const { result } = renderHook(() => usePhototicket());
    expect(result.current.state.movieInfo.rating).toBe(0);

    act(() => {
      result.current.fillEmptyMovieInfo({ rating: 8 });
    });

    // rating=0은 `!0``===true`라 falsy 체크로는 "빈 값"처럼 보이지만, 실제로는 0이라는
    // 값이 이미 들어 있는 상태다 — fillEmptyMovieInfo는 문자열 빈 값(''/undefined/null)만
    // 채워야 하고, rating처럼 항상 값이 존재하는(0 포함) 필드는 건드리면 안 된다.
    expect(result.current.state.movieInfo.rating).toBe(0);
  });

  test('빈 문자열 필드(titleOg)는 그대로 채워진다 (기존 동작 유지)', () => {
    const { result } = renderHook(() => usePhototicket());
    expect(result.current.state.movieInfo.titleOg).toBe('');

    act(() => {
      result.current.fillEmptyMovieInfo({ titleOg: 'Parasite' });
    });

    expect(result.current.state.movieInfo.titleOg).toBe('Parasite');
  });

  test('이미 채워진 문자열 필드(title)는 덮어쓰지 않는다 (기존 동작 유지)', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ title: '기생충' });
    });

    act(() => {
      result.current.fillEmptyMovieInfo({ title: 'Parasite' });
    });

    expect(result.current.state.movieInfo.title).toBe('기생충');
  });
});
