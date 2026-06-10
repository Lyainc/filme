import { afterEach, describe, expect, test } from 'bun:test';
import {
  buildJpegOptions,
  canShareTicketFile,
  dataUrlToJpegBlob,
} from '../src/utils/captureToImage';
import { LAYOUTS } from '../src/utils/layouts';

describe('buildJpegOptions — AC12: capture dimensions invariant', () => {
  test('pixelRatio defaults to 2', () => {
    const opts = buildJpegOptions(960, 1477);
    expect(opts.pixelRatio).toBe(2);
  });

  test('canvasWidth = width * pixelRatio', () => {
    const opts = buildJpegOptions(960, 1477);
    expect(opts.canvasWidth).toBe(960 * 2);
  });

  test('canvasHeight = height * pixelRatio', () => {
    const opts = buildJpegOptions(960, 1477);
    expect(opts.canvasHeight).toBe(1477 * 2);
  });

  test('width and height pass through unchanged', () => {
    const opts = buildJpegOptions(1477, 960);
    expect(opts.width).toBe(1477);
    expect(opts.height).toBe(960);
  });

  test('transform: none is set (capture wrapper fix)', () => {
    const opts = buildJpegOptions(960, 1477);
    expect(opts.style.transform).toBe('none');
  });

  test('backgroundColor is black (ticket background)', () => {
    const opts = buildJpegOptions(960, 1477);
    expect(opts.backgroundColor).toBe('#000000');
  });

  test.each(LAYOUTS.map((l) => [l.id, l.width, l.height] as const))(
    'layout %s: canvasWidth=%i*2 canvasHeight=%i*2',
    (id, width, height) => {
      const opts = buildJpegOptions(width, height);
      expect(opts.canvasWidth).toBe(width * 2);
      expect(opts.canvasHeight).toBe(height * 2);
      expect(opts.pixelRatio).toBe(2);
    }
  );
});

describe('dataUrlToJpegBlob — CSP-safe base64 decode (no fetch(data:))', () => {
  test('decodes a base64 data URL into a JPEG Blob', async () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG SOI marker
    const dataUrl = `data:image/jpeg;base64,${btoa(String.fromCharCode(...bytes))}`;
    const blob = dataUrlToJpegBlob(dataUrl);
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe(4);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  });

  test('throws on non-image data URL (empty capture)', () => {
    expect(() => dataUrlToJpegBlob('data:,')).toThrow('Capture returned empty data URL');
  });

  test('throws on empty string', () => {
    expect(() => dataUrlToJpegBlob('')).toThrow('Capture returned empty data URL');
  });
});

describe('canShareTicketFile — Web Share API Level 2 guard', () => {
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  const originalCanShare = nav.canShare;
  const originalShare = nav.share;

  afterEach(() => {
    nav.canShare = originalCanShare;
    nav.share = originalShare;
  });

  test('returns false when navigator.canShare is missing (desktop fallback)', () => {
    nav.canShare = undefined;
    nav.share = undefined;
    expect(canShareTicketFile()).toBe(false);
  });

  test('returns false when share exists but canShare rejects files', () => {
    nav.canShare = () => false;
    nav.share = async () => {};
    expect(canShareTicketFile()).toBe(false);
  });

  test('returns true when canShare accepts a JPEG file probe', () => {
    nav.canShare = (data?: ShareData) =>
      !!data?.files?.length && data.files[0].type === 'image/jpeg';
    nav.share = async () => {};
    expect(canShareTicketFile()).toBe(true);
  });

  test('returns false when canShare itself throws', () => {
    nav.canShare = () => {
      throw new TypeError('boom');
    };
    nav.share = async () => {};
    expect(canShareTicketFile()).toBe(false);
  });
});
