/**
 * Regression test for #163 (and the #141 review P1 it codifies).
 *
 * OCR injection mutates two separate slices of state at once:
 *  - form fields (theater/seat/... on `movieInfo`), and
 *  - chain components (`chainVisible`/`chainLabel`), which land in the
 *    exported ticket — the P1 bug was that undo reverted the form fields but
 *    NOT `chainLabel`, leaving a stale brand label baked into the export.
 *
 * This drives the real OcrUploadCard ↔ useOcrUndo state flow through
 * @testing-library/react + user-event, with only `runOcr` mocked, and asserts
 * that "되돌리기" (undo) restores BOTH slices atomically to the pre-OCR snapshot.
 * If handleCancelOcr stops reverting the component snapshot, this fails.
 *
 * Renders MobileEditorShell (the #261 production path), which itself owns
 * useOcrUndo + OcrUploadCard + OcrUndoBanner — the real wiring users hit. Guards the
 * shell's own prop wiring (ocr.apply / setComponents / currentComponents / banner onCancel).
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhototicketState } from '@/types';

// runOcr must be mocked BEFORE MobileEditorShell (which transitively imports it via
// OcrUploadCard) is loaded — bun's mock.module is not hoisted, so the shell is
// pulled in via require below, after this registration.
let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
mock.module('@/utils/ocr', () => ({
  runOcr: (file: File) => ocrImpl(file),
}));

// require (not top-level await import) so the shell loads AFTER the mock above
// without tripping the es5 target's no-top-level-await rule.
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { usePhototicket } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

// The Harness owns the real phototicket state (like the page does) and exposes
// the latest snapshot so assertions read the source of truth, not the DOM.
let captured: PhototicketState;

// 프로덕션 OCR 배선은 MobileEditorShell이 직접 쥔 useOcrUndo/OcrUploadCard/OcrUndoBanner다. layout은
// preview 렌더와 무관한 'stub'(OCR은 croppedImageUrl 없이도 동작 — 카드가 collapse 밖·미게이팅).
function MobileHarness() {
  const photo = usePhototicket();
  captured = photo.state;
  return (
    <>
      {/* #328 max 회귀 테스트 전용 시드 — ZoomSegment pill은 croppedImageUrl이 있어야 렌더된다. */}
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        onThemeChange={() => {}}
        onDone={() => {}}
        disabledReason=""
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={{ ...photo.state.components, layout: 'stub' }}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

/** The shell mounts multiple file inputs; the OCR card's is the only `image/*` one. */
function ocrFileInput(): HTMLInputElement {
  const inputs = Array.from(
    document.querySelectorAll('input[type="file"]')
  ) as HTMLInputElement[];
  const input = inputs.find((i) => i.getAttribute('accept') === 'image/*');
  if (!input) throw new Error('OcrUploadCard file input not found');
  return input;
}

afterEach(() => {
  cleanup();
  ocrImpl = async () => ({});
});

describe('OCR undo restoration (#163 / #141 P1)', () => {
  // #261 P1: 셸이 직접 소유한 배선(ocr.apply / setComponents / currentComponents / 배너 onCancel)을
  // 검증 — 프로덕션 모바일이 타는 실제 경로.
  test('MobileEditorShell 경로: undo가 chainVisible/chainLabel + 폼 필드를 원자 복원', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    expect(captured.components.chainLabel).toBe('');
    expect(captured.components.chainVisible).toBe(true);
    expect(captured.movieInfo.theater).toBe('');
    expect(captured.movieInfo.seat).toBe('');

    ocrImpl = async () => ({
      chain: 'cgv',
      theater: 'CGV 용산아이파크몰',
      seat: 'H12',
    });

    await user.upload(
      ocrFileInput(),
      new File(['x'], 'ticket.png', { type: 'image/png' })
    );

    const undoButton = await screen.findByRole('button', { name: '되돌리기' });
    expect(captured.components.chainLabel).toBe('CGV');
    expect(captured.components.chainVisible).toBe(true);
    expect(captured.movieInfo.theater).toBe('CGV 용산아이파크몰');
    expect(captured.movieInfo.seat).toBe('H12');

    await user.click(undoButton);

    expect(captured.components.chainLabel).toBe(''); // #141 P1: 라벨 원자 복원
    expect(captured.components.chainVisible).toBe(true);
    expect(captured.movieInfo.theater).toBe('');
    expect(captured.movieInfo.seat).toBe('');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull();
    });
  });

  // #328 claude-review 재검토 P1: max는 헤더·서브메뉴·pill·OCR과 함께 OCR 되돌리기 배너·토스트도
  // 숨겨야 "티켓만 노출"이라는 스펙이 성립한다 — 배너가 뜬 채로 최대화하면 풀스크린 위에 겹쳐 보이고
  // 탭도 되던 버그(PR #332)의 회귀 테스트.
  test('OCR 배너가 뜬 채로 최대화하면 배너가 숨고, 기본 복귀 시 다시 보인다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);

    await user.click(screen.getByText('seed-poster'));

    ocrImpl = async () => ({ theater: 'CGV 용산아이파크몰' });
    await user.upload(ocrFileInput(), new File(['x'], 'ticket.png', { type: 'image/png' }));
    expect(await screen.findByRole('button', { name: '되돌리기' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '최대화' }));
    expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '기본 크기로 돌아가기' }));
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeTruthy();
  });
});
