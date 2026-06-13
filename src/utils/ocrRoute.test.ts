import { describe, expect, it } from 'bun:test';
import { decodeAllowedImage } from './ocrRoute';

const ONE_BY_ONE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('decodeAllowedImage', () => {
  it('accepts a valid base64 image with matching magic bytes', () => {
    const bytes = decodeAllowedImage(ONE_BY_ONE_PNG, 'image/png');

    expect(bytes).not.toBeNull();
    expect(bytes?.[0]).toBe(0x89);
  });

  it('rejects non-base64 payloads before model calls', () => {
    expect(decodeAllowedImage('not an image!', 'image/png')).toBeNull();
  });

  it('rejects base64 text even when the claimed MIME is allowed', () => {
    const textPayload = Buffer.from('hello from an attacker').toString('base64');

    expect(decodeAllowedImage(textPayload, 'image/jpeg')).toBeNull();
  });

  it('rejects image bytes when the claimed MIME does not match', () => {
    expect(decodeAllowedImage(ONE_BY_ONE_PNG, 'image/webp')).toBeNull();
  });
});
