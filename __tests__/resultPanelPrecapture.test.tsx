/**
 * #858 결과 화면 저장본 미리 캡처 + 캡처 직렬화(#167) 잠금.
 *
 * 잠그는 것:
 * - 공유 시트 환경이면 결과 화면에 들어오는 순간 저장본을 한 번 캡처하고, [저장]은 그 파일로 **클릭 안에서**
 *   (await 없이) share를 부른다 — iOS Safari가 캡처 뒤 share를 사용자 활성 소실로 거절했다.
 * - 티켓 내용이 바뀌면 다시 만들고, 늦게 끝난 옛 캡처는 쓰지 않는다.
 * - 미리 캡처 중에 누르면 끝나길 기다려 그 파일을 쓴다(캡처를 더 돌리지 않음). 미리 캡처가 실패하면 누를 때
 *   캡처하는 옛 경로로 간다.
 * - 다운로드 환경(공유 시트 없음)은 미리 캡처하지 않는다.
 * - #167: 미리 캡처 · 저장 · 링크가 같은 노드에 캡처를 겹쳐 돌리지 않는다(동시 실행 최대 1).
 *
 * mock 방식은 resultPanelShareGating과 같다(스프레드 스냅샷 복원, #611).
 */
import { describe, expect, test, afterEach, afterAll, beforeAll, beforeEach, mock, jest } from 'bun:test';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { FULL_MOVIE, makeMoodBase } from './fixtures';

const React = require('react') as typeof import('react');

let ResultStage: typeof import('@/components/v2/ResultStage').ResultStage;
let realTicketRenderer: typeof import('@/components/TicketRenderer');
let realCaptureToImage: typeof import('@/utils/captureToImage');

let canShare = true;
// 캡처 한 번마다 resolve를 손으로 넘긴다 — 순서 · 동시성을 테스트가 쥔다.
let pending: Array<{ resolve: (v: string) => void; reject: (e: Error) => void; opts: { pixelRatio?: number } }> = [];
let active = 0;
let maxActive = 0;
let captureCalls = 0;
let shareFileCalls: Array<{ size: number; inClick: boolean }> = [];
let shareAsJpegCalls = 0;
let inClick = false;

function capture(opts: { pixelRatio?: number }) {
  captureCalls += 1;
  active += 1;
  maxActive = Math.max(maxActive, active);
  return new Promise<string>((resolve, reject) => {
    pending.push({
      resolve: (v) => { active -= 1; resolve(v); },
      reject: (e) => { active -= 1; reject(e); },
      opts,
    });
  });
}

beforeAll(() => {
  realTicketRenderer = { ...require('@/components/TicketRenderer') };
  mock.module('@/components/TicketRenderer', () => ({
    ...realTicketRenderer,
    default: React.forwardRef<HTMLDivElement>((_props, ref) =>
      React.createElement('div', { ref, 'data-testid': 'ticket' }),
    ),
  }));
  realCaptureToImage = { ...require('@/utils/captureToImage') };
  mock.module('@/utils/captureToImage', () => ({
    ...realCaptureToImage,
    canShareTicketFile: () => canShare,
    captureNodeToJpeg: (_node: unknown, opts: { pixelRatio?: number }) => capture(opts),
    shareTicketFile: (file: File) => {
      shareFileCalls.push({ size: file.size, inClick });
      return Promise.resolve('shared');
    },
    shareTicketAsJpeg: () => {
      shareAsJpegCalls += 1;
      return capture({}).then(() => 'shared');
    },
    downloadTicketAsJpeg: () => capture({}).then(() => undefined),
  }));
  ResultStage = require('@/components/v2/ResultStage').ResultStage;
});

afterAll(() => {
  mock.module('@/components/TicketRenderer', () => realTicketRenderer);
  mock.module('@/utils/captureToImage', () => realCaptureToImage);
});

const FIELDS: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime', 'theater', 'screen',
  'seat', 'runtime', 'rating', 'releaseDate', 'reissue', 'bookingNo', 'signature',
];
const ALL_ON = Object.fromEntries(FIELDS.map((f) => [f, true])) as Record<TicketField, boolean>;
const MOVIE: MovieInfo = FULL_MOVIE;
const COMPONENTS: TicketComponents = makeMoodBase('minimal');
// base64 길이로 파일 크기를 갈라 어떤 캡처의 파일이 공유됐는지 본다(AAAA = 3바이트, AAAAAAAA = 6바이트).
const JPEG_3 = 'data:image/jpeg;base64,AAAA';
const JPEG_6 = 'data:image/jpeg;base64,AAAAAAAA';

function stage(movieInfo: MovieInfo = MOVIE) {
  return React.createElement(ResultStage, {
    theme: 'dark',
    onBack: () => {},
    croppedImageUrl: 'blob:fake',
    movieInfo,
    components: COMPONENTS,
    fieldVisibility: ALL_ON,
  });
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  canShare = true;
  pending = [];
  active = 0;
  maxActive = 0;
  captureCalls = 0;
  shareFileCalls = [];
  shareAsJpegCalls = 0;
  inClick = false;
  globalThis.fetch = (async () => new Response(JSON.stringify({ id: 'abc' }), { status: 200 })) as unknown as typeof fetch;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, writable: true, value: { writeText: () => Promise.resolve() } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  delete (navigator as unknown as Record<string, unknown>).clipboard;
  jest.restoreAllMocks();
});

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}
async function settle(i: number, value = JPEG_3) {
  await act(async () => {
    pending[i].resolve(value);
  });
  await flush();
}
function clickSync(name: string) {
  // fireEvent.click은 동기다 — 그 안에서 불린 share만 inClick=true로 남는다.
  act(() => {
    inClick = true;
    fireEvent.click(screen.getByRole('button', { name }));
    inClick = false;
  });
}

describe('#858 저장본 미리 캡처', () => {
  test('결과 화면에 들어오면 클릭 없이 한 번 캡처한다', async () => {
    render(stage());
    await flush();
    expect(captureCalls).toBe(1);
  });

  test('미리 만든 파일이 있으면 [저장]은 캡처를 더 돌리지 않고 클릭 안에서 share한다', async () => {
    render(stage());
    await flush();
    await settle(0);
    clickSync('저장');
    await flush();
    expect(captureCalls).toBe(1);
    expect(shareFileCalls).toEqual([{ size: 3, inClick: true }]);
    expect(shareAsJpegCalls).toBe(0);
  });

  test('저장한 뒤 다시 눌러도 같은 파일로 클릭 안에서 share한다', async () => {
    render(stage());
    await flush();
    await settle(0);
    clickSync('저장');
    await flush();
    clickSync('저장');
    await flush();
    expect(captureCalls).toBe(1);
    expect(shareFileCalls.map((c) => c.inClick)).toEqual([true, true]);
  });

  test('미리 캡처 중에 누르면 끝나길 기다려 그 파일을 쓴다(캡처 추가 없음)', async () => {
    render(stage());
    await flush();
    clickSync('저장');
    await flush();
    expect(shareFileCalls.length).toBe(0);
    await settle(0);
    expect(captureCalls).toBe(1);
    expect(shareFileCalls).toEqual([{ size: 3, inClick: false }]);
  });

  test('티켓 내용이 바뀌면 다시 만들고, 늦게 끝난 옛 캡처는 쓰지 않는다', async () => {
    const { rerender } = render(stage());
    await flush();
    rerender(stage({ ...MOVIE, title: 'OTHER' }));
    await flush();
    // 줄 서기(#167): 새 캡처는 옛 캡처가 끝나야 시작한다.
    expect(captureCalls).toBe(1);
    await settle(0, JPEG_3);
    expect(captureCalls).toBe(2);
    await settle(1, JPEG_6);
    clickSync('저장');
    await flush();
    expect(shareFileCalls).toEqual([{ size: 6, inClick: true }]);
  });

  test('기다리던 미리 캡처가 내용 변경으로 밀려나면 [저장]은 옛 파일 대신 지금 내용을 캡처한다', async () => {
    const { rerender } = render(stage());
    await flush();
    clickSync('저장');
    await flush();
    rerender(stage({ ...MOVIE, title: 'OTHER' }));
    await flush();
    await settle(0, JPEG_3);
    // 옛 파일은 버려지고, 밀려난 줄 대신 새 미리 캡처(1) 뒤에 [저장]의 캡처(2)가 선다.
    expect(shareFileCalls.length).toBe(0);
    await settle(1, JPEG_6);
    await settle(2, JPEG_6);
    expect(shareAsJpegCalls).toBe(1);
    expect(maxActive).toBe(1);
  });

  test('미리 캡처가 실패하면 [저장]은 누를 때 캡처하는 옛 경로로 간다', async () => {
    render(stage());
    await flush();
    await act(async () => {
      pending[0].reject(new Error('boom'));
    });
    await flush();
    clickSync('저장');
    await flush();
    expect(shareAsJpegCalls).toBe(1);
    expect(shareFileCalls.length).toBe(0);
  });

  test('결과 화면을 떠나면 줄에 남은 미리 캡처는 돌지 않는다', async () => {
    const { rerender, unmount } = render(stage());
    await flush();
    rerender(stage({ ...MOVIE, title: 'OTHER' }));
    await flush();
    unmount();
    await settle(0);
    expect(captureCalls).toBe(1);
  });

  test('다운로드 환경(공유 시트 없음)은 미리 캡처하지 않는다', async () => {
    canShare = false;
    render(stage());
    await flush();
    expect(captureCalls).toBe(0);
  });
});

describe('#167 캡처 직렬화', () => {
  test('미리 캡처 중 [링크]는 무시되지 않고 줄 서서 그 뒤에 캡처한다(동시 실행 최대 1)', async () => {
    render(stage());
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '링크' }));
    });
    await flush();
    expect(captureCalls).toBe(1);
    await settle(0);
    expect(captureCalls).toBe(2);
    expect(pending[1].opts.pixelRatio).toBe(1);
    await settle(1);
    expect(maxActive).toBe(1);
  });

  test('다운로드 환경의 [저장] 연타는 캡처를 한 번만 돌린다', async () => {
    canShare = false;
    render(stage());
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
      fireEvent.click(screen.getByRole('button', { name: '저장' }));
    });
    await flush();
    expect(captureCalls).toBe(1);
    await settle(0);
    expect(maxActive).toBe(1);
  });
});
