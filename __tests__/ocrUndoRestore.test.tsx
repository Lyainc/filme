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
 * Two render targets share the one `runOcr` mock (a second mock.module file would
 * leak globally — bun mock.module is not file-scoped): EditorCanvas (desktop/test
 * default path) AND MobileEditorShell (the #261 production path, where the shell
 * itself owns useOcrUndo + OcrUploadCard + OcrUndoBanner and EditorCanvas is always
 * hideChromeControls). The shell case guards the shell's own prop wiring
 * (ocr.apply / setComponents / currentComponents / banner onCancel).
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PhototicketState } from '@/types';

// runOcr must be mocked BEFORE EditorCanvas (which transitively imports it via
// OcrUploadCard) is loaded — bun's mock.module is not hoisted, so EditorCanvas
// is pulled in via dynamic import below, after this registration.
let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
mock.module('@/utils/ocr', () => ({
  runOcr: (file: File) => ocrImpl(file),
}));

// require (not top-level await import) so EditorCanvas loads AFTER the mock
// above without tripping the es5 target's no-top-level-await rule.
const { EditorCanvas } =
  require('@/components/v2/EditorCanvas') as typeof import('@/components/v2/EditorCanvas');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { usePhototicket } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

// The Harness owns the real phototicket state (like the page does) and exposes
// the latest snapshot so assertions read the source of truth, not the DOM.
let captured: PhototicketState;

function Harness() {
  const photo = usePhototicket();
  captured = photo.state;
  return <EditorCanvas photo={photo} onPendingFetchChange={() => {}} />;
}

// #261 셸 경로 — 프로덕션에서 EditorCanvas는 항상 hideChromeControls라, 사용자가 타는 OCR 배선은
// MobileEditorShell이 직접 쥔 useOcrUndo/OcrUploadCard/OcrUndoBanner다. layout은 preview 렌더와
// 무관한 'stub'(OCR은 croppedImageUrl 없이도 동작 — 카드가 collapse 밖·미게이팅).
function MobileHarness() {
  const photo = usePhototicket();
  captured = photo.state;
  return (
    <MobileEditorShell
      photo={photo}
      canExport
      theme="light"
      onThemeChange={() => {}}
      onPendingFetchChange={() => {}}
      onDone={() => {}}
      disabledReason=""
      previewMovieInfo={photo.state.movieInfo}
      previewComponents={{ ...photo.state.components, layout: 'stub' }}
      fieldVisibility={photo.state.fieldVisibility}
    />
  );
}

/** EditorCanvas mounts two file inputs; the OCR card's is the `image/*` one. */
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
  test('undo atomically reverts chainVisible/chainLabel + form fields', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // Pre-OCR baseline.
    expect(captured.components.chainLabel).toBe('');
    expect(captured.components.chainVisible).toBe(true);
    expect(captured.movieInfo.theater).toBe('');
    expect(captured.movieInfo.seat).toBe('');

    // OCR recognizes a CGV chain + two direct fields. No `title` is returned so
    // the async KOBIS lookup path stays out of this test.
    ocrImpl = async () => ({
      chain: 'cgv',
      theater: 'CGV 용산아이파크몰',
      seat: 'H12',
    });

    await user.upload(
      ocrFileInput(),
      new File(['x'], 'ticket.png', { type: 'image/png' })
    );

    // Apply landed: chain label + form fields mutated, undo banner shown.
    const undoButton = await screen.findByRole('button', { name: '되돌리기' });
    expect(captured.components.chainLabel).toBe('CGV');
    expect(captured.components.chainVisible).toBe(true);
    expect(captured.movieInfo.theater).toBe('CGV 용산아이파크몰');
    expect(captured.movieInfo.seat).toBe('H12');

    // Undo: every OCR-touched field snaps back to the pre-OCR snapshot together.
    await user.click(undoButton);

    expect(captured.components.chainLabel).toBe(''); // #141 P1: label must revert
    expect(captured.components.chainVisible).toBe(true);
    expect(captured.movieInfo.theater).toBe('');
    expect(captured.movieInfo.seat).toBe('');

    // Banner dismissed once the snapshot is consumed.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull();
    });
  });

  // #261 P1: 셸이 직접 소유한 배선(ocr.apply / setComponents / currentComponents / 배너 onCancel)을
  // EditorCanvas 케이스와 동형으로 검증 — 프로덕션 모바일이 타는 실제 경로.
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
});
