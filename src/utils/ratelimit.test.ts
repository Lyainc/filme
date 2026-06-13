import { afterEach, describe, expect, it } from 'bun:test';
import { checkKobisRateLimit, checkOcrRateLimit, resetRateLimitCacheForTests } from './ratelimit';

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
  it('fails closed for OCR in production when Upstash is missing', async () => {
    setNodeEnv('production');
    clearUpstashEnv();

    const result = await checkOcrRateLimit('203.0.113.10');

    expect(result).toEqual({ ok: false, reason: 'misconfigured' });
  });

  it('fails closed for KOBIS in production when Upstash is missing', async () => {
    setNodeEnv('production');
    clearUpstashEnv();

    const result = await checkKobisRateLimit('203.0.113.10');

    expect(result).toEqual({ ok: false, reason: 'misconfigured' });
  });

  it('allows local development without Upstash', async () => {
    setNodeEnv('test');
    clearUpstashEnv();

    await expect(checkOcrRateLimit('127.0.0.1')).resolves.toEqual({ ok: true });
    await expect(checkKobisRateLimit('127.0.0.1')).resolves.toEqual({ ok: true });
  });
});
