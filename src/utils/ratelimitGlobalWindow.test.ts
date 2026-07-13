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
      return { success: true, reset: 0 };
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
});
