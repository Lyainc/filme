import { afterAll, afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { NextApiRequest, NextApiResponse } from 'next';

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
let failure: 'constructor' | 'network' | 'timeout' | undefined;
/** SDK 예외 메시지에 섞여 들어올 수 있는 값 — 로그에 그대로 남으면 안 된다(#783). */
const SECRET_URL = 'https://fake.upstash.io';
const SECRET_TOKEN = 'fake-token';
const originalEnv = { ...process.env };
afterEach(() => {
  mock.restore();
  for (const key of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

// 스프레드 스냅샷 + afterAll 복원(#611·#618) — `require()`가 주는 건 살아있는 네임스페이스라
// mock.module이 그 객체를 제자리에서 갈아끼운다. 복사본으로 떠 둬야 복원이 진짜 복원이 된다.
// 이 파일은 `__tests__/` 밖에 있지만 bun test가 똑같이 집어가고 누수도 똑같이 전역이다 — 안
// 되돌리면 두 스텁이 프로세스 끝까지 남아, 같은 모듈을 쓰는 ratelimit.test.ts가 실제 Upstash
// 클라이언트 대신 여기 정의된 가짜 Ratelimit(calls 배열에 기록하는)을 받는다.
const realRedis = { ...require('@upstash/redis') };
const realRatelimit = { ...require('@upstash/ratelimit') };
afterAll(() => {
  mock.module('@upstash/redis', () => realRedis);
  mock.module('@upstash/ratelimit', () => realRatelimit);
});

mock.module('@upstash/redis', () => ({ Redis: class {
  constructor() {
    if (failure === 'constructor') throw new Error(`Invalid Redis URL ${SECRET_URL}?token=${SECRET_TOKEN}`);
  }
} }));
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
      if (failure === 'network') throw new TypeError(`fetch failed: ${SECRET_URL} (${SECRET_TOKEN})`);
      if (failure === 'timeout') return { success: true, reason: 'timeout', reset: 0 };
      return { success: !exhausted.has(this.prefix), reset: Date.now() + 60_000 };
    }
  },
}));

const { checkOcrRateLimit, checkTicketRateLimit, checkKobisRateLimit, resetRateLimitCacheForTests } = require('./ratelimit');
const ocrHandler = require('@/pages/api/ocr').default;
const ticketHandler = require('@/pages/api/ticket').default;

describe('OCR shared(키 전체) rate limit 윈도우', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = SECRET_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = SECRET_TOKEN;
    failure = undefined;
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

  for (const mode of ['constructor', 'network', 'timeout'] as const) {
    it(`${mode}: OCR/공유는 차단하고 KOBIS는 기존 가용성 정책을 유지한다`, async () => {
      failure = mode;
      spyOn(console, 'error').mockImplementation(() => {});
      expect(await checkOcrRateLimit('203.0.113.10')).toEqual({ ok: false, reason: 'unavailable' });
      expect(await checkTicketRateLimit('203.0.113.10')).toEqual({ ok: false, reason: 'unavailable' });
      expect(await checkKobisRateLimit('203.0.113.10')).toEqual({ ok: true });
    });

    it(`${mode}: 로그에는 오류 종류만 남고 원본 예외 메시지(URL·토큰)는 남지 않는다`, async () => {
      failure = mode;
      const error = spyOn(console, 'error').mockImplementation(() => {});
      await checkOcrRateLimit('203.0.113.10');
      expect(error).toHaveBeenCalled();
      const logged = error.mock.calls.flat().map(String).join('\n');
      expect(logged.includes(SECRET_URL)).toBe(false);
      expect(logged.includes(SECRET_TOKEN)).toBe(false);
      expect(logged).toContain(mode === 'network' ? '(TypeError)' : '(Error)');
    });

    it(`${mode}: 실제 OCR/공유 핸들러는 외부 호출 없이 JSON 503을 반환한다`, async () => {
      failure = mode;
      spyOn(console, 'error').mockImplementation(() => {});
      const outbound = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external request'));
      for (const handler of [ocrHandler, ticketHandler]) {
        const status = mock(() => res);
        const json = mock(() => res);
        const setHeader = mock(() => res);
        const res = { status, json, setHeader } as unknown as NextApiResponse;
        const req = {
          method: 'POST', headers: {}, socket: { remoteAddress: '203.0.113.10' },
          body: { image: '/9j/', mimeType: 'image/jpeg' },
        } as NextApiRequest;
        await handler(req, res);
        expect(status).toHaveBeenCalledWith(503);
        expect(json).toHaveBeenCalledWith({ error: 'Rate limit is unavailable' });
        expect(setHeader).not.toHaveBeenCalled();
      }
      expect(outbound).not.toHaveBeenCalled();
    });
  }

});
