/**
 * Regression test for #194 — 자동 발급 폐기 후, ResultPanel은 **마운트만으로 permalink를
 * 발급하지 않는다**(공유 의도 게이팅: 링크/카톡/X 버튼 클릭 시에만 issuePermalink). 누군가
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

beforeAll(() => {
  realTicketRenderer = require('@/components/TicketRenderer');
  mock.module('@/components/TicketRenderer', () => ({
    default: React.forwardRef<HTMLDivElement>((_props, ref) =>
      React.createElement('div', { ref, 'data-testid': 'ticket' }),
    ),
  }));
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
  texture: 'none', posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false,
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
    // 액션 버튼(저장/링크/X/공유)은 전부 남는다.
    expect(screen.getByRole('button', { name: '사진에 저장' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /링크 만들기/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'X' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '공유' })).toBeTruthy();
  });
});
