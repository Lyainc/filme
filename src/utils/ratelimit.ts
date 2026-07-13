import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Public provider-backed API rate limiter.
 *
 * Upstash Redis env(URL + TOKEN)가 둘 다 설정됐을 때만 distributed limiter를 만든다.
 * 로컬/테스트(NODE_ENV!=='production')에서는 env 미설정 시 통과한다.
 * production에서 env 미설정 시 동작은 scope의 failMode가 가른다(#112):
 *  - OCR(fail-closed): GPT vision이 실과금이라 비용 보호가 보안 경계 → 차단(misconfigured).
 *  - KOBIS(fail-open): 무료 quota(일 3000) 오픈API라 남용돼도 과금이 없어, limiter 백엔드
 *    장애로 핵심 검색이 다운되는 가용성 리스크가 더 크다 → 통과.
 *  - TICKET(fail-closed): Blob 쓰기는 저장 용량·대역폭 과금이라, limiter 부재 시 무제한
 *    업로드를 허용하면 스토리지 남용을 막을 수 없다 → 차단(#91).
 */
export interface RateLimitResult {
  ok: boolean;
  /** 429 응답의 Retry-After(초). ok=false일 때만 의미가 있다. */
  retryAfterSec?: number;
  reason?: 'limited' | 'misconfigured';
}

type LimitWindow = {
  name: string;
  limit: number;
  window: `${number} ${'m' | 'h' | 'd'}`;
  /**
   * true면 IP가 아니라 고정 키로 센다 — 즉 이 배포 전체의 총량 상한이다.
   * 벤더 한도가 API 키(=프로젝트) 단위인 경우, IP별 카운터만으로는 소진을 원리적으로 못 막는다.
   */
  shared?: boolean;
};

type LimitPolicy = {
  scope: 'ocr' | 'kobis' | 'ticket';
  /** Upstash 미설정 시 production 동작: 'closed'=차단(misconfigured), 'open'=통과(fail-open). */
  failMode: 'closed' | 'open';
  windows: LimitWindow[];
};

type LimitersCache = {
  key: string;
  limiters: Array<{ limiter: Ratelimit; name: string; shared?: boolean }>;
};

let cache: LimitersCache | null = null;

function createLimiters(policy: LimitPolicy): LimitersCache | null {
  // Vercel Marketplace의 "Upstash for Redis"(slug upstash-kv)는 연결 환경에 따라
  // UPSTASH_REDIS_REST_* 또는 KV_REST_API_*(레거시 Vercel KV 호환)를 주입한다.
  // @upstash/redis의 Redis.fromEnv()와 동일하게 둘 다 받아 어느 이름이든 동작시킨다.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  const key = `${policy.scope}:${url}:${token}`;
  if (cache?.key === key) return cache;

  const redis = new Redis({ url, token });
  cache = {
    key,
    limiters: policy.windows.map((w) => ({
      name: w.name,
      shared: w.shared,
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
    // dev/test는 항상 통과. production에서만 scope의 failMode가 가른다(#112).
    const failClosed = process.env.NODE_ENV === 'production' && policy.failMode === 'closed';
    return failClosed ? { ok: false, reason: 'misconfigured' } : { ok: true };
  }

  // 순서는 (1) per-IP 먼저, (2) 그 안에서 짧은 윈도우 먼저다. 이미 차단될 요청은 더 긴
  // 윈도우 카운터를 소진하지 않고, per-IP에서 막힌 요청은 애초에 벤더를 안 부르므로
  // shared(총량) 카운터도 소진하면 안 된다 — 그러면 실제보다 빨리 총량을 닫아버린다.
  for (const { limiter, shared } of configured.limiters) {
    const result = await limiter.limit(shared ? 'global' : ip);
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

/**
 * OCR은 Google AI Studio free tier 직결이고, 그 한도는 **API 키(프로젝트) 단위**다 —
 * gemini-3.1-flash-lite 기준 15 RPM · 500 RPD (2026-07-13 실측: 429 QuotaFailure의
 * quotaId `GenerateRequestsPerMinutePerProjectPerModel-FreeTier`, quotaValue 15).
 * IP별 카운터만으로는 이 총량을 못 막는다 — IP 10개가 각자 하루치를 쓰면 키가 소진되고,
 * IP 둘이 동시에 버스트하면 1분에 15를 넘겨 Google이 429를 뱉는다(우리는 재시도하지
 * 않으므로 그대로 502 실패로 유저에게 나간다). 그래서 shared 윈도우로 키 총량을 우리가
 * 먼저 막고, 초과분은 502가 아니라 429 + Retry-After로 돌려보낸다.
 * 여유분은 분당 -20%(15→12), 일당 -10%(500→450) — 우리 sliding window와 Google의 카운팅이
 * 정확히 같은 경계를 쓰지 않으므로 그 오차만큼 비워둔다. 분당을 더 크게 비운 건 15가 작은
 * 수라 같은 비율이어도 경계 오차 한두 건이 곧바로 벤더 429가 되기 때문이다.
 * Tier 1(4K RPM · 150K RPD)으로 올릴 계획이 생기면 shared 수치를 함께 올릴 것(#299).
 */
export async function checkOcrRateLimit(ip: string): Promise<RateLimitResult> {
  return checkConfiguredRateLimit(ip, {
    scope: 'ocr',
    failMode: 'closed',
    windows: [
      { name: 'hr', limit: 10, window: '1 h' },
      // 한 IP가 키 하루치(450)의 5% 이상을 못 먹게 한다. 50이면 IP 9개로 전부 소진됐다.
      { name: 'day', limit: 20, window: '1 d' },
      { name: 'global-min', limit: 12, window: '1 m', shared: true },
      { name: 'global-day', limit: 450, window: '1 d', shared: true },
    ],
  });
}

export async function checkKobisRateLimit(ip: string): Promise<RateLimitResult> {
  return checkConfiguredRateLimit(ip, {
    scope: 'kobis',
    failMode: 'open',
    windows: [
      { name: 'min', limit: 30, window: '1 m' },
      { name: 'day', limit: 1000, window: '1 d' },
    ],
  });
}

export async function checkTicketRateLimit(ip: string): Promise<RateLimitResult> {
  return checkConfiguredRateLimit(ip, {
    scope: 'ticket',
    failMode: 'closed',
    windows: [
      // 버스트 차단: 사람은 60초에 완성 티켓 5개를 못 만든다(매번 편집이 필요). 스크립트 플러딩은
      // 가장 짧은 윈도우에서 먼저 막혀 더 긴 카운터·Upstash command를 아끼고 Blob 쓰기 비용도 막는다.
      { name: 'min', limit: 5, window: '1 m' },
      { name: 'hr', limit: 20, window: '1 h' },
      // 슬로우드립 남용 상한. 100→60으로 좁혀도 하루 60개는 어떤 실사용보다 넉넉하다.
      { name: 'day', limit: 60, window: '1 d' },
    ],
  });
}
