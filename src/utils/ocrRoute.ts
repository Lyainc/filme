import type { NextApiRequest, NextApiResponse } from 'next';
import { checkRateLimit } from '@/utils/ratelimit';
import { ALLOWED_MIME, MAX_BYTES } from '@/utils/ocrConstants';

/** 클라이언트 IP — Vercel은 x-forwarded-for를 설정한다. 로컬 dev는 소켓 주소로 폴백. */
export function clientIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * OCR 라우트 공통 가드. ocr.ts / ocr-boxes.ts가 스키마·프롬프트만 다르고 검증
 * 프리앰블이 동일하므로 한 곳으로 추출한다.
 *
 * 가드 순서: method → 입력(존재·MIME·크기) → rate limit → 인증.
 * 저렴한 검증을 먼저 두어 키 없이도 입력 거부가 동작하고, 남용은 모델 호출 전에 막는다.
 * Rate limit은 Upstash env 미설정 시 checkRateLimit 내부에서 graceful skip.
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

  // 크기 제한: base64 디코드 크기 ≈ 문자열 길이 × 3/4.
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    res.status(413).json({ error: 'Image too large (max 10MB)' });
    return null;
  }

  // Rate limit: IP sliding window(시간당 10·일당 50). Upstash env 미설정 시 skip.
  const rl = await checkRateLimit(clientIp(req));
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSec ?? 60));
    res.status(429).json({ error: 'Too many requests' });
    return null;
  }

  // Gateway 인증 가드: 입력·rate 검증을 통과한 뒤, 모델 호출 직전에 확인한다.
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    res.status(500).json({ error: 'AI Gateway is not configured' });
    return null;
  }

  return { base64, mimeType };
}
