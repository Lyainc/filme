import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Public provider-backed API rate limiter.
 *
 * Upstash Redis env(URL + TOKEN)가 둘 다 설정됐을 때만 distributed limiter를 만든다.
 * 로컬/테스트에서는 env 미설정 시 통과시키지만, production에서는 provider API 비용
 * 보호가 보안 경계이므로 fail-closed 한다.
 */
export interface RateLimitResult {
  ok: boolean;
  /** 429 응답의 Retry-After(초). ok=false일 때만 의미가 있다. */
  retryAfterSec?: number;
  reason?: 'limited' | 'misconfigured';
}

type LimitPolicy = {
  scope: 'ocr' | 'kobis';
  windows: Array<{ name: string; limit: number; window: `${number} ${'m' | 'h' | 'd'}` }>;
};

type LimitersCache = {
  key: string;
  limiters: Array<{ limiter: Ratelimit; name: string }>;
};

let cache: LimitersCache | null = null;

function createLimiters(policy: LimitPolicy): LimitersCache | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const key = `${policy.scope}:${url}:${token}`;
  if (cache?.key === key) return cache;

  const redis = new Redis({ url, token });
  cache = {
    key,
    limiters: policy.windows.map((w) => ({
      name: w.name,
      limiter: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(w.limit, w.window),
        prefix: `${policy.scope}:${w.name}`,
      }),
    })),
  };
  return cache;
}

async function checkConfiguredRateLimit(ip: string, policy: LimitPolicy): Promise<RateLimitResult> {
  const configured = createLimiters(policy);
  if (!configured) {
    return process.env.NODE_ENV === 'production'
      ? { ok: false, reason: 'misconfigured' }
      : { ok: true };
  }

  // 가장 짧은 윈도우부터 순차 체크한다. 이미 차단될 요청은 더 긴 윈도우 카운터를
  // 불필요하게 소진하지 않는다.
  for (const { limiter } of configured.limiters) {
    const result = await limiter.limit(ip);
    if (!result.success) {
      return {
        ok: false,
        reason: 'limited',
        retryAfterSec: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    }
  }

  return { ok: true };
}

export function resetRateLimitCacheForTests(): void {
  cache = null;
}

export async function checkOcrRateLimit(ip: string): Promise<RateLimitResult> {
  return checkConfiguredRateLimit(ip, {
    scope: 'ocr',
    windows: [
      { name: 'hr', limit: 10, window: '1 h' },
      { name: 'day', limit: 50, window: '1 d' },
    ],
  });
}

export async function checkKobisRateLimit(ip: string): Promise<RateLimitResult> {
  return checkConfiguredRateLimit(ip, {
    scope: 'kobis',
    windows: [
      { name: 'min', limit: 30, window: '1 m' },
      { name: 'day', limit: 1000, window: '1 d' },
    ],
  });
}
