import { describe, expect, test } from 'bun:test';
import { buildJpegOptions } from '../src/utils/captureToImage';
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
