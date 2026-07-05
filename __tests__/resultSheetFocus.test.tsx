/**
 * #197 — ResultSheet 모달 포커스 관리. aria-modal만 선언하고 포커스/Escape 관리가
 * 없던 커스텀 시트를, 형제 FieldEditSheet가 쓰는 vaul Drawer로 교체해 포커스 트랩·복원·
 * Escape 닫힘을 라이브러리에서 가져왔다.
 *
 * 이 테스트는 셸 배선의 핵심 — Escape와 닫기 버튼이 onClose로 연결되는지 — 를 고정한다.
 * 누군가 vaul을 떼고 aria-modal만 있는 div로 되돌리면(원래 #197 버그 상태) Escape가
 * 무동작이 되어 이 테스트가 실패한다. (포커스 복원 자체는 vaul 책임이라 여기서 재검증하지
 * 않는다 — happy-dom 포커스 모델 한계.) TicketRenderer만 stub(ResizeObserver/무드 DOM 회피).
 */
import { describe, expect, test, afterEach, afterAll, beforeAll, mock } from 'bun:test';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

const React = require('react') as typeof import('react');

let ResultSheet: typeof import('@/components/v2/ResultSheet').ResultSheet;
let realTicketRenderer: typeof import('@/components/TicketRenderer');

beforeAll(() => {
  realTicketRenderer = require('@/components/TicketRenderer');
  mock.module('@/components/TicketRenderer', () => ({
    default: React.forwardRef<HTMLDivElement>((_props, ref) =>
      React.createElement('div', { ref, 'data-testid': 'ticket' }),
    ),
  }));
  ResultSheet = require('@/components/v2/ResultSheet').ResultSheet;
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

function renderSheet(onClose: () => void) {
  return render(
    React.createElement(ResultSheet, {
      open: true,
      onClose,
      croppedImageUrl: 'blob:fake',
      movieInfo: MOVIE,
      components: COMPONENTS,
      fieldVisibility: ALL_ON,
    }),
  );
}

describe('ResultSheet 모달 닫기 배선 (#197)', () => {
  test('Escape로 onClose가 호출된다 (vaul 포커스 셸)', async () => {
    const user = userEvent.setup();
    let closed = 0;
    renderSheet(() => { closed += 1; });
    await screen.findByText('티켓이 완성됐어요!');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(closed).toBeGreaterThan(0));
  });

  test('닫기 버튼으로 onClose가 호출된다', async () => {
    // fireEvent.click(=click만 디스패치). userEvent.click은 pointer up까지 시뮬레이트해
    // vaul 내부 드래그 핸들러가 happy-dom의 빈 transform을 읽다 터진다(환경 한계).
    let closed = 0;
    renderSheet(() => { closed += 1; });
    const close = await screen.findByLabelText('닫기');
    fireEvent.click(close);
    await waitFor(() => expect(closed).toBeGreaterThan(0));
  });
});
