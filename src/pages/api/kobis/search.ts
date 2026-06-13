import type { NextApiRequest, NextApiResponse } from 'next';
import { checkKobisRateLimit } from '@/utils/ratelimit';
import { clientIp } from '@/utils/ocrRoute';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { movieNm } = req.query;

  if (!movieNm || typeof movieNm !== 'string') {
    return res.status(400).json({ error: 'movieNm is required' });
  }
  if (movieNm.length > 100) {
    return res.status(400).json({ error: 'movieNm too long' });
  }

  const apiKey = process.env.KOBIS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'KOBIS API Key is not configured' });
  }

  const rl = await checkKobisRateLimit(clientIp(req));
  if (!rl.ok) {
    if (rl.reason === 'misconfigured') {
      return res.status(503).json({ error: 'Rate limit is not configured' });
    }
    res.setHeader('Retry-After', String(rl.retryAfterSec ?? 60));
    return res.status(429).json({ error: 'Too many requests' });
  }

  const url = `https://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${apiKey}&movieNm=${encodeURIComponent(movieNm)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`KOBIS API responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
    res.status(200).json(data);
  } catch (error) {
    // fetch 실패 시 에러 message/stack에 요청 URL(=key 포함)이 섞일 수 있어 마스킹 후 로깅
    const message = (error instanceof Error ? error.message : String(error)).replaceAll(apiKey, '***');
    console.error('KOBIS API Error:', message);
    res.status(500).json({ error: 'Failed to fetch movie data' });
  }
}
