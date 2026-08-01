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
  // 스프레드 스냅샷 — 살아있는 네임스페이스를 붙들면 mock.module이 그 객체를 제자리에서 갈아끼워
  // afterAll 복원이 no-op이 된다(#611, resultPanelShareGating.test.tsx에 같은 주석).
  realTicketRenderer = { ...require('@/components/TicketRenderer') };
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
  material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1, posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: false, formatVisible: false, chainScale: 1, formatScale: 1,
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

  test('hero 티켓이 렌더된다', async () => {
    renderStage(() => {});
    // hero(표시용) + ResultPanel의 off-screen 캡처 대상, 두 TicketRenderer가 함께 마운트된다.
    await screen.findAllByTestId('ticket');
    expect(screen.getAllByTestId('ticket').length).toBe(2);
  });

  test('croppedImageUrl이 없어도 hero와 ResultPanel이 정상 렌더된다 (포스터리스, #631)', async () => {
    render(
      React.createElement(ResultStage, {
        theme: 'light',
        onBack: () => {},
        croppedImageUrl: null,
        movieInfo: MOVIE,
        components: COMPONENTS,
        fieldVisibility: ALL_ON,
      }),
    );
    // hero(표시용) + ResultPanel의 off-screen 캡처 대상, 포스터 없이도 둘 다 선다(#631 D3).
    await screen.findAllByTestId('ticket');
    expect(screen.getAllByTestId('ticket').length).toBe(2);
    expect(screen.queryByText('포스터가 없어요. 편집 화면에서 포스터를 추가해 주세요.')).toBeNull();
  });

  // #380 원인1 — 상단 네브가 BI v2 이전 구형 mono 10px "FILME" 텍스트(WordmarkCompact)를 그대로
  // 쓰고 있었다. MobileEditorShell(#386)과 동형인 신형 Wordmark(ClapTix 마크 + fılme 로고타입,
  // aria-label="FILME")로 통일됐는지 고정 — 구형은 시각 텍스트 자체가 대문자 "FILME"라 그 노드가
  // 없어야 회귀가 아니다.
  test('상단 네브는 신형 Wordmark를 쓴다 — 구형 mono 텍스트 아님 (#380)', async () => {
    renderStage(() => {});
    expect(await screen.findByLabelText('FILME')).toBeTruthy();
    expect(screen.queryByText('FILME')).toBeNull();
  });
});

// #380 원인2 — hero 폭 상한(100dvh 기반 예산)은 happy-dom CSSOM이 min()/env()/dvh 자체를 파싱 못
// 해 style.width로 검증 불가(기존 PREVIEW_MAX_HEIGHT의 calc(min(...))도 동일 환경 제약). 실기기
// Safari 동적 툴바 재현도 헤드리스로는 안 되므로, 이 회귀는 브라우저 뷰포트 시뮬레이션으로만 확인.
