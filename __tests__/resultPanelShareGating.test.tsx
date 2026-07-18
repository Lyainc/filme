/**
 * Regression test for #194 — 자동 발급 폐기 후, ResultPanel은 **마운트만으로 permalink를
 * 발급하지 않는다**(공유 의도 게이팅: 링크/카톡 버튼 클릭 시에만 issuePermalink). 누군가
 * 결과-뷰-열림 자동 발급(#179)을 되살리면 결과 뷰를 여는 모두가 Blob에 업로드해 Hobby 한도에
 * 직결되므로, 마운트 시 업로드 경로가 깨어나지 않음을 고정한다.
 *
 * 관찰: issuePermalink는 캡처 전에 setPermaState('loading')을 걸고 happy-dom 캔버스 캡처는
 * 실패해 error로 떨어진다. 따라서 발급이 일어났다면 'loading' 또는 '실패, 다시 시도'가 떠야
 * 한다 — 둘 다 안 뜨고 '링크 만들기' idle이면 자동 발급이 없는 것. 공유 모듈은 mock하지 않는다
 * (bun mock.module 전역 누수 회피). TicketRenderer만 forwardRef div 스텁으로 대체(다른 테스트가
 * import하지 않아 누수 무해, ResizeObserver/무드 DOM 회피).
 */
import { describe, expect, test, afterEach, afterAll, beforeAll, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

const React = require('react') as typeof import('react');

let ResultPanel: typeof import('@/components/v2/ResultPanel').ResultPanel;
let realTicketRenderer: typeof import('@/components/TicketRenderer');
let realCaptureToImage: typeof import('@/utils/captureToImage');

beforeAll(() => {
  realTicketRenderer = require('@/components/TicketRenderer');
  mock.module('@/components/TicketRenderer', () => ({
    default: React.forwardRef<HTMLDivElement>((_props, ref) =>
      React.createElement('div', { ref, 'data-testid': 'ticket' }),
    ),
  }));
  // captureNodeToJpeg(→ toJpeg)의 "자연 실패"는 happy-dom 환경 자체(canvas 2D 미지원)에
  // 기대는 것인데, captureWarmup.test.ts가 파일 스코프에서 'html-to-image'를 mock.module로
  // 영구 대체해(bun mock.module 전역 누수) 전체 스위트로 돌리면 이 파일보다 먼저 로드돼
  // toJpeg가 항상 성공으로 leak된다(claude-review PR #426 P1 대응 중 발견). downloadTicketAsJpeg만
  // 결정론적으로 실패하게 mock — captureNodeToJpeg 등 나머지는 실제 구현 유지해 위 permalink
  // 테스트(캡처 후 fetch 실패에 의존)는 그대로 둔다.
  realCaptureToImage = require('@/utils/captureToImage');
  mock.module('@/utils/captureToImage', () => ({
    ...realCaptureToImage,
    canShareTicketFile: () => false,
    downloadTicketAsJpeg: () => Promise.reject(new Error('mock download failure')),
  }));
  ResultPanel = require('@/components/v2/ResultPanel').ResultPanel;
});

afterEach(() => cleanup());
afterAll(() => {
  mock.module('@/components/TicketRenderer', () => realTicketRenderer);
  mock.module('@/utils/captureToImage', () => realCaptureToImage);
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
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false, posterFit: 'cover',
};

function renderPanel(extra: { hidePreview?: boolean } = {}) {
  return render(
    React.createElement(ResultPanel, {
      croppedImageUrl: 'blob:fake',
      movieInfo: MOVIE,
      components: COMPONENTS,
      fieldVisibility: ALL_ON,
      ...extra,
    }),
  );
}

describe('ResultPanel 공유 의도 게이팅 (#194)', () => {
  test('마운트만으로는 permalink를 발급하지 않는다 (자동 발급 폐기)', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText('링크 만들기')).toBeTruthy());
    // 발급이 일어났다면 loading 또는 error 라벨이 떠야 한다 — 둘 다 없어야 자동 발급 부재.
    expect(screen.queryByText('링크 만드는 중…')).toBeNull();
    expect(screen.queryByText('실패, 다시 시도')).toBeNull();
  });

  test("'링크 만들기' 클릭 시에는 발급이 일어난다 (공유 의도 = 양의 경로)", async () => {
    const user = userEvent.setup();
    renderPanel();
    const button = await screen.findByText('링크 만들기');
    await user.click(button);
    // on-demand 발급이 돌면 캡처 전에 loading→(happy-dom 캡처 실패로) error로 전이한다.
    // error 라벨이 뜨면 issuePermalink가 끝까지 돌았다는 증거 = 버튼→발급 배선 정상.
    await waitFor(() => expect(screen.getByText('실패, 다시 시도')).toBeTruthy());
  });
});

describe('ResultPanel 다운로드 실패 노출 (#414 1단계, claude-review PR #426 P1)', () => {
  // downloadTicketAsJpeg는 위 beforeAll에서 결정론적으로 reject하도록 mock돼 있다(파일 상단 주석).
  test('다운로드 실패 시 에러 배너 + 재시도 버튼이 뜬다', async () => {
    const user = userEvent.setup();
    renderPanel();
    const saveButton = await screen.findByRole('button', { name: '사진에 저장' });
    await user.click(saveButton);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('저장에 실패했어요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });

  test('재시도 버튼이 handleDownload를 다시 실행한다(캡처 재시도)', async () => {
    const user = userEvent.setup();
    const originalError = console.error;
    const saveCalls: unknown[][] = [];
    console.error = (...args: unknown[]) => {
      if (args[0] === '[save]') saveCalls.push(args);
    };
    try {
      renderPanel();
      const saveButton = await screen.findByRole('button', { name: '사진에 저장' });
      await user.click(saveButton);
      await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
      const countAfterFirst = saveCalls.length;
      expect(countAfterFirst).toBeGreaterThan(0);

      await user.click(screen.getByRole('button', { name: '다시 시도' }));
      // 재시도도 같은 이유로 실패하지만, [save] 에러 로그가 한 번 더 찍혔다는 건
      // handleDownload가 처음부터 다시 실행됐다는 증거다(무음 재-실패가 아니라 재-시도).
      await waitFor(() => expect(saveCalls.length).toBeGreaterThan(countAfterFirst));
    } finally {
      console.error = originalError;
    }
  });
});

describe('ResultPanel hidePreview (#233 데스크톱 done 이중 프리뷰 제거)', () => {
  test('hidePreview 미전달(모바일 경로) = 프리뷰 카드가 flow에 보인다', async () => {
    renderPanel();
    const ticket = await screen.findByTestId('ticket');
    // 캡처 타깃이 off-screen aria-hidden 래퍼 밖 = 시각적으로 노출된 프리뷰 카드.
    expect(ticket.closest('[aria-hidden="true"]')).toBeNull();
  });

  test('hidePreview=true = 캡처 타깃은 DOM에 남되 off-screen, 액션 버튼은 전부 렌더', async () => {
    renderPanel({ hidePreview: true });
    // 캡처 타깃 노드는 DOM에 유지(html-to-image 대상) — 다운로드/공유/퍼마링크 무결.
    const ticket = await screen.findByTestId('ticket');
    // 시각적으로만 숨김: off-screen aria-hidden 래퍼 안(display:none 아님).
    const wrapper = ticket.closest('[aria-hidden="true"]') as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.style.position).toBe('fixed'); // off-screen 고정 — 레이아웃은 유지
    // 액션 버튼(저장/링크/공유)은 전부 남는다.
    expect(screen.getByRole('button', { name: '사진에 저장' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /링크 만들기/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '공유' })).toBeTruthy();
  });
});
