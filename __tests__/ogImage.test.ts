import { describe, expect, test } from 'bun:test';
import sharp from 'sharp';
import { OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from '../src/utils/ogImage';
import { buildOgImage } from '../src/utils/ogImageBuild';

// 세로 티켓(대부분 960×1534 등)을 1200×630 가로 OG 카드에 크롭 없이 담는지 검증(#438).
// 합성 포스터 100×160(세로)를 넣어 실제 티켓과 같은 종횡비 방향으로 재현한다.
async function readPixel(jpeg: Buffer, x: number, y: number): Promise<number[]> {
  const { data } = await sharp(jpeg)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Array.from(data);
}

describe('buildOgImage — 세로 티켓을 1200×630 가로 letterbox로 (#438)', () => {
  test('출력 치수는 항상 1200×630', async () => {
    const input = await sharp({
      create: { width: 100, height: 160, channels: 3, background: { r: 220, g: 30, b: 30 } },
    }).jpeg().toBuffer();
    const og = await buildOgImage(input);
    const meta = await sharp(og).metadata();
    expect(meta.width).toBe(OG_IMAGE_WIDTH);
    expect(meta.height).toBe(OG_IMAGE_HEIGHT);
  });

  test('세로 이미지는 크롭 없이 중앙에 배치되고 좌우가 배경색으로 채워진다(letterbox)', async () => {
    // 100×160 입력을 1200×630에 fit:'contain'하면 세로가 꽉 차 630, 가로는 630/160*100=393.75 ->
    // 좌우 여백(각 ~403px)이 생긴다. 코너는 배경, 중앙은 입력 색(빨강)이어야 크롭 없이 들어간 것.
    const input = await sharp({
      create: { width: 100, height: 160, channels: 3, background: { r: 220, g: 30, b: 30 } },
    }).jpeg().toBuffer();
    const og = await buildOgImage(input);

    const corner = await readPixel(og, 0, 0);
    expect(corner[0]).toBeLessThan(30); // 배경(#0e1012)은 어둡다 — 빨강(220)과 뚜렷이 구분
    expect(corner[1]).toBeLessThan(30);

    const center = await readPixel(og, OG_IMAGE_WIDTH / 2, OG_IMAGE_HEIGHT / 2);
    expect(center[0]).toBeGreaterThan(150); // 입력 빨강이 중앙까지 크롭 없이 도달
  });

  test('가로(landscape) 티켓도 크롭 없이 들어간다', async () => {
    const input = await sharp({
      create: { width: 160, height: 100, channels: 3, background: { r: 30, g: 30, b: 220 } },
    }).jpeg().toBuffer();
    const og = await buildOgImage(input);
    const meta = await sharp(og).metadata();
    expect(meta.width).toBe(OG_IMAGE_WIDTH);
    expect(meta.height).toBe(OG_IMAGE_HEIGHT);

    const center = await readPixel(og, OG_IMAGE_WIDTH / 2, OG_IMAGE_HEIGHT / 2);
    expect(center[2]).toBeGreaterThan(150); // 입력 파랑이 중앙까지 크롭 없이 도달
  });
});
