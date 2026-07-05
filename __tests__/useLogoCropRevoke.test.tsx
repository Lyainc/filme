/**
 * #220 — useLogoCrop blob objectURL 생명주기(revoke) 회귀.
 *
 * 단일 소유자 cleanup 검증: 새 파일 재선택/취소/언마운트 시 직전 rawSrc를 정확히
 * 한 번만 revoke(이중 revoke·원본 조기 revoke 회귀 방지 — 리뷰 P1.2).
 *
 * URL.createObjectURL/revokeObjectURL를 글로벌 스파이로 갈아끼워 호출 인자를 본다
 * (공유 모듈 mock.module 미사용 — 전역 누수 함정 회피, MEMORY).
 * getCroppedImg(canvas) 성공 경로의 value(직전 로고) revoke는 happy-dom canvas
 * 한계(toBlob 불안정)로 여기서 검증하지 않는다.
 */
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { render, cleanup, act } from '@testing-library/react';
import { useLogoCrop } from '@/hooks/useLogoCrop';

let created: string[] = [];
let revoked: string[] = [];
const origCreate = URL.createObjectURL;
const origRevoke = URL.revokeObjectURL;

beforeEach(() => {
  created = [];
  revoked = [];
  let n = 0;
  URL.createObjectURL = mock(() => {
    const u = `blob:mock/${++n}`;
    created.push(u);
    return u;
  });
  URL.revokeObjectURL = mock((u: string) => {
    revoked.push(u);
  });
});

afterEach(() => {
  cleanup();
  URL.createObjectURL = origCreate;
  URL.revokeObjectURL = origRevoke;
});

type Api = ReturnType<typeof useLogoCrop>;

function Harness({ value, apiRef }: { value: string; apiRef: { current: Api | null } }) {
  const api = useLogoCrop(value, () => {});
  apiRef.current = api;
  return <div data-testid="rawsrc" data-value={api.rawSrc ?? ''} />;
}

const png = () => new File(['x'], 'logo.png', { type: 'image/png' });

describe('useLogoCrop revoke 생명주기 (#220)', () => {
  test('openFile → createObjectURL 호출 + rawSrc 설정', () => {
    const apiRef: { current: Api | null } = { current: null };
    render(<Harness value="" apiRef={apiRef} />);
    act(() => apiRef.current!.openFile(png()));
    expect(created).toEqual(['blob:mock/1']);
    expect(apiRef.current!.rawSrc).toBe('blob:mock/1');
    expect(revoked).toEqual([]);
  });

  test('새 파일 재선택 → 직전 rawSrc만 단일 revoke', () => {
    const apiRef: { current: Api | null } = { current: null };
    render(<Harness value="" apiRef={apiRef} />);
    act(() => apiRef.current!.openFile(png()));
    act(() => apiRef.current!.openFile(png()));
    expect(created).toEqual(['blob:mock/1', 'blob:mock/2']);
    expect(revoked).toEqual(['blob:mock/1']); // 직전 것만, 한 번
    expect(apiRef.current!.rawSrc).toBe('blob:mock/2');
  });

  test('handleCancel → rawSrc revoke 후 null', () => {
    const apiRef: { current: Api | null } = { current: null };
    render(<Harness value="" apiRef={apiRef} />);
    act(() => apiRef.current!.openFile(png()));
    act(() => apiRef.current!.handleCancel());
    expect(revoked).toEqual(['blob:mock/1']);
    expect(apiRef.current!.rawSrc).toBeNull();
  });

  test('언마운트 → 남은 rawSrc revoke', () => {
    const apiRef: { current: Api | null } = { current: null };
    const { unmount } = render(<Harness value="" apiRef={apiRef} />);
    act(() => apiRef.current!.openFile(png()));
    act(() => unmount());
    expect(revoked).toEqual(['blob:mock/1']);
  });

  test('외부(non-blob) value는 revoke하지 않음 — openFile은 value를 건드리지 않는다', () => {
    const apiRef: { current: Api | null } = { current: null };
    render(<Harness value="https://cdn.example/logo.png" apiRef={apiRef} />);
    act(() => apiRef.current!.openFile(png()));
    // 원본 rawSrc 생성만, 외부 value URL revoke 없음
    expect(revoked).toEqual([]);
  });
});
