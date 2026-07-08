/**
 * useOcrUndo — OCR 낙관적 주입 + 되돌리기 로직의 단일 출처(MobileEditorShell·DesktopStudioShell 공유,
 * #141-class drift 방지). 추출 전엔 두 컴포넌트가 이 로직을 각자 복제해 회귀 커버리지가 한쪽
 * (모바일 편집 셸)에만 있었다(#224 리뷰 P1). 여기서 공용 훅 자체를 직접 검증한다.
 */
import { describe, expect, test, mock } from 'bun:test';
import { act, renderHook } from '@testing-library/react';
import { useOcrUndo } from '../src/hooks/useOcrUndo';
import type { OcrDirectField } from '../src/components/v2/OcrUploadCard';
import type { usePhototicket } from '../src/hooks/usePhototicket';

function makePhoto() {
  const updateMovieInfo = mock((_: unknown) => {});
  const updateComponents = mock((_: unknown) => {});
  const photo = { updateMovieInfo, updateComponents } as unknown as ReturnType<typeof usePhototicket>;
  return { photo, updateMovieInfo, updateComponents };
}

describe('useOcrUndo', () => {
  test('apply가 스냅샷·채워진 필드를 세팅해 배너를 띄운다', () => {
    const { photo } = makePhoto();
    const { result } = renderHook(() => useOcrUndo(photo));
    expect(result.current.snapshot).toBeNull();

    act(() => {
      result.current.apply({
        keys: new Set<OcrDirectField>(['theater', 'seat']),
        prevValues: { theater: '' },
      });
    });

    expect(result.current.snapshot).toEqual({ theater: '' });
    expect(result.current.filledFields.has('theater')).toBe(true);
    expect(result.current.filledFields.size).toBe(2);
  });

  test('cancel이 movieInfo+components를 원자 복원하고 epoch를 올린다(#141)', () => {
    const { photo, updateMovieInfo, updateComponents } = makePhoto();
    const { result } = renderHook(() => useOcrUndo(photo));
    const epoch0 = result.current.epochRef.current;

    act(() => {
      result.current.apply({
        keys: new Set<OcrDirectField>(['theater']),
        prevValues: { theater: 'PREV' },
        prevComponents: { chainVisible: false, chainLabel: '' },
      });
    });
    act(() => {
      result.current.cancel();
    });

    expect(updateMovieInfo).toHaveBeenCalledWith({ theater: 'PREV' });
    expect(updateComponents).toHaveBeenCalledWith({ chainVisible: false, chainLabel: '' });
    expect(result.current.epochRef.current).toBe(epoch0 + 1);
    expect(result.current.snapshot).toBeNull();
    expect(result.current.filledFields.size).toBe(0);
  });

  test('confirm은 복원 없이 스냅샷만 비워 배너를 닫는다(주입 유지)', () => {
    const { photo, updateMovieInfo } = makePhoto();
    const { result } = renderHook(() => useOcrUndo(photo));

    act(() => {
      result.current.apply({ keys: new Set<OcrDirectField>(['seat']), prevValues: { seat: '' } });
    });
    act(() => {
      result.current.confirm();
    });

    expect(result.current.snapshot).toBeNull();
    expect(updateMovieInfo).not.toHaveBeenCalled();
  });

  test('removeField가 해당 필드만 OCR 집합에서 제거한다(사용자 편집 시 칩 숨김)', () => {
    const { photo } = makePhoto();
    const { result } = renderHook(() => useOcrUndo(photo));

    act(() => {
      result.current.apply({ keys: new Set<OcrDirectField>(['theater', 'seat']), prevValues: {} });
    });
    act(() => {
      result.current.removeField('theater');
    });

    expect(result.current.filledFields.has('theater')).toBe(false);
    expect(result.current.filledFields.has('seat')).toBe(true);
  });
});
