import type { NextApiRequest, NextApiResponse } from 'next';
import { put } from '@vercel/blob';
import { clientIp, decodeAllowedImage } from '@/utils/ocrRoute';
import { MAX_BYTES } from '@/utils/ocrConstants';
import { checkTicketRateLimit } from '@/utils/ratelimit';

/**
 * 완성 티켓 JPEG를 base64 JSON으로 받는다(OCR 라우트와 동일 규약). 캡처 결과는
 * captureToImage에서 나오는 우리 JPEG라 multipart일 이유가 없다. base64는 ~33% 크지만
 * 960×1477×2 JPEG이 보통 0.5~1.5MB라 기본 1mb 한도를 넘을 수 있어 여유 있게 상향한다.
 */
export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } },
};

/** 메타 JSON에 넣을 사용자 입력은 길이를 잘라 저장 비용·악용을 막는다. */
function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

/**
 * 완성 티켓 JPEG → Vercel Blob 영구 저장 → 공유 링크 발급(#91 C1).
 *
 * 가드 순서는 OCR 라우트와 동일하다: method → 입력(존재·매직바이트·크기) → rate limit →
 * 인증(Blob 토큰). 저렴한 검증을 먼저 둬 토큰 없이도 잘못된 입력을 거부하고, 남용은 Blob
 * 쓰기 전에 막는다. **절대 throw하지 않는다** — 모든 실패를 status + { error }로 돌려준다.
 *
 * 이미지(`t/<id>.jpg`)와 메타(`t/<id>.json`)를 함께 저장한다. 메타는 /t/[id] 랜딩의
 * og:title 개인화에 쓰인다 — Blob public URL은 store suffix 때문에 id만으로 알 수 없어
 * SSR이 list로 조회하는데, 그때 title을 함께 읽어 og를 채운다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as { image?: unknown; title?: unknown; layout?: unknown } | undefined;
  const image = typeof body?.image === 'string' ? body.image : '';
  if (!image) {
    return res.status(400).json({ error: 'image (base64) is required' });
  }

  // 우리 캡처 결과는 항상 JPEG. data URL prefix가 붙어와도 방어적으로 제거한다.
  const base64 = image.replace(/^data:[^;]+;base64,/, '');
  const decoded = decodeAllowedImage(base64, 'image/jpeg');
  if (!decoded) {
    return res.status(400).json({ error: 'Invalid JPEG payload' });
  }
  if (decoded.length > MAX_BYTES) {
    return res.status(413).json({ error: 'Image too large (max 10MB)' });
  }

  // Rate limit: IP sliding window(분당 5·시간당 20·일당 60). Production env 누락은 503으로 닫는다.
  const rl = await checkTicketRateLimit(clientIp(req));
  if (!rl.ok) {
    if (rl.reason === 'misconfigured') {
      return res.status(503).json({ error: 'Rate limit is not configured' });
    }
    res.setHeader('Retry-After', String(rl.retryAfterSec ?? 60));
    return res.status(429).json({ error: 'Too many requests' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob storage is not configured' });
  }

  const id = crypto.randomUUID();
  const title = sanitizeText(body?.title, 200);
  const layout = sanitizeText(body?.layout, 32);

  try {
    const meta = JSON.stringify({ title, layout, createdAt: new Date().toISOString() });
    // 이미지 먼저 — 메타 저장이 실패해도 이미지(og:image 본체)는 남아 링크가 동작한다.
    const blob = await put(`t/${id}.jpg`, Buffer.from(decoded), {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: false,
    });
    await put(`t/${id}.json`, meta, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return res.status(200).json({ id, url: blob.url });
  } catch (err) {
    console.error('[api/ticket] blob put failed:', err);
    return res.status(502).json({ error: 'Ticket upload failed' });
  }
}
