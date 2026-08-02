import type { NextApiRequest, NextApiResponse } from 'next';
import { checkTmdbRateLimit } from '@/utils/ratelimit';
import { clientIp } from '@/utils/ocrRoute';

const TMDB_ID_RE = /^\d+$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string' || !TMDB_ID_RE.test(id)) {
    return res.status(400).json({ error: 'id is required' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TMDB API Key is not configured' });
  }

  const rl = await checkTmdbRateLimit(clientIp(req));
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSec ?? 60));
    return res.status(429).json({ error: 'Too many requests' });
  }

  // language를 안 걸어 판본(posters) 전체를 받는다 — c6이 "국내 개봉작은 대표 포스터가
  // 해외판인 경우가 흔해 판본 고르기가 기본 동선"이라고 명시했다.
  const url = `https://api.themoviedb.org/3/movie/${id}/images?api_key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).replaceAll(apiKey, '***');
    console.error('TMDB images API Error:', message);
    res.status(500).json({ error: 'Failed to fetch movie images' });
  }
}
