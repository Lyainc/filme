import { afterEach, describe, expect, test } from 'bun:test';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePhototicket } from '../src/hooks/usePhototicket';

const KEY = 'filme:phototicket:v1';

afterEach(() => {
  window.localStorage.clear();
});

describe('#178 usePhototicket localStorage 영속화', () => {
  test('movieInfo/components/fieldVisibility 변경이 저장된다(포스터 제외)', async () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateMovieInfo({ title: '기생충' });
      result.current.updateComponents({ themeColor: '#8E4E69' });
    });
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
      expect(saved.movieInfo?.title).toBe('기생충');
      expect(saved.components?.themeColor).toBe('#8E4E69');
      // 포스터(croppedImageUrl)·recommendedColors는 직렬화 대상이 아니다.
      expect(saved.croppedImageUrl).toBeUndefined();
      expect(saved.recommendedColors).toBeUndefined();
    });
  });

  test('마운트 시 저장분을 복원한다', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      movieInfo: { title: '복원된제목' },
      components: { texture: 'vintage' },
      fieldVisibility: { actors: true },
    }));
    const { result } = renderHook(() => usePhototicket());
    await waitFor(() => {
      expect(result.current.state.movieInfo.title).toBe('복원된제목');
    });
    // 얕은 병합 — 저장에 없는 필드는 INITIAL 기본값 유지.
    expect(result.current.state.components.texture).toBe('vintage');
    expect(result.current.state.components.layout).toBe('minimal');
    expect(result.current.state.fieldVisibility.actors).toBe(true);
  });

  test('업로드 로고 blob: URL은 저장 시 비운다(재시작 후 죽은 참조)', async () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateComponents({ chain: 'blob:abc', chainLabel: 'CGV' });
    });
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
      expect(saved.components?.chain).toBe('');
      expect(saved.components?.chainLabel).toBe('CGV'); // 라벨은 유지
    });
  });

  test('손상된 저장 데이터는 무시하고 INITIAL로 시작', async () => {
    window.localStorage.setItem(KEY, 'not-json{');
    const { result } = renderHook(() => usePhototicket());
    // throw 없이 기본값으로 마운트.
    expect(result.current.state.movieInfo.title).toBe('');
  });
});
