/**
 * #735 완료조건 — 포스터 재업로드·재크롭이 하이라이트·형압 두 마스크 벌(embossStamps/Paths +
 * reliefStamps/Paths, 4필드)을 전부 빈 배열로 폐기하는지 검증한다. handleImageUpload가 포스터
 * 교체·재크롭 양쪽의 단일 진입점이라(usePhototicket.ts의 그 콜백 주석, c8) 여기 하나만 잠그면
 * 두 경로 모두 커버된다.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePhototicket } from '../src/hooks/usePhototicket';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('#735 포스터 재업로드·재크롭 시 마스크 4종 폐기', () => {
  test('하이라이트·형압 스탬프+올가미를 전부 칠한 뒤 재업로드하면 네 필드 모두 빈 배열이 된다', () => {
    const { result } = renderHook(() => usePhototicket());

    act(() => {
      result.current.handleImageUpload('blob:poster-a');
    });
    act(() => {
      result.current.addEmbossStamp({ x: 0.3, y: 0.3, r: 0.1 });
      result.current.addEmbossPath({ points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }, { x: 0.2, y: 0.2 }] });
    });
    act(() => {
      result.current.setEmbossEffect('relief');
    });
    act(() => {
      result.current.addEmbossStamp({ x: 0.6, y: 0.6, r: 0.1 });
      result.current.addEmbossPath({ points: [{ x: 0.7, y: 0.7 }, { x: 0.8, y: 0.7 }, { x: 0.8, y: 0.8 }] });
    });

    expect(result.current.state.embossStamps).toHaveLength(1);
    expect(result.current.state.embossPaths).toHaveLength(1);
    expect(result.current.state.reliefStamps).toHaveLength(1);
    expect(result.current.state.reliefPaths).toHaveLength(1);

    // 포스터 재업로드/재크롭 — usePosterCrop.onCropComplete도 결국 이 콜백으로 수렴한다.
    act(() => {
      result.current.handleImageUpload('blob:poster-b');
    });

    expect(result.current.state.embossStamps).toEqual([]);
    expect(result.current.state.embossPaths).toEqual([]);
    expect(result.current.state.reliefStamps).toEqual([]);
    expect(result.current.state.reliefPaths).toEqual([]);
  });
});
