import { beforeEach, describe, expect, it, mock } from 'bun:test';

/**
 * OCR shared(키 전체) 윈도우 회귀 테스트.
 *
 * Upstash를 실제로 부르지 않고, 각 윈도우가 **어떤 식별자로** 카운트되는지와 **어떤 순서로**
 * 체크되는지만 관찰한다. 이 둘이 이 설계의 전부다 — shared 윈도우가 IP로 세면 키 총량 상한이
 * 사라지고(벤더 429→502), per-IP보다 먼저 세면 IP에서 막힐 요청까지 총량을 갉아먹는다.
 *
 * mock.module은 hoisting되지 않으므로 등록 후 require로 대상을 가져온다(CLAUDE.md).
 */
const calls: Array<{ prefix: string; id: string }> = [];
/** 여기 담긴 prefix의 윈도우는 한도 초과(success:false)로 응답한다. */
const exhausted = new Set<string>();

mock.module('@upstash/redis', () => ({ Redis: class {} }));
mock.module('@upstash/ratelimit', () => ({
  Ratelimit: class {
    prefix: string;
    constructor(opts: { prefix: string }) {
      this.prefix = opts.prefix;
    }
    static slidingWindow(limit: number, window: string) {
      return { limit, window };
    }
    async limit(id: string) {
      calls.push({ prefix: this.prefix, id });
      return { success: !exhausted.has(this.prefix), reset: Date.now() + 60_000 };
    }
  },
}));

process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkOcrRateLimit, resetRateLimitCacheForTests } = require('./ratelimit');

describe('OCR shared(키 전체) rate limit 윈도우', () => {
  beforeEach(() => {
    resetRateLimitCacheForTests();
    calls.length = 0;
    exhausted.clear();
  });

  it('per-IP 윈도우를 먼저 IP로 세고, 그다음 shared 윈도우를 고정 키로 센다', async () => {
    await checkOcrRateLimit('203.0.113.10');

    expect(calls).toEqual([
      { prefix: 'ocr:hr', id: '203.0.113.10' },
      { prefix: 'ocr:day', id: '203.0.113.10' },
      { prefix: 'ocr:global-min', id: 'global' },
      { prefix: 'ocr:global-day', id: 'global' },
    ]);
  });

  it('다른 IP도 같은 shared 카운터를 공유한다 (키 총량이 실제로 합산된다)', async () => {
    await checkOcrRateLimit('203.0.113.10');
    await checkOcrRateLimit('198.51.100.7');

    const sharedIds = calls.filter((c) => c.prefix.startsWith('ocr:global')).map((c) => c.id);
    expect(sharedIds).toEqual(['global', 'global', 'global', 'global']);
  });

  it('per-IP에서 막힌 요청은 shared 카운터를 갉지 않는다 (이 순서의 존재 이유)', async () => {
    exhausted.add('ocr:hr');

    const result = await checkOcrRateLimit('203.0.113.10');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('limited');
    // per-IP에서 막힌 요청은 애초에 Google을 안 부른다. 그런데도 shared를 갉으면 쓰지도 않은
    // 벤더 quota를 소진한 것으로 세서, 실제보다 빨리 총량이 닫힌다.
    expect(calls.filter((c) => c.prefix.startsWith('ocr:global'))).toEqual([]);
  });

  it('shared 한도 초과는 429로 나간다 (벤더 429→502가 아니라)', async () => {
    exhausted.add('ocr:global-min');

    const result = await checkOcrRateLimit('203.0.113.10');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('limited');
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });
});
