/**
 * #826 S7 결과 화면(ResultStage = 위 줄 ‹ + 티켓 + [저장] [링크] [공유] + 고지) 동작 잠금.
 * 옛 #194 게이팅(마운트만으론 발급 안 함)은 a7로 이어받는다.
 *
 * 잠그는 것: a3 버튼 이름 · 고지 상시 노출 · 저장 통보/취소 무통보/진행 중 aria-busy, a4 실패는 경고 한 줄(다시 시도
 * 버튼 없음 · 같은 버튼 재클릭 = 재시도 · showError 0), a5 클립보드 성공/거부(대체 칸)/네이티브 공유 취소·폴백,
 * a6 만료 문장은 링크 발급 뒤에만, a7 /api/ticket은 링크·공유 클릭에서만(저장 · 마운트 · 테마 전환은 0),
 * a14 통보 live region은 늘 마운트(같은 노드의 글자만 바뀜), a15 대체 칸 포커스 · 전체 선택, a17 저장 체크 약 1.5초,
 * a18 경고 해소 시점(다른 조작 · 새 티켓 내용)과 통보 글자 2초 소멸.
 *
 * mock: TicketRenderer는 forwardRef div 스텁, captureToImage는 테스트별 가변 구현(스프레드 스냅샷으로 복원, #611),
 * errorToast는 showError 호출 수 확인용. fetch · clipboard · share는 전역을 바꿨다가 afterEach에서 되돌린다.
 */
import { describe, expect, test, afterEach, afterAll, beforeAll, beforeEach, mock, jest } from 'bun:test';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';
import { DEFAULT_TICKET_TTL_DAYS, UNOFFICIAL_TICKET_NOTICE } from '@/utils/ticketCleanup';

const React = require('react') as typeof import('react');

let ResultStage: typeof import('@/components/v2/ResultStage').ResultStage;
let realTicketRenderer: typeof import('@/components/TicketRenderer');
let realCaptureToImage: typeof import('@/utils/captureToImage');
let realErrorToast: typeof import('@/utils/errorToast');

// 테스트별 가변 구현
let downloadImpl: () => Promise<unknown> = () => Promise.resolve();
let shareImpl: () => Promise<'shared' | 'cancelled'> = () => Promise.resolve('shared');
let captureImpl: () => Promise<string> = () => Promise.resolve('data:image/jpeg;base64,AAAA');
let canShare = false;
let showErrorCalls = 0;
let downloadCalls = 0;

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
    downloadTicketAsJpeg: () => {
      downloadCalls += 1;
      return downloadImpl();
    },
    shareTicketAsJpeg: () => shareImpl(),
    captureNodeToJpeg: () => captureImpl(),
  }));
  realErrorToast = { ...require('@/utils/errorToast') };
  mock.module('@/utils/errorToast', () => ({
    ...realErrorToast,
    showError: () => {
      showErrorCalls += 1;
    },
  }));
  ResultStage = require('@/components/v2/ResultStage').ResultStage;
});

afterAll(() => {
  mock.module('@/components/TicketRenderer', () => realTicketRenderer);
  mock.module('@/utils/captureToImage', () => realCaptureToImage);
  mock.module('@/utils/errorToast', () => realErrorToast);
});

const FIELDS: TicketField[] = [
  'title', 'titleOg', 'actors', 'watchDate', 'watchTime', 'theater', 'screen',
  'seat', 'runtime', 'rating', 'releaseDate', 'reissue', 'bookingNo', 'signature',
];
const ALL_ON = Object.fromEntries(FIELDS.map((f) => [f, true])) as Record<TicketField, boolean>;
const MOVIE: MovieInfo = {
  title: 'TITLE', titleOg: 'ORIGINAL', releaseDate: '2026-05-01',
  releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '', isReissue: false, watchDate: '2026-05-03',
  watchDateFormat: 'kr-compact', watchTime: '20:30', theater: 'CGV',
  screen: 'IMAX', seat: 'G14', actors: 'Actor', rating: 4.5,
  runtime: '150 MIN', bookingNumber: 'BOOK-1234', signature: '@sig',
};
const COMPONENTS: TicketComponents = {
  layout: 'minimal', chain: '', format: '', chainLabel: '', formatLabel: '',
  material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1, posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false, chainScale: 1, formatScale: 1,
};

function stage(theme: 'dark' | 'light' = 'dark', movieInfo: MovieInfo = MOVIE) {
  return React.createElement(ResultStage, {
    theme,
    onBack: () => {},
    croppedImageUrl: 'blob:fake',
    movieInfo,
    components: COMPONENTS,
    fieldVisibility: ALL_ON,
  });
}

// --- 전역 스파이 -------------------------------------------------------------
const realFetch = globalThis.fetch;
let fetchCalls: string[] = [];
let fetchImpl: () => Promise<Response> = async () =>
  new Response(JSON.stringify({ id: 'abc', url: '' }), { status: 200 });
let writeTextCalls: string[] = [];
let writeTextImpl: () => Promise<void> = () => Promise.resolve();
let shareCalls = 0;
let nativeShareImpl: (() => Promise<void>) | undefined;

function setNav(name: string, value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, writable: true, value });
}

beforeEach(() => {
  downloadImpl = () => Promise.resolve();
  shareImpl = () => Promise.resolve('shared');
  captureImpl = () => Promise.resolve('data:image/jpeg;base64,AAAA');
  canShare = false;
  showErrorCalls = 0;
  downloadCalls = 0;
  fetchCalls = [];
  fetchImpl = async () => new Response(JSON.stringify({ id: 'abc', url: '' }), { status: 200 });
  writeTextCalls = [];
  writeTextImpl = () => Promise.resolve();
  shareCalls = 0;
  nativeShareImpl = undefined;
  globalThis.fetch = (async (input: unknown) => {
    fetchCalls.push(String(input));
    return fetchImpl();
  }) as unknown as typeof fetch;
  setNav('clipboard', {
    writeText: (t: string) => {
      writeTextCalls.push(t);
      return writeTextImpl();
    },
  });
  setNav('share', undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  cleanup();
  globalThis.fetch = realFetch;
  // 이 파일이 만든 own property를 걷어 happy-dom 기본으로 되돌린다.
  delete (navigator as unknown as Record<string, unknown>).clipboard;
  delete (navigator as unknown as Record<string, unknown>).share;
  jest.restoreAllMocks();
});

function useNativeShare(impl: () => Promise<void>) {
  nativeShareImpl = impl;
  setNav('share', () => {
    shareCalls += 1;
    return nativeShareImpl!();
  });
}

const btn = (name: string) => screen.getByRole('button', { name });
async function click(name: string) {
  await act(async () => {
    fireEvent.click(btn(name));
  });
}
async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}
const toast = () => screen.getByTestId('result-stage').querySelector('[role="status"]') as HTMLElement;
const ticketCalls = () => fetchCalls.filter((u) => u.includes('/api/ticket')).length;
const hasText = (t: string) => screen.queryByText(t) !== null;

// --- a3 ---------------------------------------------------------------------
describe('a3 버튼 · 고지 · 저장 통보', () => {
  test('버튼 이름 4개, 워드마크 · 해상도 · 새 티켓 만들기 없음, 고지는 링크 전후 모두 보인다', async () => {
    render(stage());
    for (const n of ['편집으로 돌아가기', '저장', '링크', '공유']) expect(!!btn(n)).toBe(true);
    expect(screen.queryByRole('heading', { name: /FILME/ }) === null).toBe(true);
    expect(screen.queryByText(/1960\s*×\s*3108/) === null).toBe(true);
    expect(screen.queryByText(/새 티켓 만들기/) === null).toBe(true);
    expect(hasText(UNOFFICIAL_TICKET_NOTICE)).toBe(true);
    await click('링크');
    await flush();
    expect(hasText(UNOFFICIAL_TICKET_NOTICE)).toBe(true);
  });

  test('저장 성공은 status에 저장했어요', async () => {
    render(stage());
    await click('저장');
    await flush();
    expect(toast().textContent).toBe('저장했어요');
  });

  test('공유 시트를 닫으면(cancelled) 저장했어요가 없다', async () => {
    canShare = true;
    shareImpl = () => Promise.resolve('cancelled');
    render(stage());
    await click('저장');
    await flush();
    expect(hasText('저장했어요')).toBe(false);
  });

  test('저장 중에는 저장 aria-busy, 링크 · 공유 비활성', async () => {
    let release!: () => void;
    downloadImpl = () => new Promise<void>((r) => { release = r; });
    render(stage());
    await click('저장');
    expect(btn('저장').getAttribute('aria-busy')).toBe('true');
    expect((btn('링크') as HTMLButtonElement).disabled).toBe(true);
    expect((btn('공유') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => release());
    await flush();
  });
});

// --- a4 ---------------------------------------------------------------------
describe('a4 실패는 경고 한 줄, 재시도는 같은 버튼', () => {
  test('저장 실패: alert, 다시 시도 버튼 없음, 재클릭으로 재호출', async () => {
    downloadImpl = () => Promise.reject(new Error('boom'));
    render(stage());
    await click('저장');
    await flush();
    expect(screen.getByRole('alert').textContent).toBe('저장하지 못했어요');
    expect(screen.queryByRole('button', { name: '다시 시도' }) === null).toBe(true);
    expect(downloadCalls).toBe(1);
    await click('저장');
    await flush();
    expect(downloadCalls).toBe(2);
    expect(showErrorCalls).toBe(0);
  });

  test.each([
    ['fetch reject', () => Promise.reject(new Error('net'))],
    ['!ok', async () => new Response('{}', { status: 500 })],
  ])('링크 실패(%s): alert, showError 0, 옛 문구 없음', async (_n, impl) => {
    fetchImpl = impl as () => Promise<Response>;
    render(stage());
    await click('링크');
    await flush();
    expect(screen.getByRole('alert').textContent).toBe('링크를 만들지 못했어요');
    expect(showErrorCalls).toBe(0);
    expect(screen.queryByText('실패, 다시 시도') === null).toBe(true);
  });

  test('src에 옛 실패 문구가 남아 있지 않다', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|css)$/.test(f)) {
          const s = readFileSync(p, 'utf8');
          if (s.includes('링크 생성에 실패했어요') || s.includes('실패, 다시 시도')) hits.push(p);
        }
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(hits).toEqual([]);
  });
});

// --- a5 ---------------------------------------------------------------------
describe('a5 링크 복사 · 공유', () => {
  test('복사 성공: 링크를 복사했어요 status, 대체 칸 없음', async () => {
    render(stage());
    await click('링크');
    await flush();
    expect(toast().textContent).toBe('링크를 복사했어요');
    expect(screen.queryByLabelText('공유 링크') === null).toBe(true);
    expect(writeTextCalls[0]).toMatch(/\/t\/abc$/);
  });

  test('복사 거부: 읽기 전용 대체 칸(16px)', async () => {
    writeTextImpl = () => Promise.reject(new Error('denied'));
    render(stage());
    await click('링크');
    await flush();
    const input = screen.getByLabelText('공유 링크') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.className).toContain('text-[16px]');
  });

  test('navigator.share 없음: 발급 1회 뒤 writeText로 폴백', async () => {
    render(stage());
    await click('공유');
    await flush();
    expect(ticketCalls()).toBe(1);
    expect(writeTextCalls.length).toBe(1);
    expect(writeTextCalls[0]).toMatch(/\/t\/abc$/);
    expect(toast().textContent).toBe('링크를 복사했어요');
  });

  test('네이티브 공유 AbortError: 복사도 통보도 없다', async () => {
    const e = new Error('abort');
    e.name = 'AbortError';
    useNativeShare(() => Promise.reject(e));
    render(stage());
    await click('공유');
    await flush();
    expect(shareCalls).toBe(1);
    expect(writeTextCalls.length).toBe(0);
    expect(toast().textContent).toBe('');
  });

  test('링크 없이 공유 + 발급 실패: share · writeText 0, alert만', async () => {
    fetchImpl = () => Promise.reject(new Error('net'));
    useNativeShare(() => Promise.resolve());
    render(stage());
    await click('공유');
    await flush();
    expect(shareCalls).toBe(0);
    expect(writeTextCalls.length).toBe(0);
    expect(screen.getByRole('alert').textContent).toBe('링크를 만들지 못했어요');
    expect(hasText('링크를 복사했어요')).toBe(false);
  });
});

// --- a6 ---------------------------------------------------------------------
describe('a6 만료 문장', () => {
  test('링크 전엔 없고, 발급 뒤 3일 만료 문장 + 고지', async () => {
    render(stage());
    expect(screen.queryByText(/만료돼요/) === null).toBe(true);
    await click('링크');
    await flush();
    expect(hasText(`이 링크는 ${DEFAULT_TICKET_TTL_DAYS}일 후 만료돼요.`)).toBe(true);
    expect(hasText(UNOFFICIAL_TICKET_NOTICE)).toBe(true);
  });
});

// --- a7 ---------------------------------------------------------------------
describe('a7 /api/ticket은 링크 · 공유 클릭에서만', () => {
  test('마운트 · 저장 · 테마 전환 0, 링크 1, 링크 있는 공유는 그대로 1', async () => {
    const { rerender } = render(stage('dark'));
    expect(ticketCalls()).toBe(0);
    await click('저장');
    await flush();
    expect(ticketCalls()).toBe(0);
    rerender(stage('light'));
    await flush();
    expect(ticketCalls()).toBe(0);
    await click('링크');
    await flush();
    expect(ticketCalls()).toBe(1);
    await click('공유');
    await flush();
    expect(ticketCalls()).toBe(1);
  });
});

// --- a14 --------------------------------------------------------------------
describe('a14 통보 live region', () => {
  test('처음부터 마운트된 같은 노드의 글자만 바뀌고 showError는 0', async () => {
    render(stage());
    const root = screen.getByTestId('result-stage');
    const node = toast();
    expect(root.contains(node)).toBe(true);
    await click('저장');
    await flush();
    expect(toast() === node).toBe(true);
    expect(node.textContent).toBe('저장했어요');
    await click('링크');
    await flush();
    expect(toast() === node).toBe(true);
    expect(node.textContent).toBe('링크를 복사했어요');
    // 실패 경로들
    downloadImpl = () => Promise.reject(new Error('x'));
    await click('저장');
    await flush();
    fetchImpl = () => Promise.reject(new Error('x'));
    cleanup();
    render(stage());
    await click('링크');
    await click('공유');
    await flush();
    expect(showErrorCalls).toBe(0);
  });
});

// --- a15 --------------------------------------------------------------------
describe('a15 대체 칸 포커스', () => {
  test('거부되면 입력에 포커스 + 전체 선택', async () => {
    writeTextImpl = () => Promise.reject(new Error('denied'));
    render(stage());
    await click('링크');
    await flush();
    const input = screen.getByLabelText('공유 링크') as HTMLInputElement;
    expect(document.activeElement === input).toBe(true);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });
});

// --- a17 (fake timers) ---------------------------------------------------------
describe('a17 저장 체크 약 1.5초', () => {
  test('성공 직후 체크 아이콘, 2초 뒤 사라진다', async () => {
    jest.useFakeTimers();
    render(stage());
    await click('저장');
    await flush();
    expect(screen.queryByTestId('result-save-check') !== null).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId('result-save-check') === null).toBe(true);
  });
});

// --- a18 --------------------------------------------------------------------
describe('a18 경고 · 통보 소멸', () => {
  async function saveFail() {
    downloadImpl = () => Promise.reject(new Error('x'));
    await click('저장');
    await flush();
    expect(screen.queryByRole('alert') !== null).toBe(true);
    downloadImpl = () => Promise.resolve();
  }

  test('경고 뒤 링크 성공은 경고를 지운다', async () => {
    render(stage());
    await saveFail();
    await click('링크');
    await flush();
    expect(screen.queryByRole('alert') === null).toBe(true);
  });

  test('경고 뒤 공유는 경고를 지운다', async () => {
    render(stage());
    await saveFail();
    await click('공유');
    await flush();
    expect(screen.queryByRole('alert') === null).toBe(true);
  });

  test('조작이 없으면 10초가 지나도 경고가 남는다', async () => {
    jest.useFakeTimers();
    render(stage());
    await saveFail();
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    expect(screen.queryByRole('alert') !== null).toBe(true);
  });

  test('통보 글자는 2초 뒤 비고 status 노드는 남는다', async () => {
    jest.useFakeTimers();
    render(stage());
    await click('링크');
    await flush();
    const node = toast();
    expect(node.textContent).toBe('링크를 복사했어요');
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(node.textContent).toBe('');
    expect(node.isConnected).toBe(true);
  });

  test('새 movieInfo(제목이 다른 객체)로 다시 그리면 대체 칸이 사라진다', async () => {
    writeTextImpl = () => Promise.reject(new Error('denied'));
    const { rerender } = render(stage());
    await click('링크');
    await flush();
    expect(screen.queryByLabelText('공유 링크') !== null).toBe(true);
    rerender(stage('dark', { ...MOVIE, title: 'OTHER' }));
    await flush();
    expect(screen.queryByLabelText('공유 링크') === null).toBe(true);
  });
});
