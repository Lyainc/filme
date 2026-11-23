/**
 * #826 S7 — /t/[id] 만료·없음·조회 실패는 notFound가 아니라 404 상태코드 + 빈 상태 props다.
 * Cache-Control(s-maxage)은 성공 경로에만 건다.
 */
import { describe, expect, test, afterAll, beforeEach, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

const real = { ...require('@vercel/blob') };
const listMock = mock(async (..._args: unknown[]): Promise<{ blobs: unknown[] }> => ({ blobs: [] }));
mock.module('@vercel/blob', () => ({ ...real, list: listMock }));

const page = require('@/pages/t/[id]') as typeof import('@/pages/t/[id]');
const { getServerSideProps } = page;
const TicketLanding = page.default;

afterAll(() => {
  mock.module('@vercel/blob', () => real);
});

beforeEach(() => listMock.mockReset());

function makeRes() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    headers,
    setHeader: mock((k: string, v: string) => {
      headers[k] = v;
    }),
  };
}

async function run(id: unknown) {
  const res = makeRes();
  const result = (await getServerSideProps({
    params: id === undefined ? {} : { id },
    req: { headers: { host: 'filme.app' } },
    res,
  } as never)) as Record<string, unknown>;
  return { res, result };
}

function expectExpired(res: ReturnType<typeof makeRes>, result: Record<string, unknown>) {
  expect(res.statusCode).toBe(404);
  expect(result.props).toEqual({ expired: true });
  expect('notFound' in result).toBe(false);
  const cc = Object.entries(res.headers).filter(([k]) => k.toLowerCase() === 'cache-control');
  expect(cc.some(([, v]) => v.includes('s-maxage'))).toBe(false);
}

describe('공유 랜딩 getServerSideProps 빈 상태', () => {
  test('jpg가 없으면 404 + expired props', async () => {
    listMock.mockResolvedValue({ blobs: [{ pathname: 't/abc.json', url: 'https://b/x.json' }] });
    const { res, result } = await run('abc');
    expectExpired(res, result);
  });

  test('id가 비면 404 + expired props (list 호출 없음)', async () => {
    const { res, result } = await run(undefined);
    expectExpired(res, result);
    expect(listMock).not.toHaveBeenCalled();
  });

  test('list가 throw해도 404 + expired props', async () => {
    listMock.mockRejectedValue(new Error('boom'));
    const { res, result } = await run('abc');
    expectExpired(res, result);
  });

  test('성공 경로는 200 유지 + s-maxage 유지', async () => {
    listMock.mockResolvedValue({
      blobs: [{ pathname: 't/abc.jpg', url: 'https://b/abc.jpg' }],
    });
    const { res, result } = await run('abc');
    expect(res.statusCode).toBe(200);
    expect('notFound' in result).toBe(false);
    expect((result.props as Record<string, unknown>).imageUrl).toBe('https://b/abc.jpg');
    expect(res.headers['Cache-Control']).toContain('s-maxage');
  });
});

describe('공유 랜딩 빈 상태 렌더', () => {
  const html = renderToStaticMarkup(<TicketLanding expired />);

  test('제목과 홈 CTA를 그린다', () => {
    expect(html).toContain('만료된 링크예요');
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>나도 티켓 만들기<\/a>/);
    expect(html).toContain('aria-label="FILME 홈"');
  });

  test('티켓 이미지와 og/twitter image 메타가 없다', () => {
    expect(html.includes('<img')).toBe(false);
    expect(html.includes('og:image')).toBe(false);
    expect(html.includes('twitter:image')).toBe(false);
  });
});
