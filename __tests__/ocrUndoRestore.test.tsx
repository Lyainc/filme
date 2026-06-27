/**
 * Regression test for #163 (and the #141 review P1 it codifies).
 *
 * OCR injection mutates two separate slices of state at once:
 *  - form fields (theater/seat/... on `movieInfo`), and
 *  - chain components (`chainVisible`/`chainLabel`), which land in the
 *    exported ticket — the P1 bug was that undo reverted the form fields but
 *    NOT `chainLabel`, leaving a stale brand label baked into the export.
 *
 * This drives the real EditorCanvas ↔ OcrUploadCard state flow through
 * @testing-library/react + user-event, with only `runOcr` mocked, and asserts
 * that "되돌리기" (undo) restores BOTH slices atomically to the pre-OCR snapshot.
 * If handleCancelOcr stops reverting the component snapshot, this fails.
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
});
