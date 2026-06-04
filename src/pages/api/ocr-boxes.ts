import type { NextApiRequest, NextApiResponse } from 'next';
import { generateObject } from 'ai';
import { z } from 'zod';
import { checkRateLimit } from '@/utils/ratelimit';

export const config = {
  api: { bodyParser: { sizeLimit: '15mb' } },
};

const BoxSchema = z.object({
  x: z.number().nullable(),
  y: z.number().nullable(),
  w: z.number().nullable(),
  h: z.number().nullable(),
});

const ItemSchema = z.object({
  text: z.string().nullable(),
  field: z.enum(['theater', 'screen', 'watchDate', 'watchTime', 'seat', 'bookingNumber', 'title']).nullable(),
  box: BoxSchema.nullable(),
});

const TicketBoxesSchema = z.object({
  items: z.array(ItemSchema).nullable(),
});

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function buildSystemPrompt(year: number): string {
  return `당신은 한국 영화관 예매 티켓/스크린샷에서 정보를 추출하는 OCR 어시스턴트입니다.
이미지를 분석해 텍스트 조각(칩)들을 추출하고, 각각의 텍스트와 분류(field), 박스(box) 좌표를 반환하세요.
좌표계는 주어진 이미지 픽셀 기준입니다 (x, y는 좌상단, w는 너비, h는 높이).

field 분류 기준:
- title: 영화 제목. 한글 제목을 우선하고 부가정보는 제거하세요.
- theater: 극장 지점명만. 체인명은 빼고 지점만.
- screen: 상영관.
- watchDate: 관람 날짜를 YYYY-MM-DD 형식으로. 연도가 티켓에 없으면 ${year}년으로 간주하세요.
- watchTime: 관람 시작 시각을 HH:MM 24시간 형식으로.
- seat: 좌석. 여러 개면 콤마로 구분.
- bookingNumber: 예매번호 또는 판매번호.

분류할 수 없거나 확실하지 않은 텍스트는 field를 null로 설정하세요. 모든 속성은 null을 허용하며 절대 생략하지 마세요.`;
}

function clientIp(req: NextApiRequest): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length > 0) return xff[0];
  return req.socket.remoteAddress ?? 'unknown';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body as { image?: unknown; mimeType?: unknown } | undefined;
  const image = typeof body?.image === 'string' ? body.image : '';
  if (!image) {
    return res.status(400).json({ error: 'image (base64) is required' });
  }

  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : 'image/jpeg';
  if (!ALLOWED_MIME.has(mimeType)) {
    return res.status(415).json({ error: 'Unsupported image type' });
  }

  const base64 = image.replace(/^data:[^;]+;base64,/, '');

  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > MAX_BYTES) {
    return res.status(413).json({ error: 'Image too large (max 10MB)' });
  }

  const rl = await checkRateLimit(clientIp(req));
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfterSec ?? 60));
    return res.status(429).json({ error: 'Too many requests' });
  }

  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return res.status(500).json({ error: 'AI Gateway is not configured' });
  }

  try {
    const { object } = await generateObject({
      model: 'openai/gpt-4o-mini',
      schema: TicketBoxesSchema,
      system: buildSystemPrompt(new Date().getFullYear()),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '이 영화 티켓에서 텍스트 칩과 좌표를 추출해줘.' },
            { type: 'file', mediaType: mimeType, data: base64 },
          ],
        },
      ],
    });

    const items = (object.items || []).map((item) => ({
      text: item.text || '',
      field: item.field || null,
      box: item.box
        ? {
            x: Math.round(Math.max(0, item.box.x || 0)),
            y: Math.round(Math.max(0, item.box.y || 0)),
            w: Math.round(Math.max(0, item.box.w || 0)),
            h: Math.round(Math.max(0, item.box.h || 0)),
          }
        : null,
    }));

    return res.status(200).json({ items });
  } catch (err) {
    console.error('[api/ocr-boxes] generateObject failed:', err);
    return res.status(502).json({ error: 'OCR extraction failed' });
  }
}
