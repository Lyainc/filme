import sharp from 'sharp';
import { OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT } from './ogImage';

/** .theme-dark --bg와 동일 — OG 카드는 카톡/트위터 등 앱 테마 밖에서 보이므로 고정 다크 배경. */
const OG_BACKGROUND = { r: 0x0e, g: 0x10, b: 0x12, alpha: 1 };

/** 완성 티켓 JPEG(세로 대부분)를 크롭 없이 1200×630 가로 캔버스에 letterbox로 담는다 —
 * sharp의 fit:'contain'이 종횡비 보존 + 중앙 배치 + 배경색 패딩을 한 번에 처리한다.
 *
 * Node 전용(`sharp`) — API 라우트에서만 import할 것. 페이지 컴포넌트가 이 파일을 (직접이든
 * 간접이든) import하면 클라이언트 번들링이 깨진다(`ogImage.ts` 상단 주석 참고).
 */
export async function buildOgImage(ticketJpeg: Buffer): Promise<Buffer> {
  return sharp(ticketJpeg)
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, { fit: 'contain', background: OG_BACKGROUND })
    .jpeg({ quality: 82 })
    .toBuffer();
}
