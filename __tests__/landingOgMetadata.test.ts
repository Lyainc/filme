import { describe, expect, test } from 'bun:test';
import { readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';

const HOME_PAGE = readFileSync('src/pages/index.tsx', 'utf8');
const APP_SHELL = readFileSync('src/pages/_app.tsx', 'utf8');

describe('홈 공유 메타데이터 (#613)', () => {
  test('1200×630 JPEG 카드와 홈 전용 절대 URL을 연결한다', async () => {
    const imagePath = 'public/assets/landing/og.jpg';
    const imageUrl = 'https://filme-web.vercel.app/assets/landing/og.jpg';
    const metadata = await sharp(imagePath).metadata();

    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(630);
    expect(statSync(imagePath).size).toBeLessThanOrEqual(150 * 1024);
    expect(HOME_PAGE).toContain(`<meta property="og:image" content="${imageUrl}" />`);
    expect(HOME_PAGE).toContain(`<meta name="twitter:image" content="${imageUrl}" />`);
    expect(APP_SHELL).not.toContain('og:image');
  });
});
