/**
 * Regression test for #276: TexturePicker's texture chips must stay visible
 * as live samples even before a poster is uploaded, and switch to the real
 * poster crop once one is provided — without swapping which component renders
 * the thumbnail (same TexturePreview, just a different `src`).
 */
import { describe, expect, test, afterEach } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import TexturePicker from '@/components/wizard/TexturePicker';
import { TEXTURE_OPTIONS } from '@/utils/constants';

afterEach(cleanup);

describe('TexturePicker', () => {
  test('renders bundled sample thumbnails when no poster is uploaded', () => {
    const { container } = render(
      <TexturePicker value="original" onChange={() => {}} croppedImageUrl={null} />
    );

    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs).toHaveLength(TEXTURE_OPTIONS.length);
    for (const img of imgs) {
      expect(img.getAttribute('src')).toBe('/assets/texture-sample.svg');
    }
  });

  test('switches every chip to the real poster crop once one is uploaded', () => {
    const posterUrl = 'blob:http://localhost/cropped-poster';
    const { container } = render(
      <TexturePicker value="original" onChange={() => {}} croppedImageUrl={posterUrl} />
    );

    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs).toHaveLength(TEXTURE_OPTIONS.length);
    for (const img of imgs) {
      expect(img.getAttribute('src')).toBe(posterUrl);
    }
  });
});
