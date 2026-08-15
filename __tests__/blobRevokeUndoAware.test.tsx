/**
 * #673 — 업로드 이미지 제거의 undo-aware blob objectURL revoke 회귀.
 *
 * updateComponents가 chain/format/signatureImage를 빈 값으로 되돌릴 때, 히스토리(#356) 스택이
 * 아직 그 URL을 참조하면 revoke를 보류(undo가 죽은 blob을 만나면 안 되므로)하고, 히스토리에
 * 한 번도 안 실린 채로 바로 제거되면 즉시 revoke한다(getReferencedBlobUrls, usePhototicket.ts).
 */
import { describe, expect, test, afterEach, beforeEach, jest, mock } from 'bun:test';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePhototicket, getReferencedBlobUrls, type HistorySnapshot } from '@/hooks/usePhototicket';
import { useEditHistory } from '@/hooks/useEditHistory';
import type { PhototicketState } from '@/types';

describe('getReferencedBlobUrls (순수 코어)', () => {
  const snap = (over: Partial<HistorySnapshot['components']>): string =>
    JSON.stringify({
      movieInfo: {},
      fieldVisibility: {},
      components: { chain: '', format: '', signatureImage: '', backgroundPatternImage: '', ...over },
    });

  test('빈 스택 → 빈 집합', () => {
    expect(getReferencedBlobUrls([])).toEqual(new Set());
  });

  test('여러 스냅샷의 blob URL을 합집합으로 모은다', () => {
    const urls = getReferencedBlobUrls([
      snap({ chain: 'blob:1' }),
      snap({ chain: 'blob:1', format: 'blob:2' }),
      snap({ signatureImage: 'blob:3' }),
      snap({ backgroundPatternImage: 'blob:4' }),
    ]);
    expect(urls).toEqual(new Set(['blob:1', 'blob:2', 'blob:3', 'blob:4']));
  });

  test('blob:이 아닌 값(빈 문자열·서버 URL)은 무시한다', () => {
    expect(getReferencedBlobUrls([snap({ chain: '', format: 'https://example.com/x.png' })])).toEqual(new Set());
  });

  test('손상된 JSON은 건너뛴다', () => {
    expect(getReferencedBlobUrls(['not-json', snap({ chain: 'blob:1' })])).toEqual(new Set(['blob:1']));
  });
});

// ── 훅 통합 (usePhototicket + useEditHistory, __tests__/editHistory.test.tsx와 동일 하네스) ──
let created: string[] = [];
let revoked: string[] = [];
const origCreate = URL.createObjectURL;
const origRevoke = URL.revokeObjectURL;

let captured: PhototicketState;

function Harness() {
  const photo = usePhototicket();
  captured = photo.state;
  const hist = useEditHistory(photo);
  return (
    <>
      <button type="button" onClick={() => photo.updateComponents({ chain: URL.createObjectURL(new Blob()) })}>
        upload-chain
      </button>
      <button type="button" onClick={() => photo.updateComponents({ chain: '' })}>
        remove-chain
      </button>
      <button type="button" onClick={() => photo.updateComponents({ format: URL.createObjectURL(new Blob()) })}>
        upload-format
      </button>
      <button type="button" onClick={() => photo.updateComponents({ format: '' })}>
        remove-format
      </button>
      <button type="button" onClick={() => photo.updateComponents({ signatureImage: URL.createObjectURL(new Blob()) })}>
        upload-signature
      </button>
      <button type="button" onClick={() => photo.updateComponents({ signatureImage: '' })}>
        remove-signature
      </button>
      <button
        type="button"
        onClick={() => photo.updateComponents({ backgroundPatternImage: URL.createObjectURL(new Blob()) })}
      >
        upload-bg
      </button>
      <button type="button" onClick={() => photo.updateComponents({ backgroundPatternImage: '' })}>
        remove-bg
      </button>
      <button type="button" onClick={() => photo.updateMovieInfo({ theater: photo.state.movieInfo.theater + 'x' })}>
        edit-other
      </button>
      <button type="button" disabled={!hist.canUndo} onClick={hist.undo}>
        undo
      </button>
    </>
  );
}

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
  jest.useFakeTimers();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  URL.createObjectURL = origCreate;
  URL.revokeObjectURL = origRevoke;
});

const userSetup = () => userEvent.setup({ delay: null });
const undoBtn = () => screen.getByText('undo') as HTMLButtonElement;
const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));
const mountSettle = () => advance(400); // 마운트 직후 첫 디바운스가 베이스라인을 잡는다
const settle = () => advance(360); // 350ms 디바운스 발화

const FIELDS = [
  { name: 'chain', upload: 'upload-chain', remove: 'remove-chain', get: (s: PhototicketState) => s.components.chain },
  { name: 'format', upload: 'upload-format', remove: 'remove-format', get: (s: PhototicketState) => s.components.format },
  {
    name: 'signatureImage',
    upload: 'upload-signature',
    remove: 'remove-signature',
    get: (s: PhototicketState) => s.components.signatureImage ?? '',
  },
  // 배경 이미지(#671/#672)는 로고 3종보다 나중에 생긴 blob 필드라 #673 가드에서 빠져 있었다 —
  // 같은 축으로 세워 "새 blob 필드가 늘면 가드도 는다"를 테이블이 강제하게 한다.
  {
    name: 'backgroundPatternImage',
    upload: 'upload-bg',
    remove: 'remove-bg',
    get: (s: PhototicketState) => s.components.backgroundPatternImage ?? '',
  },
];

describe.each(FIELDS)('$name 제거의 undo-aware revoke (#673)', ({ upload, remove, get }) => {
  test('히스토리에 실린 URL은 제거해도 안 풀리고 undo로 되돌아온다', async () => {
    const user = userSetup();
    render(<Harness />);
    await mountSettle();

    await user.click(screen.getByText(upload));
    const uploadedUrl = get(captured);
    expect(uploadedUrl).toMatch(/^blob:mock\//);
    await settle(); // 업로드 상태가 히스토리에 실린다

    await user.click(screen.getByText(remove));
    expect(get(captured)).toBe('');
    expect(revoked).not.toContain(uploadedUrl); // 아직 히스토리가 참조 → 보류

    await settle(); // 제거 상태도 히스토리에 실린다
    await user.click(undoBtn());
    expect(get(captured)).toBe(uploadedUrl); // undo로 살아있는 URL이 그대로 돌아온다
    expect(revoked).not.toContain(uploadedUrl);
  });

  test('히스토리에 한 번도 안 실린 URL은 제거 즉시 revoke된다', async () => {
    const user = userSetup();
    render(<Harness />);
    await mountSettle();

    await user.click(screen.getByText(upload));
    const uploadedUrl = get(captured);
    // 350ms 디바운스 창 안에 바로 제거 — 업로드 상태가 히스토리에 한 번도 안 실린다.
    await user.click(screen.getByText(remove));

    expect(get(captured)).toBe('');
    expect(revoked).toContain(uploadedUrl);
  });
});

describe('참조가 나중에 끊기면 지연 회수된다 (#673, redo 가지 절단)', () => {
  test('제거 시점엔 히스토리가 참조해 보류됐다가, 그 스냅샷이 redo 가지 절단으로 사라지면 뒤늦게 revoke된다', async () => {
    const user = userSetup();
    render(<Harness />);
    await mountSettle();

    await user.click(screen.getByText('upload-chain'));
    const uploadedUrl = captured.components.chain;
    await settle(); // 히스토리에 chain=uploadedUrl 스냅샷이 실린다

    await user.click(screen.getByText('remove-chain'));
    expect(revoked).not.toContain(uploadedUrl); // 아직 참조 중 → 보류
    await settle(); // chain='' 스냅샷도 실린다

    await user.click(undoBtn());
    await user.click(undoBtn()); // 베이스라인으로 — uploadedUrl을 쥔 스냅샷은 여전히 스택에 남아 있다
    expect(revoked).not.toContain(uploadedUrl);

    // 베이스라인에서 새 편집 → undo 위치 이후(uploadedUrl을 쥔 스냅샷 포함)의 redo 가지를 절단한다.
    await user.click(screen.getByText('edit-other'));
    await settle();

    expect(revoked).toContain(uploadedUrl); // 더는 어느 스냅샷도 참조하지 않으므로 뒤늦게 회수된다
  });
});
