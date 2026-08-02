import type { NextApiRequest, NextApiResponse } from 'next';
import { checkTmdbRateLimit } from '@/utils/ratelimit';
import { clientIp } from '@/utils/ocrRoute';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required' });
  }
  if (query.length > 100) {
    return res.status(400).json({ error: 'query too long' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TMDB API Key is not configured' });
  }

  // TMDB는 fail-open(#537 c5) — KOBIS와 같은 무료 quota 성격, limiter 백엔드 장애로 검색이
  // 다운되는 가용성 리스크가 남용 방어보다 크다.
  const rl = await checkTmdbRateLimit(clientIp(req));
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSec ?? 60));
    return res.status(429).json({ error: 'Too many requests' });
  }

  const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=ko-KR&query=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (error) {
    // fetch 실패 시 에러 message에 요청 URL(=key 포함)이 섞일 수 있어 마스킹 후 로깅(c2).
    const message = (error instanceof Error ? error.message : String(error)).replaceAll(apiKey, '***');
    console.error('TMDB search API Error:', message);
    res.status(500).json({ error: 'Failed to fetch movie data' });
  }
}
