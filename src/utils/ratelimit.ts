import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * OCR API용 IP rate limiter.
 *
 * Upstash Redis env(URL + TOKEN)가 둘 다 설정됐을 때만 limiter를 만든다. 미설정이면
 * null로 고정되고 checkRateLimit이 항상 통과시킨다(graceful skip) — 로컬 dev에서
 * Upstash 없이도 OCR이 막히지 않게 하기 위함. 이 skip이 없으면 env 누락이 곧
 * 로컬 OCR 전체 차단으로 보여 회귀로 오인된다.
 *
 * 두 sliding window를 동시에 적용한다: 시간당 10회, 일당 50회. 둘 중 하나라도
 * 초과하면 차단한다.
 */
function createLimiters() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  return {
    hourly: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h'), prefix: 'ocr:hr' }),
    daily: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(50, '1 d'), prefix: 'ocr:day' }),
  };
}

// 모듈 1회 초기화(싱글톤). env가 없으면 null로 고정된다.
const limiters = createLimiters();

export interface RateLimitResult {
  ok: boolean;
  /** 429 응답의 Retry-After(초). ok=false일 때만 의미가 있다. */
  retryAfterSec?: number;
}

/**
 * IP 단위 rate limit 체크. limiter가 없으면(env 미설정) 항상 통과시킨다.
 * 시간당/일당 윈도우를 모두 보고, 막혔으면 더 늦게 풀리는 reset까지의 초를 돌려준다.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  if (!limiters) return { ok: true };

  // 시간당 윈도우를 먼저 순차로 본다. 여기서 막히면 daily.limit()을 호출하지 않아,
  // 이미 차단될 요청이 일일 카운터를 불필요하게 소진하지 않는다(Promise.all 동시 호출의 부작용 제거).
  const hr = await limiters.hourly.limit(ip);
  if (!hr.success) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((hr.reset - Date.now()) / 1000)) };
  }

  const day = await limiters.daily.limit(ip);
  if (!day.success) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((day.reset - Date.now()) / 1000)) };
  }

  return { ok: true };
}
