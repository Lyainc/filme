/**
 * Regression test for #768 — 결과 화면의 두 TicketRenderer(저장 대상 ResultPanel·hero ResultStage)는
 * ghost를 명시적으로 끈다. ghost 미지정이면 stampWillRender가 "켠 체인/포맷이 비어 있으면 점선
 * placeholder"로 판정해 스탬프 행을 세우고, 저장물은 placeholder만 data-hide-on-export로 빼서 그
 * 행의 구분선·여백이 남아 저장본에만 제목 위 빈 슬롯이 생겼다(iOS·Chrome 공통).
 * TicketRenderer는 받은 ghost를 기록하는 스텁으로 대체한다(resultPanelShareGating과 같은 패턴).
 */
import { describe, expect, test, afterEach, afterAll, beforeAll, mock } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import type { MovieInfo, TicketComponents, TicketField } from '@/types';

const React = require('react') as typeof import('react');

const ghosts: unknown[] = [];
let ResultPanel: typeof import('@/components/v2/ResultPanel').ResultPanel;
let ResultStage: typeof import('@/components/v2/ResultStage').ResultStage;
let realTicketRenderer: typeof import('@/components/TicketRenderer');

beforeAll(() => {
  // 스프레드 스냅샷 — 살아있는 네임스페이스를 붙들면 afterAll 복원이 no-op이 된다(#611).
  realTicketRenderer = { ...require('@/components/TicketRenderer') };
  mock.module('@/components/TicketRenderer', () => ({
    ...realTicketRenderer,
    default: React.forwardRef<HTMLDivElement, { ghost?: boolean }>((props, ref) => {
      ghosts.push(props.ghost);
      return React.createElement('div', { ref });
    }),
  }));
  ResultPanel = require('@/components/v2/ResultPanel').ResultPanel;
  ResultStage = require('@/components/v2/ResultStage').ResultStage;
});

afterEach(() => {
  cleanup();
  ghosts.length = 0;
});
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
// 체인·포맷을 켰지만 로고·라벨이 없는 상태 — ghost 미지정이면 placeholder가 서는 조합.
const COMPONENTS: TicketComponents = {
  layout: 'stub', chain: '', format: '', chainLabel: '', formatLabel: '',
  material: 'original', coating: 'none', materialIntensity: 1, coatingIntensity: 1, posterOpacity: 1, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true, chainScale: 1, formatScale: 1,
};
const COMMON = { croppedImageUrl: 'blob:fake', movieInfo: MOVIE, components: COMPONENTS, fieldVisibility: ALL_ON };

describe('결과 화면 TicketRenderer는 ghost를 끈다 (#768)', () => {
  test('ResultPanel(저장 대상)', () => {
    render(React.createElement(ResultPanel, COMMON));
    expect(ghosts.length).toBeGreaterThan(0);
    expect(ghosts.every((g) => g === false)).toBe(true);
  });

  test('ResultStage hero', () => {
    render(React.createElement(ResultStage, { ...COMMON, theme: 'light', onBack: () => {}, onWordmarkTap: () => {} }));
    expect(ghosts.length).toBeGreaterThan(0);
    expect(ghosts.every((g) => g === false)).toBe(true);
  });
});
