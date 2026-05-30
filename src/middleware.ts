import { NextRequest, NextResponse } from 'next/server';

// IP별 슬라이딩 윈도우 카운터.
// Edge isolate 내에서만 유지 — cold start 시 리셋됨.
// 고트래픽 환경이라면 @upstash/ratelimit + @upstash/redis 로 교체.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

const ipMap = new Map<string, { n: number; reset: number }>();

export function middleware(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const now = Date.now();

  let slot = ipMap.get(ip);
  if (!slot || now > slot.reset) {
    ipMap.set(ip, { n: 1, reset: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (slot.n >= MAX_PER_WINDOW) {
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((slot.reset - now) / 1000)),
      },
    });
  }

  slot.n++;
  return NextResponse.next();
}

export const config = {
  matcher: '/api/kobis/:path*',
};
