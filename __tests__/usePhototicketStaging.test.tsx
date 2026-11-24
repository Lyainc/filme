/**
 * #826 S9 constraint-9 — 랜딩 첨부 시트의 문서 스냅샷(usePhototicket.beginStaging / cancelStaging / commitStaging)과
 * 그 짝(useEditHistory.exportStack / importStack, useOcrUndo.exportState / importState).
 *
 * 지키는 것: 시트가 열린 동안 저장분(localStorage · IndexedDB)은 한 번도 안 써지고, 이전 문서의 blob은 안 풀리며,
 * 닫으면(cancel) 문서가 그대로 돌아오고 늦은 응답은 버려진다. 확정(commit)은 안 쓰는 옛 blob만 풀고 편집이 있으면
 * 자동저장이 곧 걸린다. staging을 안 쓰는 경로는 그대로다.
 */
import { afterEach, beforeEach, describe, expect, jest, mock, test } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { usePhototicket } from '../src/hooks/usePhototicket';
import { useEditHistory } from '../src/hooks/useEditHistory';
import { useOcrUndo } from '../src/hooks/useOcrUndo';
import type { OcrDirectField } from '../src/components/v2/OcrUploadCard';

const KEY = 'filme:phototicket:v1';

let n = 0;
let revoked: string[] = [];
const origCreate = URL.createObjectURL;
const origRevoke = URL.revokeObjectURL;
const blob = () => URL.createObjectURL(new Blob());

function useAll() {
  const photo = usePhototicket();
  const history = useEditHistory(photo);
  const ocr = useOcrUndo(photo);
  return { photo, history, ocr };
}

const setup = () => renderHook(() => useAll());
type Hook = ReturnType<typeof setup>;
const advance = (ms: number) => act(() => void jest.advanceTimersByTime(ms));
// 마운트 직후 첫 디바운스(350ms)가 히스토리 베이스라인을 잡고, 복원 effect(IndexedDB 미지원)도 정리된다.
const mountSettle = () => advance(400);

function leaveTab() {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
}

/** 포스터 + 로고를 가진 "시트 전 문서"를 만든다. */
function seedDoc(h: Hook) {
  const poster = blob();
  const original = blob();
  const chain = blob();
  act(() => {
    h.result.current.photo.handleImageUpload(poster, original);
    h.result.current.photo.updateComponents({ chain, themeColor: '#123456' });
    h.result.current.photo.updateMovieInfo({ title: '기생충' });
  });
  return { poster, original, chain };
}

// localStorage 쓰기 감시 — happy-dom의 Storage는 spyOn이 안 잡혀(backToLandingPreservesDoc과 같은 사정) 통째로 감싸 교체한다.
const realStorage = window.localStorage;
const setItem = mock((_key: string, _value: string) => {});

beforeEach(() => {
  n = 0;
  revoked = [];
  URL.createObjectURL = mock(() => `blob:mock/${++n}`);
  URL.revokeObjectURL = mock((u: string) => {
    revoked.push(u);
  });
  jest.useFakeTimers();
  window.localStorage.clear();
  setItem.mockClear();
  const counting = {
    getItem: (k: string) => realStorage.getItem(k),
    removeItem: (k: string) => realStorage.removeItem(k),
    clear: () => realStorage.clear(),
    setItem: (k: string, v: string) => {
      setItem(k, v);
      realStorage.setItem(k, v);
    },
  };
  Object.defineProperty(window, 'localStorage', { value: counting, configurable: true });
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  Object.defineProperty(window, 'localStorage', { value: realStorage, configurable: true });
  window.localStorage.clear();
  URL.createObjectURL = origCreate;
  URL.revokeObjectURL = origRevoke;
});

describe('S9 staging — begin → resetDocument → cancel', () => {
  test('상태 · 플래그를 그대로 되돌리고, 스냅샷 blob은 안 풀고 시트 중에 만든 blob은 푼다', () => {
    const h = setup();
    mountSettle();
    const { poster, original, chain } = seedDoc(h);
    const before = h.result.current.photo.state;
    expect(h.result.current.photo.posterCrop.originalSrc).toBe(original);
    const dirtyBefore = before; // 참조 동일성으로 "정확히 같은 문서"를 확인한다.

    act(() => h.result.current.photo.beginStaging());
    expect(h.result.current.photo.isStaging).toBe(true);
    revoked = [];

    // 시트에서 무드를 골라 새 문서를 열고(resetDocument) 포스터 + 로고를 새로 올린다.
    act(() => h.result.current.photo.resetDocument({ layout: 'stub' }));
    const poster2 = blob();
    const original2 = blob();
    const chain2 = blob();
    act(() => {
      h.result.current.photo.handleImageUpload(poster2, original2);
      h.result.current.photo.updateComponents({ chain: chain2 });
    });
    expect(h.result.current.photo.state.components.layout).toBe('stub');
    // 스냅샷 blob은 reset · 업로드 · 크롭 원본 교체 어디서도 안 풀렸다.
    expect(revoked).not.toContain(poster);
    expect(revoked).not.toContain(original);
    expect(revoked).not.toContain(chain);

    act(() => h.result.current.photo.cancelStaging());

    expect(h.result.current.photo.isStaging).toBe(false);
    expect(h.result.current.photo.state).toBe(dirtyBefore);
    expect(h.result.current.photo.state.croppedImageUrl).toBe(poster);
    expect(h.result.current.photo.state.components.chain).toBe(chain);
    expect(h.result.current.photo.posterCrop.originalSrc).toBe(original); // 재크롭이 되는 원본
    expect(h.result.current.photo.draftRestored).toBe(false);
    // 시트 중에 만든 blob만 푼다.
    expect(revoked).toContain(poster2);
    expect(revoked).toContain(original2);
    expect(revoked).toContain(chain2);
    expect(revoked).not.toContain(poster);
    expect(revoked).not.toContain(original);
    expect(revoked).not.toContain(chain);
  });

  test('복원된 문서의 touched 플래그가 돌아온다(밝기를 만진 문서는 cancel 뒤에도 전환이 그 값을 덮지 않는다)', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.updateComponents({ posterOpacity: 0.9 })); // 밝기 touched
    act(() => h.result.current.photo.beginStaging());
    act(() => h.result.current.photo.resetDocument()); // brightnessTouched = false
    act(() => h.result.current.photo.cancelStaging());
    act(() => h.result.current.photo.updateComponents({ material: 'holographic' }));
    expect(h.result.current.photo.state.components.posterOpacity).toBe(0.9);
  });
});

describe('S9 staging — 저장 보류', () => {
  test('시트 중 편집 + 타이머 진행에도 localStorage는 한 번도 안 써진다(cancel 뒤에도)', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.beginStaging());
    act(() => h.result.current.photo.resetDocument({ layout: 'stub' }));
    act(() => h.result.current.photo.updateMovieInfo({ title: '새 문서' }));
    advance(10_000);
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(h.result.current.photo.lastSavedAt).toBeNull();
    // 수동 저장도 보류 중엔 거절된다.
    let ok = true;
    act(() => {
      ok = h.result.current.photo.saveDraft();
    });
    expect(ok).toBe(false);
    expect(setItem).not.toHaveBeenCalled();

    act(() => h.result.current.photo.cancelStaging());
    advance(10_000);
    expect(setItem).not.toHaveBeenCalled();
    expect(h.result.current.photo.lastSavedAt).toBeNull();
  });

  test('시트 전에 이미 저장된 문서는 cancel 뒤 다시 저장하지 않는다', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.updateMovieInfo({ title: '기생충' }));
    advance(1100); // 디바운스 → 저장됨
    expect(setItem).toHaveBeenCalledTimes(1);
    const saved = window.localStorage.getItem(KEY);

    act(() => h.result.current.photo.beginStaging());
    act(() => h.result.current.photo.resetDocument());
    act(() => h.result.current.photo.updateMovieInfo({ title: '다른 문서' }));
    act(() => h.result.current.photo.cancelStaging());
    advance(10_000);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(KEY)).toBe(saved);
    expect(h.result.current.photo.state.movieInfo.title).toBe('기생충');
  });

  test('시트 전에 예약돼 있던 자동저장은 cancel 뒤 복원본으로 걸린다(저장분에는 시트 문서가 안 섞인다)', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.updateMovieInfo({ title: '기생충' })); // 타이머 대기 중
    advance(300);
    act(() => h.result.current.photo.beginStaging());
    act(() => h.result.current.photo.resetDocument({ layout: 'stub' }));
    act(() => h.result.current.photo.updateMovieInfo({ title: '시트 문서' }));
    advance(5000);
    expect(setItem).not.toHaveBeenCalled();

    act(() => h.result.current.photo.cancelStaging());
    advance(1100);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(KEY) || '{}').movieInfo.title).toBe('기생충');
  });

  test('탭 이탈 flush(#651)도 staging 중에는 쓰지 않는다', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.updateMovieInfo({ title: '기생충' })); // 예약된 타이머가 있는 채로
    act(() => h.result.current.photo.beginStaging());
    act(() => h.result.current.photo.updateMovieInfo({ title: '시트 문서' }));
    leaveTab();
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});

describe('S9 staging — 늦은 응답 무효화', () => {
  test('staging 중 잡은 captureDraft · captureMovieSelection 적용기는 cancel 뒤 stale이다', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.beginStaging());
    let stillValid!: () => boolean;
    let applyKobis!: (patch: { director?: string; title?: string }) => boolean;
    act(() => {
      stillValid = h.result.current.photo.captureDraft();
      applyKobis = h.result.current.photo.captureMovieSelection() as typeof applyKobis;
    });
    expect(stillValid()).toBe(true);

    act(() => h.result.current.photo.cancelStaging());

    expect(stillValid()).toBe(false);
    let applied = true;
    act(() => {
      applied = applyKobis({ title: '늦게 온 보강' });
    });
    expect(applied).toBe(false);
    expect(h.result.current.photo.state.movieInfo.title).toBe('');
  });

  test('commit은 captureDraft를 무효화하지 않는다(시트에서 시작한 OCR이 새 문서에 들어간다)', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.beginStaging());
    let stillValid!: () => boolean;
    act(() => {
      stillValid = h.result.current.photo.captureDraft();
    });
    act(() => h.result.current.photo.commitStaging());
    expect(stillValid()).toBe(true);
  });
});

describe('S9 staging — commit', () => {
  test('새 문서가 안 쓰는 옛 blob만 풀고, 편집이 있으면 자동저장이 걸린다', () => {
    const h = setup();
    mountSettle();
    const { poster, original, chain } = seedDoc(h);
    advance(1100);
    setItem.mockClear();

    act(() => h.result.current.photo.beginStaging());
    act(() => h.result.current.photo.resetDocument({ layout: 'stub' }));
    const poster2 = blob();
    const original2 = blob();
    act(() => h.result.current.photo.handleImageUpload(poster2, original2)); // 편집(dirtyTick↑)
    revoked = [];

    act(() => h.result.current.photo.commitStaging());

    expect(h.result.current.photo.isStaging).toBe(false);
    expect(revoked).toEqual(expect.arrayContaining([poster, original, chain]));
    expect(revoked).not.toContain(poster2);
    expect(revoked).not.toContain(original2);
    advance(1100);
    expect(setItem).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    expect(saved.components.layout).toBe('stub');
    expect(saved.movieInfo.title).toBe('');
  });

  test('keepPoster로 이어 쓴 포스터는 commit이 풀지 않는다', () => {
    const h = setup();
    mountSettle();
    const { poster: oldPoster, chain } = seedDoc(h);
    act(() => h.result.current.photo.beginStaging());
    const picked = blob();
    const pickedOriginal = blob();
    act(() => h.result.current.photo.handleImageUpload(picked, pickedOriginal)); // 크롭 확정
    act(() => h.result.current.photo.resetDocument({ keepPoster: true, layout: undefined }));
    revoked = [];
    act(() => h.result.current.photo.commitStaging());
    expect(h.result.current.photo.state.croppedImageUrl).toBe(picked);
    expect(revoked).not.toContain(picked);
    expect(revoked).toContain(oldPoster);
    expect(revoked).toContain(chain);
  });

  test('편집 없이 commit하면 저장분을 새 빈 문서로 덮지 않는다', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.updateMovieInfo({ title: '기생충' }));
    advance(1100);
    setItem.mockClear();
    act(() => h.result.current.photo.beginStaging());
    act(() => h.result.current.photo.resetDocument({ layout: 'stub' }));
    act(() => h.result.current.photo.commitStaging());
    advance(10_000);
    expect(setItem).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(KEY) || '{}').movieInfo.title).toBe('기생충');
  });
});

describe('S9 staging — 멱등 · 무영향', () => {
  test('begin을 두 번 불러도 첫 스냅샷이 유지된다', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.updateMovieInfo({ title: '원본' }));
    act(() => h.result.current.photo.beginStaging());
    act(() => h.result.current.photo.updateMovieInfo({ title: '시트 중' }));
    act(() => h.result.current.photo.beginStaging()); // no-op이어야 한다
    act(() => h.result.current.photo.cancelStaging());
    expect(h.result.current.photo.state.movieInfo.title).toBe('원본');
    // 이미 닫힌 뒤의 cancel/commit도 무해하다.
    act(() => h.result.current.photo.cancelStaging());
    act(() => h.result.current.photo.commitStaging());
    expect(h.result.current.photo.state.movieInfo.title).toBe('원본');
  });

  test('staging을 안 쓰면 reset은 옛 blob을 즉시 풀고 자동저장도 그대로 걸린다', () => {
    const h = setup();
    mountSettle();
    const { poster, original, chain } = seedDoc(h);
    revoked = [];
    act(() => h.result.current.photo.resetDocument({ layout: 'stub' }));
    expect(revoked).toEqual(expect.arrayContaining([poster, original, chain]));
    expect(h.result.current.photo.isStaging).toBe(false);
    act(() => h.result.current.photo.updateMovieInfo({ title: '새 문서' }));
    advance(1100);
    expect(setItem).toHaveBeenCalledTimes(1);
  });
});

describe('S9 staging — 히스토리가 쥔 보류 blob', () => {
  test('히스토리 때문에 풀기를 미룬 URL은 staging 중 clear()로 스택이 바뀌어도, cancel+importStack 뒤에도 안 풀린다', () => {
    const h = setup();
    mountSettle();
    const logo = blob();
    act(() => h.result.current.photo.updateComponents({ chain: logo }));
    advance(400); // 스택이 logo를 쥔다
    act(() => h.result.current.photo.updateComponents({ chain: '' })); // 제거 → 스택이 아직 참조해 보류
    advance(400);
    expect(revoked).not.toContain(logo);

    let stack!: ReturnType<typeof h.result.current.history.exportStack>;
    act(() => {
      stack = h.result.current.history.exportStack();
      h.result.current.photo.beginStaging();
      h.result.current.photo.resetDocument({ layout: 'stub' });
      h.result.current.history.clear();
    });
    advance(400); // 새 베이스라인 → 스택이 logo를 더는 안 쥔다
    expect(revoked).not.toContain(logo);

    act(() => {
      h.result.current.photo.cancelStaging();
      h.result.current.history.importStack(stack);
    });
    advance(400);
    expect(revoked).not.toContain(logo);
    expect(h.result.current.history.canUndo).toBe(true);
    // undo는 아직 살아 있는 logo를 복원한다.
    act(() => h.result.current.history.undo());
    expect(h.result.current.photo.state.components.chain).toBe(logo);
  });

  test('commit은 새 스택이 안 쥔 보류 URL을 푼다', () => {
    const h = setup();
    mountSettle();
    const logo = blob();
    act(() => h.result.current.photo.updateComponents({ chain: logo }));
    advance(400);
    act(() => h.result.current.photo.updateComponents({ chain: '' }));
    advance(400);
    act(() => {
      h.result.current.photo.beginStaging();
      h.result.current.photo.resetDocument({ layout: 'stub' });
      h.result.current.history.clear();
    });
    advance(400);
    expect(revoked).not.toContain(logo);
    act(() => h.result.current.photo.commitStaging());
    expect(revoked).toContain(logo);
  });
});

describe('S9 — useEditHistory.exportStack / importStack', () => {
  test('clear() 뒤 새 베이스라인이 서도 importStack이 원래 스택 · 위치를 되돌리고 예약된 clear를 취소한다', () => {
    const h = setup();
    mountSettle();
    act(() => h.result.current.photo.updateMovieInfo({ theater: 'A' }));
    advance(400);
    act(() => h.result.current.photo.updateMovieInfo({ theater: 'AB' }));
    advance(400);
    const stack = h.result.current.history.exportStack();
    expect(stack.stack.length).toBeGreaterThanOrEqual(3);

    act(() => h.result.current.history.clear());
    act(() => h.result.current.history.importStack(stack)); // 예약 취소 — 다음 디바운스가 베이스라인으로 안 굳는다
    advance(400);
    expect(h.result.current.history.exportStack()).toBe(stack);
    expect(h.result.current.history.canUndo).toBe(true);
    act(() => h.result.current.history.undo());
    expect(h.result.current.photo.state.movieInfo.theater).toBe('A');
  });
});

describe('S9 — useOcrUndo.exportState / importState', () => {
  test('confirm() 뒤에도 뜬 상태를 되돌려 배너 · 되돌리기가 살아나고 epoch가 오른다', () => {
    const h = setup();
    mountSettle();
    act(() => {
      h.result.current.photo.updateMovieInfo({ theater: 'OCR 극장' });
      h.result.current.ocr.apply({
        keys: new Set<OcrDirectField>(['theater']),
        prevValues: { theater: '' },
        nextValues: { theater: 'OCR 극장' },
      });
    });
    expect(h.result.current.ocr.snapshot).toEqual({ theater: '' });
    const saved = h.result.current.ocr.exportState();

    act(() => h.result.current.ocr.confirm());
    expect(h.result.current.ocr.snapshot).toBeNull();
    const epoch = h.result.current.ocr.epochRef.current;

    act(() => h.result.current.ocr.importState(saved));
    expect(h.result.current.ocr.snapshot).toEqual({ theater: '' });
    expect(h.result.current.ocr.filledFields.has('theater')).toBe(true);
    expect(h.result.current.ocr.epochRef.current).toBe(epoch + 1);
  });
});

describe('S9 — usePosterCrop.exportState / importState', () => {
  test('importState가 확정 원본을 되돌리고 확정 전 새 파일 · 모달을 걷는다', () => {
    const h = setup();
    mountSettle();
    const original = blob();
    act(() => h.result.current.photo.posterCrop.seedOriginal(original));
    const snap = h.result.current.photo.posterCrop.exportState();
    expect(snap.originalSrc).toBe(original);

    act(() => h.result.current.photo.posterCrop.openFile(new File(['x'], 'p.png')));
    expect(h.result.current.photo.posterCrop.cropOpen).toBe(true);
    act(() => h.result.current.photo.posterCrop.importState(snap));
    expect(h.result.current.photo.posterCrop.cropOpen).toBe(false);
    expect(h.result.current.photo.posterCrop.src).toBe(original);
    expect(revoked).not.toContain(original);
  });
});
