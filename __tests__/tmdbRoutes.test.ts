/**
 * #638 후속 — TMDB API 라우트(search/images/image)를 실제 핸들러 함수로 직접 호출하는 테스트.
 * ratelimit.ts 유닛 테스트와 달리 여기는 라우트 자체의 가드 순서·응답 코드를 증명한다.
 *
 * 커버 대상(P1):
 *  - image.ts의 TMDB_IMAGE_PATH_RE — CDN 하위 경로가 아닌 값(SSRF 시도)은 400으로 거부.
 *  - image.ts의 size 화이트리스트 — w342/original 외 값은 original로 폴백해 fetch한다.
 *  - checkTmdbImageRateLimit의 fail-closed — production + Upstash 미설정이면 503.
 *
 * NODE_ENV!=='production'이면 ratelimit.ts가 Upstash 미설정 시 항상 통과하므로(로컬/테스트 기본
 * 동작), 위 fail-closed 케이스를 뺀 나머지 테스트는 rate limit을 별도로 mock할 필요가 없다.
 */
import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { NextApiRequest, NextApiResponse } from 'next';
import { resetRateLimitCacheForTests } from '@/utils/ratelimit';
import searchHandler from '@/pages/api/tmdb/search';
import imagesHandler from '@/pages/api/tmdb/images';
import imageHandler from '@/pages/api/tmdb/image';

function createReq(query: Record<string, string>, method = 'GET'): NextApiRequest {
  return {
    method,
    query,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as NextApiRequest;
}

function createRes() {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    send(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as typeof res & NextApiResponse;
}

const originalFetch = global.fetch;
const originalNodeEnv = process.env.NODE_ENV;
const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const originalKvUrl = process.env.KV_REST_API_URL;
const originalKvToken = process.env.KV_REST_API_TOKEN;

afterEach(() => {
  global.fetch = originalFetch;
  (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  if (originalKvUrl === undefined) delete process.env.KV_REST_API_URL;
  else process.env.KV_REST_API_URL = originalKvUrl;
  if (originalKvToken === undefined) delete process.env.KV_REST_API_TOKEN;
  else process.env.KV_REST_API_TOKEN = originalKvToken;
  resetRateLimitCacheForTests();
});

describe('GET /api/tmdb/image', () => {
  it('CDN 경로 패턴을 벗어난 path는 400으로 거부한다 (SSRF 방지, TMDB_IMAGE_PATH_RE)', async () => {
    const fetchSpy = mock(async () => new Response());
    global.fetch = fetchSpy as unknown as typeof fetch;

    const req = createReq({ path: 'http://evil.example.com/steal.jpg' });
    const res = createRes();
    await imageHandler(req, res);

    expect(res.statusCode).toBe(400);
    // 검증에서 걸리면 CDN이든 임의 호스트든 절대 fetch를 부르지 않는다.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('size가 w342/original이 아니면 original로 폴백해 fetch한다', async () => {
    let requestedUrl: string | undefined;
    global.fetch = mock(async (url: string | URL) => {
      requestedUrl = String(url);
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const req = createReq({ path: '/abc123.jpg', size: 'w780' });
    const res = createRes();
    await imageHandler(req, res);

    expect(requestedUrl).toBe('https://image.tmdb.org/t/p/original/abc123.jpg');
    expect(res.statusCode).toBe(200);
  });

  it('size=w342는 그대로 썸네일 경로로 fetch한다', async () => {
    let requestedUrl: string | undefined;
    global.fetch = mock(async (url: string | URL) => {
      requestedUrl = String(url);
      return {
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const req = createReq({ path: '/abc123.jpg', size: 'w342' });
    const res = createRes();
    await imageHandler(req, res);

    expect(requestedUrl).toBe('https://image.tmdb.org/t/p/w342/abc123.jpg');
  });

  it('production에서 Upstash 미설정이면 503(misconfigured)으로 fail-closed한다', async () => {
    const fetchSpy = mock(async () => new Response());
    global.fetch = fetchSpy as unknown as typeof fetch;

    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    resetRateLimitCacheForTests();

    const req = createReq({ path: '/abc123.jpg' });
    const res = createRes();
    await imageHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('GET 외 메서드는 405', async () => {
    const req = createReq({ path: '/abc123.jpg' }, 'POST');
    const res = createRes();
    await imageHandler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

describe('GET /api/tmdb/search', () => {
  it('query가 없으면 400', async () => {
    const req = createReq({});
    const res = createRes();
    await searchHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('GET 외 메서드는 405', async () => {
    const req = createReq({ query: '기생충' }, 'POST');
    const res = createRes();
    await searchHandler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

describe('GET /api/tmdb/images', () => {
  it('id가 숫자가 아니면 400', async () => {
    const req = createReq({ id: 'abc' });
    const res = createRes();
    await imagesHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('GET 외 메서드는 405', async () => {
    const req = createReq({ id: '123' }, 'POST');
    const res = createRes();
    await imagesHandler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
