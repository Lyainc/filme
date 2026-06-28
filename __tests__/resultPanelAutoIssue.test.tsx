/**
 * Regression test for #179 — 결과 뷰가 열려 ResultPanel이 마운트되면 permalink가 1회
 * 자동 발급되는지, 그리고 모바일의 숨은 인스턴스(autoIssue=false)는 발급하지 않는지 검증한다.
 * 후자가 깨지면 한 번의 '티켓 완성'에 발급이 두 번(중복 업로드) 일어난다.
 *
 * 검증 전략: 공유 모듈(captureToImage·html-to-image)을 mock하지 않는다 — bun mock.module은
 * 프로세스 전역이라 그걸 mock하면 같은 모듈을 쓰는 captureToImage.test·captureWarmup.test가
 * 깨진다. 대신 happy-dom에선 html-to-image의 캔버스 캡처가 실제로 실패하는 점을 이용한다:
 *   - autoIssue=true  → 마운트 효과가 issuePermalink를 돌려 permaState가 loading→error로 간다.
 *   - autoIssue=false → 효과가 early-return해 '링크 만들기' idle 그대로다.
 * 즉 발급이 시작됐는지(상태 전이)로 게이팅을 관찰한다. TicketRenderer만 forwardRef div 스텁으로
 * 대체하는데, 이 컴포넌트를 import하는 다른 테스트가 없어 전역 mock 누수가 무해하다.
 */
import { describe, expect, test, afterEach, afterAll, beforeAll, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

const React = require('react') as typeof import('react');

let ResultPanel: typeof import('@/components/v2/ResultPanel').ResultPanel;
let realTicketRenderer: typeof import('@/components/TicketRenderer');

beforeAll(() => {
  realTicketRenderer = require('@/components/TicketRenderer');
  // TicketRenderer(default export, forwardRef) → ref를 div에 걸어 ticketRef.current를 채운다.
  // ResizeObserver/무드 DOM을 피하려는 것뿐 — 캡처는 실제 경로로 둔다(아래 설명).
  mock.module('@/components/TicketRenderer', () => ({
    default: React.forwardRef<HTMLDivElement>((_props, ref) =>
      React.createElement('div', { ref, 'data-testid': 'ticket' }),
    ),
  }));
  // mock 후 require — bun mock.module은 hoisting 안 됨(CLAUDE.md 테스트 규약).
  ResultPanel = require('@/components/v2/ResultPanel').ResultPanel;
});

afterEach(() => cleanup());
afterAll(() => {
  mock.module('@/components/TicketRenderer', () => realTicketRenderer);
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
  texture: 'none', posterOpacity: 0.5, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false,
};

function renderPanel(autoIssue: boolean) {
  return render(
    React.createElement(ResultPanel, {
      croppedImageUrl: 'blob:fake',
      movieInfo: MOVIE,
      components: COMPONENTS,
      fieldVisibility: ALL_ON,
      autoIssue,
    }),
  );
}

describe('ResultPanel auto-issue (#179)', () => {
  test('autoIssue면 마운트 시 발급이 시작된다 (loading→실패까지 진행)', async () => {
    renderPanel(true);
    // 발급 진입의 즉각 신호 — issuePermalink가 캡처 전에 setPermaState('loading')을 건다.
    await waitFor(() => expect(screen.getByText('링크 만드는 중…')).toBeTruthy());
    // happy-dom 캡처 실패로 결국 error로 떨어진다 = issuePermalink가 끝까지 돌았다는 증거.
    await waitFor(() => expect(screen.getByText('실패, 다시 시도')).toBeTruthy());
  });

  test('autoIssue가 false면 발급하지 않는다 (숨은 모바일 인스턴스 중복 방지)', async () => {
    renderPanel(false);
    await waitFor(() => expect(screen.getByText('링크 만들기')).toBeTruthy());
    expect(screen.queryByText('링크 만드는 중…')).toBeNull();
    expect(screen.queryByText('실패, 다시 시도')).toBeNull();
  });
});
