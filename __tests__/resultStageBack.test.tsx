/**
 * #258 — ResultSheet(vaul 바텀시트)를 ResultStage(전체화면 스테이지)로 교체.
 * 구 #197 포커스 테스트는 vaul Drawer 전용(Escape/포커스 트랩)이라 무의미해졌다 —
 * ResultStage는 모달이 아니라 편집 셸을 교체하는 일반 페이지라 Escape 계약이 없다.
 * 이 테스트는 새 셸 배선의 핵심 — 뒤로가기 버튼이 onBack(useResultView.closeView)으로
 * 연결되는지 — 를 고정한다. TicketRenderer만 stub(ResizeObserver/무드 DOM 회피).
 */
import { describe, expect, test, afterEach, afterAll, beforeAll, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

const React = require('react') as typeof import('react');

let ResultStage: typeof import('@/components/v2/ResultStage').ResultStage;
let realTicketRenderer: typeof import('@/components/TicketRenderer');

beforeAll(() => {
  realTicketRenderer = require('@/components/TicketRenderer');
  mock.module('@/components/TicketRenderer', () => ({
    default: React.forwardRef<HTMLDivElement>((_props, ref) =>
      React.createElement('div', { ref, 'data-testid': 'ticket' }),
  ),
  }));
  ResultStage = require('@/components/v2/ResultStage').ResultStage;
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

function renderStage(onBack: () => void) {
  return render(
    React.createElement(ResultStage, {
      theme: 'light',
      onBack,
      croppedImageUrl: 'blob:fake',
      movieInfo: MOVIE,
      components: COMPONENTS,
      fieldVisibility: ALL_ON,
    }),
  );
}

describe('ResultStage 뒤로가기 배선 (#258)', () => {
  test('뒤로가기 버튼으로 onBack이 호출된다', async () => {
    let backed = 0;
    renderStage(() => { backed += 1; });
    const back = await screen.findByLabelText('편집으로 돌아가기');
    fireEvent.click(back);
    expect(backed).toBe(1);
  });

  test('완성 eyebrow와 hero 티켓이 렌더된다', async () => {
    renderStage(() => {});
    await screen.findByText('티켓 완성');
    // hero(표시용) + ResultPanel의 off-screen 캡처 대상, 두 TicketRenderer가 함께 마운트된다.
    expect(screen.getAllByTestId('ticket').length).toBe(2);
  });
});
