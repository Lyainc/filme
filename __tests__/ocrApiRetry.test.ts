import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '@/pages/api/ocr';

afterEach(() => mock.restore());

test('Google 429: 실제 OCR 라우트와 SDK가 벤더를 정확히 한 번 호출한다 (#773)', async () => {
  const env = { ...process.env };
  try {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'fake-ocr-test-key';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_URL;
    Object.assign(process.env, { NODE_ENV: 'test' });
    spyOn(console, 'error').mockImplementation(() => {});
    const vendor = spyOn(globalThis, 'fetch').mockImplementation((async () =>
      new Response(JSON.stringify({
        error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' },
      }), { status: 429, headers: { 'Content-Type': 'application/json' } })
    ) as unknown as typeof fetch);
    const status = mock(() => res);
    const json = mock(() => res);
    const res = { status, json } as unknown as NextApiResponse;
    const req = {
      method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' },
      body: { image: 'iVBORw0KGgo=', mimeType: 'image/png' },
    } as NextApiRequest;

    await handler(req, res);

    expect(vendor).toHaveBeenCalledTimes(1);
    expect(String(vendor.mock.calls[0][0])).toContain('generativelanguage.googleapis.com');
    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({ error: 'OCR extraction failed' });
  } finally {
    for (const key of ['GOOGLE_GENERATIVE_AI_API_KEY', 'UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL', 'NODE_ENV']) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
  }
});
