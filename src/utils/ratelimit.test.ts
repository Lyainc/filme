import { afterEach, describe, expect, it } from 'bun:test';
import {
  checkKobisRateLimit,
  checkOcrRateLimit,
  checkTicketRateLimit,
  resetRateLimitCacheForTests,
} from './ratelimit';

const originalNodeEnv = process.env.NODE_ENV;
const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

function clearUpstashEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  resetRateLimitCacheForTests();
}

afterEach(() => {
  setNodeEnv(originalNodeEnv);
  if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  resetRateLimitCacheForTests();
});

describe('provider API rate limits', () => {
  // failMode 분기는 Upstash 미설정(limiter=null) 경로에서만 갈린다. env가 설정된 경로는
  // 실제 Redis 호출이라 failMode와 무관(두 scope 모두 limiter를 그대로 거침)하므로
  // 여기선 다루지 않는다. 매트릭스: production×dev × scope(ocr/kobis), env 미설정.

  it('fails closed for OCR in production when Upstash is missing (실과금 보호)', async () => {
    setNodeEnv('production');
    clearUpstashEnv();

    const result = await checkOcrRateLimit('203.0.113.10');

    expect(result).toEqual({ ok: false, reason: 'misconfigured' });
  });

  it('fails open for KOBIS in production when Upstash is missing (#112 가용성 우선)', async () => {
    setNodeEnv('production');
    clearUpstashEnv();

    const result = await checkKobisRateLimit('203.0.113.10');

    expect(result).toEqual({ ok: true });
  });

  it('fails closed for TICKET in production when Upstash is missing (Blob 쓰기 보호)', async () => {
    setNodeEnv('production');
    clearUpstashEnv();

    const result = await checkTicketRateLimit('203.0.113.10');

    expect(result).toEqual({ ok: false, reason: 'misconfigured' });
  });

  it('allows all scopes in local development without Upstash', async () => {
    setNodeEnv('test');
    clearUpstashEnv();

    await expect(checkOcrRateLimit('127.0.0.1')).resolves.toEqual({ ok: true });
    await expect(checkKobisRateLimit('127.0.0.1')).resolves.toEqual({ ok: true });
    await expect(checkTicketRateLimit('127.0.0.1')).resolves.toEqual({ ok: true });
  });
});
