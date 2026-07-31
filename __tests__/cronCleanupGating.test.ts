import { afterEach, describe, expect, it } from 'bun:test';
import handler from '../src/pages/api/cron/cleanup-tickets';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * `/api/cron/cleanup-tickets`의 **env 게이팅**만 검증한다(#626).
 *
 * 이 케이스들은 전부 `try` 블록 *앞*에서 반환되므로 @vercel/blob `list`/`del`을 한 번도 부르지
 * 않는다 — 그래서 mock이 필요 없고, mock.module 전역 누수(#611) 위험도 없다. 삭제 판정 자체는
 * `planTicketCleanup`·`ttlDaysFromEnv` 유닛 테스트가 덮고, 여기선 "그 판정에 도달하기 전에
 * 닫히는가"만 본다.
 *
 * 특히 TICKET_TTL_DAYS 거부(503)는 tsconfig `strict: false`라 컴파일러가 못 지킨다:
 * 라우트의 `ttlDays === null` 가드를 지워도 typecheck가 통과하고, 그러면 `null * DAY_MS === 0`
 * 으로 TTL이 0이 돼 **모든 blob이 만료로 판정된다.** 그 가드를 붙들어 두는 게 이 파일이다.
 */

const ENV_KEYS = ['CRON_SECRET', 'BLOB_READ_WRITE_TOKEN', 'TICKET_TTL_DAYS'] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

// process.env는 프로세스 전역이라 파일이 끝나도 안 풀린다 — 매 케이스 뒤에 원복한다(#611).
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/** status/json만 기록하는 최소 res 스텁. */
function fakeRes() {
  const captured: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body;
      return res;
    },
  };
  return { res: res as unknown as NextApiResponse, captured };
}

function req(overrides: Partial<NextApiRequest> = {}): NextApiRequest {
  return {
    method: 'GET',
    headers: { authorization: 'Bearer s3cret' },
    query: {},
    ...overrides,
  } as unknown as NextApiRequest;
}

async function call(reqInit?: Partial<NextApiRequest>) {
  const { res, captured } = fakeRes();
  await handler(req(reqInit), res);
  return captured;
}

describe('cleanup cron env 게이팅', () => {
  it('CRON_SECRET 미설정이면 503으로 닫는다 — 열어두지 않는다(fail-closed)', async () => {
    delete process.env.CRON_SECRET;
    process.env.BLOB_READ_WRITE_TOKEN = 'tok';
    expect((await call()).status).toBe(503);
  });

  it('Bearer가 안 맞으면 401', async () => {
    process.env.CRON_SECRET = 's3cret';
    process.env.BLOB_READ_WRITE_TOKEN = 'tok';
    expect((await call({ headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    expect((await call({ headers: {} })).status).toBe(401);
  });

  it('GET이 아니면 405', async () => {
    process.env.CRON_SECRET = 's3cret';
    expect((await call({ method: 'POST' })).status).toBe(405);
  });

  it('BLOB 토큰이 없으면 500', async () => {
    process.env.CRON_SECRET = 's3cret';
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect((await call()).status).toBe(500);
  });

  // #626의 핵심 가드. 이게 빠지면 거부값이 null → ttlMs 0 → 전 blob 소급 삭제로 간다.
  it('TICKET_TTL_DAYS가 거부되면 삭제로 진행하지 않고 503으로 닫는다', async () => {
    process.env.CRON_SECRET = 's3cret';
    process.env.BLOB_READ_WRITE_TOKEN = 'tok';
    for (const bad of ['0.0001', '0.5', '0', '-1', '30d', '', 'Infinity']) {
      process.env.TICKET_TTL_DAYS = bad;
      const out = await call();
      expect({ bad, status: out.status }).toEqual({ bad, status: 503 });
      expect(out.body).toEqual({ error: 'TICKET_TTL_DAYS is misconfigured' });
    }
  });
});
