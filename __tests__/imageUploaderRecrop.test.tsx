/**
 * Regression test for the #182 review P1 (PR #191).
 *
 * ImageUploader keeps the upload's original objectURL alive so the user can
 * re-crop it. handleCropCancel must distinguish three cases:
 *  - first-upload cancel      → drop the original (nothing to re-crop)
 *  - re-crop cancel           → KEEP the original (re-crop it again)
 *  - replace-then-cancel      → drop the original — the displayed poster's
 *    source was already revoked when the replacement file was picked, so the
 *    stale objectURL must NOT survive as the re-crop target.
 *
 * The P1 bug: the old `if (!hasImage)` guard couldn't see the replace case
 * (hasImage is still true from the committed poster), so after replace+cancel
 * the "재크롭" button opened the WRONG file (the abandoned replacement). The fix
 * tracks `pendingNewFile`; this test asserts "재크롭" is disabled after that flow.
 *
 * ImageCropModal (react-easy-crop, canvas) and getCroppedImg (canvas) are
 * mocked so only the cancel/complete state machine is exercised.
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// A lightweight stand-in for the crop modal: exposes Apply/Cancel as buttons so
// the test can drive onComplete/onClose without react-easy-crop or a canvas.
mock.module('@/components/ImageCropModal', () => ({
  default: ({ onClose, onComplete }: { onClose: () => void; onComplete: (a: unknown) => void }) => (
    <div role="dialog">
      <button type="button" onClick={() => onComplete({ x: 0, y: 0, width: 1, height: 1 })}>
        mock-apply
      </button>
      <button type="button" onClick={onClose}>mock-cancel</button>
    </div>
  ),
}));

// Avoid the canvas path; each crop yields a distinct fake url.
let cropN = 0;
mock.module('@/utils/imageCrop', () => ({
  getCroppedImg: async () => `blob:cropped-${++cropN}`,
}));

const ImageUploader =
  (require('@/components/ImageUploader') as { default: typeof import('@/components/ImageUploader').default }).default;

// Parent-like harness: owns croppedImageUrl exactly as EditorCanvas does, so
// hasImage flips to true once the first crop commits.
function Harness() {
  const [url, setUrl] = useState<string | null>(null);
  return <ImageUploader onUpload={setUrl} isProcessing={false} hasImage={!!url} imageUrl={url} />;
}

const fileInput = () =>
  document.querySelector('input[type="file"]') as HTMLInputElement;

afterEach(() => {
  cleanup();
  cropN = 0;
});

describe('ImageUploader re-crop target (#182 PR #191 P1)', () => {
  test('replace-then-cancel disables 재크롭 (no stale objectURL)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 1. First upload → crop modal → apply commits the poster.
    await user.upload(fileInput(), new File(['a'], 'a.png', { type: 'image/png' }));
    await user.click(await screen.findByText('mock-apply'));

    // Poster committed: preview shows 교체/재크롭, and 재크롭 is enabled.
    const recrop = await screen.findByRole('button', { name: '재크롭' });
    expect(recrop.hasAttribute('disabled')).toBe(false);

    // 2. Replace: pick a new file, then CANCEL the crop.
    await user.upload(fileInput(), new File(['b'], 'b.png', { type: 'image/png' }));
    await user.click(await screen.findByText('mock-cancel'));

    // 3. The committed poster's source is gone — 재크롭 must be disabled, not
    //    silently pointing at the abandoned replacement file.
    expect(
      screen.getByRole('button', { name: '재크롭' }).hasAttribute('disabled')
    ).toBe(true);
  });

  test('re-crop cancel KEEPS the original (재크롭 stays enabled)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(fileInput(), new File(['a'], 'a.png', { type: 'image/png' }));
    await user.click(await screen.findByText('mock-apply'));

    // Open re-crop, then cancel — original must survive for the next re-crop.
    await user.click(await screen.findByRole('button', { name: '재크롭' }));
    await user.click(await screen.findByText('mock-cancel'));

    expect(
      screen.getByRole('button', { name: '재크롭' }).hasAttribute('disabled')
    ).toBe(false);
  });
});
