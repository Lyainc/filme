import type { NextApiRequest, NextApiResponse } from 'next';
import { checkOcrRateLimit } from '@/utils/ratelimit';
import { ALLOWED_MIME, MAX_BYTES } from '@/utils/ocrConstants';

/** 클라이언트 IP — Vercel은 x-forwarded-for를 설정한다. 로컬 dev는 소켓 주소로 폴백. */
export function clientIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  return req.socket.remoteAddress ?? 'unknown';
}

function hasImageMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }

  return false;
}

export function decodeAllowedImage(base64: string, mimeType: string): Uint8Array | null {
  if (base64.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return null;

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || !hasImageMagicBytes(bytes, mimeType)) return null;
  return bytes;
}

/**
 * OCR 라우트(api/ocr) 가드. 검증 프리앰블을 라우트 핸들러에서 분리해 둔다.
 *
 * 가드 순서: method → 입력(존재·MIME·크기) → rate limit → 인증.
 * 저렴한 검증을 먼저 두어 키 없이도 입력 거부가 동작하고, 남용은 모델 호출 전에 막는다.
 * Rate limit은 로컬/테스트에서만 Upstash env 미설정 시 통과한다. Production에서는
 * provider 비용 보호 경계이므로 fail-closed.
 *
 * 통과 시 정제된 `{ base64, mimeType }`를 반환하고, 실패 시 res에 status + { error }를
 * 쓰고 null을 반환한다. **절대 throw하지 않는다** (CLAUDE.md 규칙). 호출부는
 * `const v = await validateOcrRequest(req, res); if (!v) return;` 패턴.
 */
export async function validateOcrRequest(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{ base64: string; mimeType: string } | null> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }

  const body = req.body as { image?: unknown; mimeType?: unknown } | undefined;
  const image = typeof body?.image === 'string' ? body.image : '';
  if (!image) {
    res.status(400).json({ error: 'image (base64) is required' });
    return null;
  }

  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : 'image/jpeg';
  if (!ALLOWED_MIME.has(mimeType)) {
    res.status(415).json({ error: 'Unsupported image type' });
    return null;
  }

  // data URL prefix가 붙어와도 방어적으로 제거 — AI SDK엔 순수 base64를 넘긴다.
  const base64 = image.replace(/^data:[^;]+;base64,/, '');

  const decoded = decodeAllowedImage(base64, mimeType);
  if (!decoded) {
    res.status(400).json({ error: 'Invalid image payload' });
    return null;
  }

  if (decoded.length > MAX_BYTES) {
    res.status(413).json({ error: 'Image too large (max 10MB)' });
    return null;
  }

  // Rate limit: per-IP(10/시간·20/일) + shared(키 전체 12/분·450/일) 4겹. shared는 Google
  // free tier 한도가 API 키 단위라서 필요하다(#299). Production env 누락은 503으로 닫는다.
  const rl = await checkOcrRateLimit(clientIp(req));
  if (!rl.ok) {
    if (rl.reason === 'misconfigured') {
      res.status(503).json({ error: 'Rate limit is not configured' });
      return null;
    }
    res.setHeader('Retry-After', String(rl.retryAfterSec ?? 60));
    res.status(429).json({ error: 'Too many requests' });
    return null;
  }

  // 인증 가드: 입력·rate 검증을 통과한 뒤, 모델 호출 직전에 확인한다. OCR은 Google AI Studio
  // 직결이라(#125) 필요한 건 이 키 하나 — Gateway/OIDC 폴백은 없다.
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    res.status(500).json({ error: 'Google AI is not configured' });
    return null;
  }

  return { base64, mimeType };
}
