/**
 * Regression test for #489 — 자동 임시저장이 이미지까지 복원되는지.
 *
 * 배경: saveDraft()는 텍스트/설정만 localStorage(filme:phototicket:v1)에 저장하고 포스터·로고·
 * 서명은 blob: URL이라 그대로 버렸다(새로고침하면 죽은 참조). #489는 그 이미지 바이트를
 * IndexedDB에 Blob으로 영속해 하드 새로고침 후에도 편집 셸로 조용히 복원되게 한다.
 *
 * happy-dom은 IndexedDB를 구현하지 않으므로(src/utils/imageDb.ts가 실제로 그 위에서 도는지는
 * 이 스위트의 범위 밖 — imageDb.ts 자체는 브라우저 API만 감싸는 얇은 레이어라 별도 검증 불필요),
 * @/utils/imageDb를 인메모리 Map으로 대체해 usePhototicket이 그 모듈을 올바르게 호출/반응하는지만
 * 검증한다. "하드 새로고침"은 한 렌더 트리를 unmount하고 새 usePhototicket 인스턴스를 mount해
 * 흉내낸다 — fakeStore(모듈 스코프)와 실제 window.localStorage는 그대로 남아있으므로 실제
 * 새로고침과 같은 조건이다.
 */
import { afterEach, beforeEach, describe, expect, test, mock, spyOn } from 'bun:test';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

const KEY = 'filme:phototicket:v1';

// imageDb는 인메모리 Map으로 대체 — usePhototicket이 saveImages/loadImages/clearImages를
// 올바른 시점에 호출하는지만 본다. shouldFail 토글로 IndexedDB 미지원/프라이빗 모드/용량초과를
// 흉내낸다(#489 결정 5: 그럴 때도 throw 없이 조용히 폴백해야 한다).
let fakeStore: Record<string, Blob> = {};
let shouldFail = false;
mock.module('@/utils/imageDb', () => ({
  saveImages: async (entries: Record<string, Blob | undefined>) => {
    if (shouldFail) throw new Error('IDB unavailable (mock)');
    fakeStore = {};
    for (const [k, v] of Object.entries(entries)) if (v) fakeStore[k] = v;
  },
  loadImages: async () => {
    if (shouldFail) throw new Error('IDB unavailable (mock)');
    return { ...fakeStore };
  },
  clearImages: async () => {
    if (shouldFail) throw new Error('IDB unavailable (mock)');
    fakeStore = {};
  },
}));

// require (mock.module은 hoisting 안 됨) — usePhototicket이 이 시점 이후 로드돼야 위 mock을 받는다.
const { usePhototicket } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

// usePhototicket의 blobUrlToBlob은 blob: URL을 fetch(url).then(r=>r.blob())으로 되돌린다 —
// 실제 브라우저에선 자기 자신이 만든 objectURL을 읽는 것뿐이라 네트워크를 안 타지만, 테스트의
// 가짜 'blob:xyz' 문자열은 실제 등록된 objectURL이 아니므로 fetch 자체를 스텁한다. afterEach의
// mock.restore()가 매 테스트 뒤 이 스텁도 걷어가므로, beforeEach에서 매번 다시 세운다(다른
// 파일들과 동일하게 spyOn은 afterEach에서 mock.restore, 등록은 필요한 시점마다).
beforeEach(() => {
  spyOn(global, 'fetch').mockImplementation((async (url: string) => {
    return new Response(new Blob([url], { type: 'application/octet-stream' }));
  }) as unknown as typeof fetch);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  fakeStore = {};
  shouldFail = false;
  mock.restore();
});

describe('#489 자동저장 이미지 복원', () => {
  test('저장 후 리마운트(하드 새로고침 시뮬레이션)하면 포스터·원본·로고·서명이 모두 복원된다', async () => {
    const first = renderHook(() => usePhototicket());
    act(() => {
      first.result.current.handleImageUpload('blob:poster-cropped', 'blob:poster-original');
      first.result.current.updateComponents({
        chain: 'blob:chain-logo',
        format: 'blob:format-logo',
        signatureImage: 'blob:signature-img',
      });
    });
    act(() => {
      first.result.current.saveDraft();
    });
    // saveDraft의 이미지 저장은 비동기(fetch→IDB) — fakeStore에 다 실릴 때까지 기다린다.
    await waitFor(() => {
      expect(Object.keys(fakeStore).sort()).toEqual(
        ['chain', 'format', 'poster', 'posterOriginal', 'signature'].sort()
      );
    });
    first.unmount();

    // "하드 새로고침" — localStorage·fakeStore는 그대로, 새 usePhototicket 인스턴스가 mount된다.
    const second = renderHook(() => usePhototicket());
    await waitFor(() => {
      expect(second.result.current.state.croppedImageUrl).toBeTruthy();
      expect(second.result.current.restoredOriginalPosterUrl).toBeTruthy();
      expect(second.result.current.state.components.chain).toBeTruthy();
      expect(second.result.current.state.components.format).toBeTruthy();
      expect(second.result.current.state.components.signatureImage).toBeTruthy();
    });
    // 업로드 화면으로 튕기지 않는다 — croppedImageUrl이 null이 아니면 편집 셸이 렌더된다
    // (MobileEditorShell/DesktopStudioShell의 게이팅 조건).
    expect(second.result.current.state.croppedImageUrl).not.toBeNull();
    // 새로 발급된 objectURL이어야 한다(죽은 참조 재사용이 아니라 진짜 복원).
    expect(second.result.current.state.croppedImageUrl).not.toBe('blob:poster-cropped');
    second.unmount();
  });

  test('복원 후 재업로드(교체/재크롭)해도 복원된 fieldVisibility가 덮이지 않는다(#489 서브버그)', async () => {
    const first = renderHook(() => usePhototicket());
    act(() => {
      first.result.current.handleImageUpload('blob:poster-cropped', 'blob:poster-original');
      // 사용자가 커스터마이즈한 필드 표시 — DEFAULT_VISIBILITY_ON_UPLOAD와 다른 값으로 확인.
      first.result.current.updateFieldVisibility({ actors: true, watchTime: true });
    });
    act(() => {
      first.result.current.saveDraft();
    });
    await waitFor(() => expect(fakeStore.poster).toBeTruthy());
    first.unmount();

    const second = renderHook(() => usePhototicket());
    await waitFor(() => {
      expect(second.result.current.state.croppedImageUrl).toBeTruthy();
    });
    expect(second.result.current.state.fieldVisibility.actors).toBe(true);
    expect(second.result.current.state.fieldVisibility.watchTime).toBe(true);

    // 복원 후 포스터를 다시 올리는 것(교체/재크롭) — isFirstUpload가 croppedImageUrl===null만
    // 보면 여긴 해당 안 되지만, IDB 실패 폴백 경로(다음 테스트)에서는 null이 되므로 hasRestoredDraftRef
    // 게이트가 그 경우에도 이 값을 지켜야 한다. 여기서는 정상 경로에서 회귀가 없는지 확인.
    act(() => {
      second.result.current.handleImageUpload('blob:poster-recropped', 'blob:poster-original');
    });
    expect(second.result.current.state.fieldVisibility.actors).toBe(true);
    expect(second.result.current.state.fieldVisibility.watchTime).toBe(true);
    second.unmount();
  });

  test('IndexedDB 복원 실패 시 throw 없이 조용히 폴백 — 텍스트/설정은 복원되고, 강제 재업로드도 fieldVisibility를 안 덮는다', async () => {
    const first = renderHook(() => usePhototicket());
    act(() => {
      first.result.current.handleImageUpload('blob:poster-cropped', 'blob:poster-original');
      first.result.current.updateFieldVisibility({ actors: true });
      first.result.current.updateMovieInfo({ title: '기생충' });
    });
    act(() => {
      first.result.current.saveDraft();
    });
    await waitFor(() => expect(fakeStore.poster).toBeTruthy());
    first.unmount();

    // IndexedDB가 이번 세션에서 못 쓰는 상황(프라이빗 모드 등)을 흉내낸다.
    shouldFail = true;

    const second = renderHook(() => usePhototicket());
    // 텍스트/설정은 localStorage 경로라 IDB와 무관하게 정상 복원된다.
    await waitFor(() => {
      expect(second.result.current.state.movieInfo.title).toBe('기생충');
      expect(second.result.current.state.fieldVisibility.actors).toBe(true);
    });
    // 이미지 복원은 실패했으므로 현재(lossy) 동작대로 포스터는 null — 업로드 화면으로 유도된다.
    expect(second.result.current.state.croppedImageUrl).toBeNull();
    expect(second.result.current.restoredOriginalPosterUrl).toBeNull();

    // 사용자가 업로드 화면에서 포스터를 다시 올린다 — croppedImageUrl===null이라 겉보기엔
    // "첫 업로드"지만, 복원된 draft에 포스터가 있었으므로(restoredDraftHadPosterRef)
    // fieldVisibility를 DEFAULT_VISIBILITY_ON_UPLOAD로 리셋하면 안 된다.
    act(() => {
      second.result.current.handleImageUpload('blob:poster-reuploaded');
    });
    expect(second.result.current.state.fieldVisibility.actors).toBe(true);
    second.unmount();
  });

  test('clearDraft()는 IndexedDB도 비우고, 그 이후 새 업로드는 다시 기본 가시성 세트를 적용한다', async () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.handleImageUpload('blob:poster-cropped', 'blob:poster-original');
      result.current.updateFieldVisibility({ actors: true });
    });
    act(() => {
      result.current.saveDraft();
    });
    await waitFor(() => expect(fakeStore.poster).toBeTruthy());

    act(() => {
      result.current.clearDraft();
    });
    await waitFor(() => {
      expect(fakeStore).toEqual({});
    });

    // 초기화는 진짜 새 문서 시작이라 restoredDraftHadPosterRef도 리셋돼야 한다 — 안 그러면 이후
    // 업로드가 영원히 "복원된 draft에 포스터가 있었다"로 오판돼 기본 가시성 세트가 다시는
    // 안 켜진다(#310/#178 회귀).
    act(() => {
      result.current.handleImageUpload('blob:new-poster', 'blob:new-original');
    });
    expect(result.current.state.fieldVisibility.actors).toBe(false); // DEFAULT_VISIBILITY_ON_UPLOAD
  });

  // claude-review PR #515 P1 — restoredDraftHadPosterRef 게이트는 "draft가 있었는지"가 아니라
  // "그 draft에 포스터가 있었는지"로 좁혀야 한다. 텍스트만 입력하고 포스터는 한 번도 안 올린
  // draft가 복원된 상태에서 이번 세션 첫 포스터 업로드를 하면, 그건 진짜 첫 업로드이므로
  // DEFAULT_VISIBILITY_ON_UPLOAD가 정상 적용돼야 한다(과하게 넓은 게이트로 이게 깨졌던 회귀).
  test('포스터 없이 텍스트만 있던 draft를 복원한 뒤 첫 포스터 업로드는 기본 가시성 세트를 정상 적용한다', async () => {
    const first = renderHook(() => usePhototicket());
    act(() => {
      first.result.current.updateMovieInfo({ theater: 'CGV 용산' });
      first.result.current.updateFieldVisibility({ actors: true });
    });
    act(() => {
      first.result.current.saveDraft();
    });
    // 포스터를 한 번도 안 올렸으므로 이미지 저장소엔 아무것도 안 실린다.
    expect(fakeStore.poster).toBeUndefined();
    first.unmount();

    const second = renderHook(() => usePhototicket());
    await waitFor(() => {
      expect(second.result.current.state.movieInfo.theater).toBe('CGV 용산');
      expect(second.result.current.state.fieldVisibility.actors).toBe(true);
    });
    expect(second.result.current.state.croppedImageUrl).toBeNull();

    // 이번 세션 첫 포스터 업로드 — "복원된 draft가 있었다"는 사실과 무관하게 진짜 첫 업로드다.
    act(() => {
      second.result.current.handleImageUpload('blob:first-real-poster');
    });
    expect(second.result.current.state.fieldVisibility.actors).toBe(false); // DEFAULT_VISIBILITY_ON_UPLOAD
    second.unmount();
  });
});
