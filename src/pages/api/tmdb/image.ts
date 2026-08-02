import type { NextApiRequest, NextApiResponse } from 'next';
import { checkTmdbImageRateLimit } from '@/utils/ratelimit';
import { clientIp } from '@/utils/ocrRoute';

// TMDB CDN 경로는 항상 '/' + 영숫자 파일명 + 확장자다. 검증 없이 그대로 fetch에 이어 붙이면
// 이 라우트가 임의 URL을 대신 받아오는 오픈 프록시(SSRF)가 된다 — 요청 오리진과 무관하게
// image.tmdb.org 하위 경로만 허용한다.
const TMDB_IMAGE_PATH_RE = /^\/[A-Za-z0-9]+\.(jpg|jpeg|png)$/;
const ALLOWED_SIZES = new Set(['w342', 'original']); // c4: 그리드 썸네일 w342, 실제 적용 original.

export const config = {
  api: { responseLimit: false },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { path, size } = req.query;

  if (!path || typeof path !== 'string' || !TMDB_IMAGE_PATH_RE.test(path)) {
    return res.status(400).json({ error: 'invalid path' });
  }
  const imgSize = typeof size === 'string' && ALLOWED_SIZES.has(size) ? size : 'original';

  // fail-closed(ratelimit.ts) — production에서 limiter 미설정이면 대역폭 남용을 막기 위해 503.
  const rl = await checkTmdbImageRateLimit(clientIp(req));
  if (!rl.ok) {
    if (rl.reason === 'misconfigured') {
      return res.status(503).json({ error: 'Rate limit is not configured' });
    }
    res.setHeader('Retry-After', String(rl.retryAfterSec ?? 60));
    return res.status(429).json({ error: 'Too many requests' });
  }

  const url = `https://image.tmdb.org/t/p/${imgSize}${path}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB image CDN responded with status: ${response.status}`);
    }

    const buf = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'image/jpeg');
    // TMDB 이미지 경로는 콘텐츠 해시 기반이라 같은 path+size는 항상 같은 바이트다 — 공격적으로
    // 캐시해도 안전하다(열린 질문 3의 캐시 정책 판단; 대역폭 비용 자체는 남는다).
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600, immutable');
    res.status(200).send(buf);
  } catch (error) {
    console.error('TMDB image proxy error:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to fetch image' });
  }
}
