import { NextRequest, NextResponse } from 'next/server';

// IP별 슬라이딩 윈도우 카운터.
// Edge isolate 내에서만 유지 — cold start 시 리셋됨.
// 고트래픽 환경이라면 @upstash/ratelimit + @upstash/redis 로 교체.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

const ipMap = new Map<string, { n: number; reset: number }>();
// 마지막 정리 시각 — 만료 엔트리 sweep을 윈도우당 최대 1회로 제한한다.
let lastSweep = 0;

export function middleware(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const now = Date.now();

  // 만료 엔트리 정리 — eviction이 없으면 IP sweep 시 ipMap이 무한 증가한다.
  // 윈도우당 1회만 돌아 O(n)을 분할상환한다.
  if (now - lastSweep > WINDOW_MS) {
    ipMap.forEach((s, key) => {
      if (now > s.reset) ipMap.delete(key);
    });
    lastSweep = now;
  }

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
