/**
 * Regression test for the #182 review (PR #191).
 *
 * ImageUploader keeps the upload's original objectURL alive so the user can
 * re-crop it. handleCropCancel must distinguish three cases:
 *  - first-upload cancel      → drop the original (nothing to re-crop)
 *  - re-crop cancel           → KEEP the original (re-crop it again)
 *  - replace-then-cancel      → drop the original — the displayed poster's
 *    source was already revoked when the replacement file was picked, so the
 *    stale objectURL must NOT survive as the re-crop target.
 *
 * The P1 bug: the old "committed poster exists" guard couldn't see the replace
 * case (the committed poster is still displayed), so after replace+cancel
 * the "재크롭" button opened the WRONG file (the abandoned replacement). The fix
 * tracks `pendingNewFile`; this test asserts "재크롭" is disabled after that flow.
 *
 * Round-2 fix also added a `busy` guard to handleDrop: dropping a file mid-crop
 * would revoke the original blob that getCroppedImg is still reading. The
 * "isCropping 동안 드롭" test below holds the crop promise open to exercise it.
 *
 * ImageCropModal (react-image-crop, canvas) and getCroppedImg (canvas) are
 * mocked so only the cancel/complete/drop state machine is exercised.
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// A lightweight stand-in for the crop modal: exposes Apply/Cancel as buttons and
// surfaces imageSrc so a test can see which original the modal currently targets.
mock.module('@/components/ImageCropModal', () => ({
  default: ({
    imageSrc,
    onClose,
    onComplete,
  }: {
    imageSrc: string;
    onClose: () => void;
    onComplete: (a: unknown) => void;
  }) => (
    <div role="dialog">
      <span data-testid="crop-src">{imageSrc}</span>
      <button type="button" onClick={() => onComplete({ x: 0, y: 0, width: 1, height: 1 })}>
        mock-apply
      </button>
      <button type="button" onClick={onClose}>mock-cancel</button>
    </div>
  ),
}));

// Avoid the canvas path. `holdCrop` pauses the next crop so a test can observe
// the isCropping (busy) window; `releaseCrop` resolves it.
let cropN = 0;
let holdCrop = false;
let releaseCrop: (() => void) | null = null;
mock.module('@/utils/imageCrop', () => ({
  getCroppedImg: () =>
    new Promise<string>((resolve) => {
      const url = `blob:cropped-${++cropN}`;
      if (holdCrop) releaseCrop = () => resolve(url);
      else resolve(url);
    }),
}));

const ImageUploader =
  (require('@/components/ImageUploader') as { default: typeof import('@/components/ImageUploader').default }).default;

// Parent-like harness: owns croppedImageUrl exactly as DesktopStudioShell does, so
// imageUrl is set once the first crop commits.
function Harness() {
  const [url, setUrl] = useState<string | null>(null);
  return <ImageUploader onUpload={setUrl} isProcessing={false} imageUrl={url} layout="minimal" />;
}

const fileInput = () =>
  document.querySelector('input[type="file"]') as HTMLInputElement;
const pngFile = (name: string) => new File([name], name, { type: 'image/png' });

afterEach(() => {
  cleanup();
  cropN = 0;
  holdCrop = false;
  releaseCrop = null;
});

describe('ImageUploader re-crop target (#182 PR #191)', () => {
  test('replace-then-cancel disables 재크롭 (no stale objectURL)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    // 1. First upload → crop modal → apply commits the poster.
    await user.upload(fileInput(), pngFile('a.png'));
    await user.click(await screen.findByText('mock-apply'));

    // Poster committed: preview shows 교체/재크롭, and 재크롭 is enabled.
    const recrop = await screen.findByRole('button', { name: '재크롭' });
    expect(recrop.hasAttribute('disabled')).toBe(false);

    // 2. Replace: pick a new file, then CANCEL the crop.
    await user.upload(fileInput(), pngFile('b.png'));
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

    await user.upload(fileInput(), pngFile('a.png'));
    await user.click(await screen.findByText('mock-apply'));

    // Open re-crop, then cancel — original must survive for the next re-crop.
    await user.click(await screen.findByRole('button', { name: '재크롭' }));
    await user.click(await screen.findByText('mock-cancel'));

    expect(
      screen.getByRole('button', { name: '재크롭' }).hasAttribute('disabled')
    ).toBe(false);
  });

  test('first-upload cancel shows no preview (original discarded)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(fileInput(), pngFile('a.png'));
    await user.click(await screen.findByText('mock-cancel'));

    // imageUrl never set → drop zone stays, no 교체/재크롭 surface.
    expect(screen.queryByRole('button', { name: '재크롭' })).toBeNull();
    expect(screen.getByText('포스터 업로드')).toBeTruthy();
  });

  test('drop during isCropping is ignored (in-flight original preserved)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.upload(fileInput(), pngFile('a.png'));
    const srcBefore = (await screen.findByTestId('crop-src')).textContent;

    // Apply, but hold the crop so isCropping (busy) stays true with the modal open.
    // imageUrl is still null here (onUpload not yet called), so the drop zone is
    // the <label> — fire on it directly, since onDrop lives there, not on <section>.
    holdCrop = true;
    await user.click(screen.getByText('mock-apply'));
    const dropZone = document.querySelector('label')!;

    // Drop a new file mid-crop. The busy guard must reject it, so openFile is not
    // called and the modal keeps pointing at the in-flight original (srcBefore).
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [pngFile('b.png')] },
    });
    expect(screen.getByTestId('crop-src').textContent).toBe(srcBefore);

    // Release the held crop so no act() leak; only one crop ran.
    await act(async () => {
      releaseCrop?.();
    });
    expect(cropN).toBe(1);
  });
});
