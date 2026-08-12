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
import { afterAll, afterEach, beforeEach, describe, expect, test, mock, spyOn } from 'bun:test';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

const KEY = 'filme:phototicket:v1';

// imageDb는 인메모리 Map으로 대체 — usePhototicket이 saveImages/loadImages/clearImages를
// 올바른 시점에 호출하는지만 본다. shouldFail 토글로 IndexedDB 미지원/프라이빗 모드/용량초과를
// 흉내낸다(#489 결정 5: 그럴 때도 throw 없이 조용히 폴백해야 한다).
// saveGate/releaseSave: claude-review PR #515 P1 ② 직렬화 테스트 전용 — armSaveGate() 후 첫
// saveImages 호출을 붙잡아뒀다가 releaseSave()로 풀어준다. 평소엔 이미 resolved라 no-op.
// saveImagesCallCount: P1 ③ fingerprint 스킵 테스트 전용 — 실제로 saveImages까지 도달한 횟수.
let fakeStore: Record<string, Blob> = {};
let shouldFail = false;
let saveGate: Promise<void> = Promise.resolve();
let releaseSave: (() => void) | null = null;
function armSaveGate() {
  saveGate = new Promise((resolve) => {
    releaseSave = resolve;
  });
}
let saveImagesCallCount = 0;
// loadGate/releaseLoad — #683 fresh-context 리뷰 레이스 재현 전용. armSaveGate와 동일 패턴이지만
// loadImages(IndexedDB 이미지 복원, usePhototicket.ts의 별도 effect)를 붙잡아, 그 대기 창 동안
// 사용자가 먼저 업로드한 값이 뒤늦게 도착한 복원본에 덮이지 않는지를 결정적으로 재현한다.
let loadGate: Promise<void> = Promise.resolve();
let releaseLoad: (() => void) | null = null;
function armLoadGate() {
  loadGate = new Promise((resolve) => {
    releaseLoad = resolve;
  });
}
// 스프레드 스냅샷 + afterAll 복원(#611·#618) — `require()`가 주는 건 살아있는 네임스페이스라
// mock.module이 그 객체를 제자리에서 갈아끼운다. 복사본으로 떠 둬야 복원이 진짜 복원이 된다.
// 안 되돌리면 이 인메모리 fakeStore가 프로세스 끝까지 남아, 뒤 파일이 실제 IndexedDB 경로 대신
// 이 파일의 잔여 상태(shouldFail·saveGate 포함)를 받는다.
const realImageDb = { ...require('@/utils/imageDb') };
mock.module('@/utils/imageDb', () => ({
  saveImages: async (entries: Record<string, Blob | undefined>) => {
    saveImagesCallCount += 1;
    await saveGate;
    if (shouldFail) throw new Error('IDB unavailable (mock)');
    fakeStore = {};
    for (const [k, v] of Object.entries(entries)) if (v) fakeStore[k] = v;
  },
  loadImages: async () => {
    await loadGate;
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
const { useEditHistory } =
  require('@/hooks/useEditHistory') as typeof import('@/hooks/useEditHistory');

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
  saveGate = Promise.resolve();
  releaseSave = null;
  saveImagesCallCount = 0;
  loadGate = Promise.resolve();
  releaseLoad = null;
  mock.restore();
});

afterAll(() => {
  mock.module('@/utils/imageDb', () => realImageDb);
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
        backgroundPatternImage: 'blob:bg-image',
      });
    });
    act(() => {
      first.result.current.saveDraft();
    });
    // saveDraft의 이미지 저장은 비동기(fetch→IDB) — fakeStore에 다 실릴 때까지 기다린다.
    await waitFor(() => {
      expect(Object.keys(fakeStore).sort()).toEqual(
        ['background', 'chain', 'format', 'poster', 'posterOriginal', 'signature'].sort()
      );
    });
    first.unmount();

    // "하드 새로고침" — localStorage·fakeStore는 그대로, 새 usePhototicket 인스턴스가 mount된다.
    const second = renderHook(() => usePhototicket());
    await waitFor(() => {
      expect(second.result.current.state.croppedImageUrl).toBeTruthy();
      // 크롭 원본은 #548에서 usePosterCrop(훅 내부)이 단일 소유자다 — 예전 restoredOriginalPosterUrl.
      expect(second.result.current.posterCrop.originalSrc).toBeTruthy();
      expect(second.result.current.state.components.chain).toBeTruthy();
      expect(second.result.current.state.components.format).toBeTruthy();
      expect(second.result.current.state.components.signatureImage).toBeTruthy();
      // 티켓 배경 이미지(#672) — 프리셋 축이 사라진 뒤로 이게 배경의 전부라, 새로고침에 유실되면
      // 로고 3종과 비대칭인 채로 흔적조차 안 남는다.
      expect(second.result.current.state.components.backgroundPatternImage).toBeTruthy();
      expect(second.result.current.state.components.backgroundPatternImage).not.toBe('blob:bg-image');
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
    // 보면 여긴 해당 안 되지만, IDB 실패 폴백 경로(다음 테스트)에서는 null이 되므로
    // restoredDraftHadPosterRef 게이트가 그 경우에도 이 값을 지켜야 한다. 여기서는 정상 경로에서
    // 회귀가 없는지 확인.
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
    expect(second.result.current.posterCrop.originalSrc).toBeNull();

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

  // claude-review PR #515 P1 재검토 지적 — imagePersistChainRef 직렬화(②)에 대한 회귀 테스트 공백.
  // 늦게 끝나는 이전 저장이 나중 저장을 덮어쓰지 않는지, 호출 순서대로 직렬화되는지 확인한다.
  test('claude-review PR #515 P1 ② — 겹치는 saveDraft() 호출도 호출 순서대로 직렬화돼 나중 호출이 이긴다', async () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.handleImageUpload('blob:poster-A');
    });
    // 첫 saveDraft의 IndexedDB 쓰기를 붙잡아둔다 — 그동안 상태를 B로 바꾸고 두 번째
    // saveDraft를 호출해, "늦게 끝나는 A가 나중 호출 B를 덮어쓰지 않는지"를 재현한다.
    armSaveGate();
    act(() => {
      result.current.saveDraft(); // A — saveGate에서 대기 중.
    });
    act(() => {
      result.current.handleImageUpload('blob:poster-B');
    });
    act(() => {
      result.current.saveDraft(); // B — A 뒤에 체이닝돼야 한다.
    });
    releaseSave?.(); // A가 먼저 끝나고, 체인을 따라 B가 이어서 실행된다.

    await waitFor(() => expect(fakeStore.poster).toBeTruthy());
    // fetch mock이 blob 내용을 요청 URL 그대로 채우므로, 마지막에 저장된 포스터가 어느 호출의
    // 것인지 내용으로 구분할 수 있다 — A가 늦게 끝나도 최종 결과는 나중 호출 B여야 한다.
    expect(await fakeStore.poster.text()).toBe('blob:poster-B');
  });

  // claude-review PR #515 P1 재검토 지적 — fingerprint 스킵(③)에 대한 회귀 테스트 공백.
  // 이미지 URL이 그대로면 텍스트만 바뀐 저장에서 saveImages(fetch+IndexedDB 재기록) 자체가
  // 호출되지 않는지 확인한다.
  test('claude-review PR #515 P1 ③ — 이미지 URL이 안 바뀌면 텍스트만 바뀐 저장은 IndexedDB 재기록을 스킵한다', async () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.handleImageUpload('blob:poster-same');
    });
    act(() => {
      result.current.saveDraft();
    });
    await waitFor(() => expect(fakeStore.poster).toBeTruthy());
    const callsAfterFirstSave = saveImagesCallCount;

    // 이미지는 하나도 안 건드리고 텍스트만 바꿔서 다시 저장 — 이미지 지문이 직전과 동일하므로
    // saveImages 자체가 다시 호출되면 안 된다.
    act(() => {
      result.current.updateMovieInfo({ title: '다른 제목' });
    });
    act(() => {
      result.current.saveDraft();
    });
    // 비동기 체인이 있다면 잡아낼 만큼(짧게) 기다린다.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(saveImagesCallCount).toBe(callsAfterFirstSave);
  });

  // #683 fresh-context 리뷰 — IndexedDB 이미지 복원은 비동기라(loadGate로 인위적으로 늦춘다),
  // 그 도착 전에 사용자가 같은 축(포스터·로고)을 이미 새로 채웠으면 뒤늦게 온 복원본이 그 값을
  // 덮으면 안 된다. awaitingPosterRestore(#683)가 이 대기 창을 조작 가능한 편집 캔버스로 열어
  // 두므로("포스터 추가"·필드 드로어), 예전엔 거의 안 열리던 이 레이스가 실제로 트리거 가능해졌다.
  test('#683 fresh-context 리뷰 — IDB 복원 대기 중 사용자가 올린 포스터·로고를 뒤늦은 복원본이 덮지 않는다', async () => {
    const first = renderHook(() => usePhototicket());
    act(() => {
      first.result.current.handleImageUpload('blob:old-poster', 'blob:old-original');
      first.result.current.updateComponents({ chain: 'blob:old-chain' });
    });
    act(() => {
      first.result.current.saveDraft();
    });
    await waitFor(() => expect(fakeStore.poster).toBeTruthy());
    first.unmount();

    armLoadGate();
    const second = renderHook(() => usePhototicket());

    // IDB 복원이 아직 게이트에 묶여 대기 중인 동안 사용자가 새 포스터·로고를 올린다.
    act(() => {
      second.result.current.handleImageUpload('blob:user-new-poster');
      second.result.current.updateComponents({ chain: 'blob:user-new-chain' });
    });

    // 복원본(old-poster/old-chain)이 이제 도착한다 — 게이트를 풀고 그 처리가 끝나길 기다린다.
    await act(async () => {
      releaseLoad?.();
      await loadGate;
    });
    await waitFor(() => {
      expect(second.result.current.state.croppedImageUrl).toBe('blob:user-new-poster');
    });
    expect(second.result.current.state.components.chain).toBe('blob:user-new-chain');
    second.unmount();
  });
});

/**
 * #673 — 업로드 이미지를 제거해도 objectURL이 영영 안 풀리던 문제.
 *
 * 제거 순간에 revoke하면 undo(#356)가 죽은 이미지를 복원하므로, 조건은 "제거 시 푼다"가 아니라
 * "히스토리 어디에서도 더는 참조되지 않는 URL만 푼다"다. 아래 두 테스트가 그 양쪽 끝을 잡는다.
 */
describe('#673 제거된 이미지의 blob 수명', () => {
  // 히스토리 push는 350ms 디바운스 — 스냅샷이 실제로 쌓일 때까지 기다린다.
  const settleHistory = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
  };

  function useHarness() {
    const photo = usePhototicket();
    const history = useEditHistory(photo);
    return { photo, history };
  }

  test('제거해도 히스토리가 쥐고 있는 동안은 안 풀리고(undo로 되살아난다), 그 스냅샷이 사라지면 revoke된다', async () => {
    const revoke = spyOn(URL, 'revokeObjectURL');
    const { result } = renderHook(() => useHarness());

    // 베이스라인(로고 없음) → 로고 업로드 → 로고 제거. 스냅샷 3개가 쌓인다.
    act(() => {
      result.current.photo.updateMovieInfo({ title: '기생충' });
    });
    await settleHistory();
    act(() => {
      result.current.photo.updateComponents({ chain: 'blob:chain-1' });
    });
    await settleHistory();
    act(() => {
      result.current.photo.updateComponents({ chain: '' });
    });
    await settleHistory();

    // 제거했지만 가운데 스냅샷이 아직 이 URL을 쥐고 있으므로 풀면 안 된다.
    expect(revoke).not.toHaveBeenCalledWith('blob:chain-1');

    // undo하면 그 이미지가 그대로 살아 있어야 한다(#673 [hard] 제약).
    act(() => {
      result.current.history.undo();
    });
    expect(result.current.photo.state.components.chain).toBe('blob:chain-1');
    expect(revoke).not.toHaveBeenCalledWith('blob:chain-1');

    // 로고가 없던 시점까지 undo한 뒤 새 편집을 하면 redo 가지가 잘려, 이 URL을 쥔 스냅샷이
    // 히스토리에서 통째로 사라진다 — 이제는 어떤 undo/redo로도 못 되살아나므로 풀어야 한다.
    act(() => {
      result.current.history.undo();
    });
    expect(result.current.photo.state.components.chain).toBe('');
    act(() => {
      result.current.photo.updateMovieInfo({ title: '살인의 추억' });
    });
    await settleHistory();
    expect(revoke).toHaveBeenCalledWith('blob:chain-1');
  });

  // clearDraft는 소유 집합을 통째로 revoke하므로, 그 직후 히스토리가 아직 살아 있으면 undo가
  // 죽은 URL을 복원한다 — useEditHistory.clear()가 예약이 아니라 즉시 스택을 비워야 하는 이유다.
  test('clearDraft 직후 history.clear()는 즉시 undo를 막는다 — revoke된 URL이 복원될 창이 없다', async () => {
    const { result } = renderHook(() => useHarness());
    act(() => {
      result.current.photo.updateComponents({ chain: 'blob:chain-1' });
    });
    await settleHistory();
    act(() => {
      result.current.photo.updateMovieInfo({ title: '기생충' });
    });
    await settleHistory();
    expect(result.current.history.canUndo).toBe(true);

    act(() => {
      result.current.photo.clearDraft();
      result.current.history.clear();
    });
    // 다음 디바운스를 기다리지 않고 그 자리에서 막혀야 한다.
    expect(result.current.history.canUndo).toBe(false);
    expect(result.current.history.canRedo).toBe(false);
  });

  test('제거 직후 IndexedDB 쓰기가 in-flight인 채로 탭이 닫혀도, 리마운트에서 지운 이미지가 안 되살아난다', async () => {
    const first = renderHook(() => usePhototicket());
    act(() => {
      first.result.current.handleImageUpload('blob:poster-1');
      first.result.current.updateComponents({ chain: 'blob:chain-1' });
    });
    act(() => {
      first.result.current.saveDraft();
    });
    await waitFor(() => expect(fakeStore.chain).toBeTruthy());

    // 로고 제거 → 그 직후 저장. IndexedDB 쓰기를 붙잡아 "큐에 남은 채 탭이 닫히는" 순간을
    // 재현한다(쿼터 throw도 IDB에 옛 Blob이 남는다는 점에서 같은 상황이다).
    act(() => {
      first.result.current.updateComponents({ chain: '' });
    });
    armSaveGate();
    act(() => {
      first.result.current.saveDraft();
    });
    first.unmount(); // releaseSave는 영영 안 온다 — 탭이 닫혔다.
    expect(fakeStore.chain).toBeTruthy(); // IndexedDB엔 지운 로고가 그대로 남아 있다.

    // 새로고침 — 포스터는 복원되지만(복원 effect가 실제로 돌았다는 증거) 지운 로고는 아니다.
    const second = renderHook(() => usePhototicket());
    await waitFor(() => expect(second.result.current.state.croppedImageUrl).toBeTruthy());
    expect(second.result.current.state.components.chain).toBe('');
    second.unmount();
  });
});
