import type { NextApiRequest, NextApiResponse } from 'next';

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

  const query = encodeURIComponent(movieNm);
  const url = `https://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${apiKey}&movieNm=${query}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`KOBIS API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    console.error('KOBIS API Error:', error);
    res.status(500).json({ error: 'Failed to fetch movie data' });
  }
}
