/**
 * #441 — 체인/포맷 로고 렌더 크기(chainScale/formatScale) 회귀.
 *
 * claude-review PR #485 P1 지적 반영:
 * (1) scale이 실제 렌더 height/max-width에 반영되는지 정적 마크업으로,
 * (2) 6개 무드 호출부가 실제로 scale prop을 배선했는지(마크업 변화 유무로),
 * (3) DesignRail/DesktopDesignPanel 슬라이더가 setComp를 올바른 키로 호출하는지,
 * (4) undo(#356) 스냅샷·saveDraft/restoreSnapshot이 chainScale/formatScale을 다른
 *     컴포넌트 필드와 원자 복원하는지(스펙 s4) 훅 레벨로 검증한다.
 */
import { describe, expect, test, afterEach, beforeEach } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, cleanup, fireEvent, renderHook, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MINIMAL_STAMP_MAX_SCALE, MoodMinimal } from '../src/components/moods/MoodMinimal';
import { Mood35mm } from '../src/components/moods/Mood35mm';
import { MoodCriterion } from '../src/components/moods/MoodCriterion';
import { MoodEditorial } from '../src/components/moods/MoodEditorial';
import { MoodStub } from '../src/components/moods/MoodStub';
import { Mood35mmLandscape } from '../src/components/moods/Mood35mmLandscape';
import { STAMP_MAX_ASPECT } from '../src/components/moods/_shared';
import { DesignRail } from '../src/components/v2/DesignRail';
import { DesktopDesignPanel } from '../src/components/v2/DesktopDesignPanel';
import { usePhototicket, type HistorySnapshot } from '../src/hooks/usePhototicket';
import type { MovieInfo, TicketComponents } from '../src/types';

const MOVIE: MovieInfo = {
  title: 'TITLE', titleOg: 'ORIGINAL', releaseDate: '2026-05-01',
  releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
  reissueDate: '', isReissue: false, watchDate: '2026-05-03',
  watchDateFormat: 'kr-compact', watchTime: '20:30', theater: 'CGV',
  screen: 'IMAX', seat: 'G14', actors: 'Actor', rating: 4.5,
  runtime: '150 MIN', bookingNumber: 'BOOK-1234', signature: '@x',
};

const WITH_LOGOS: TicketComponents = {
  layout: 'minimal', chain: 'blob:chain-logo', format: 'blob:format-logo',
  chainLabel: 'MEGABOX', formatLabel: 'DOLBY',
  material: 'original', coating: 'gloss', materialIntensity: 1, coatingIntensity: 1, posterOpacity: 0.5, componentOpacity: 1, themeColor: '#FFFFFF',
  chainVisible: true, formatVisible: true, chainScale: 1, formatScale: 1, posterFit: 'cover',
};

function renderMinimal(chainScale: number, formatScale: number) {
  return renderToStaticMarkup(
    <MoodMinimal
      movieInfo={MOVIE}
      components={{ ...WITH_LOGOS, chainScale, formatScale }}
      croppedImageUrl="blob:test"
    />
  );
}

describe('#441 chainScale/formatScale — 정적 마크업 반영 (MoodMinimal)', () => {
  // PR #485 P1 후속 — Minimal은 폭 예산 초과(stampWidthCap.test.tsx #441 참고)를 막기 위해
  // 실효 scale을 MINIMAL_STAMP_MAX_SCALE(1.1)로 낮춰 잡는다. 입력 1.3은 그대로 클램프된다.
  test('scale=1.3은 MINIMAL_STAMP_MAX_SCALE로 클램프돼 max-width에 반영된다', () => {
    const html = renderMinimal(1.3, 1.3);
    expect(html).toContain(`max-width:${74 * MINIMAL_STAMP_MAX_SCALE * STAMP_MAX_ASPECT}px`);
    expect(html).toContain(`max-width:${64 * 1.02 * MINIMAL_STAMP_MAX_SCALE * STAMP_MAX_ASPECT}px`);
  });

  test('scale=0.6은 max-width에 반영된다', () => {
    const html = renderMinimal(0.6, 0.6);
    expect(html).toContain(`max-width:${74 * 0.6 * STAMP_MAX_ASPECT}px`);
    expect(html).toContain(`max-width:${64 * 1.02 * 0.6 * STAMP_MAX_ASPECT}px`);
  });

  test('scale=1(기본)은 #347 기존 상한과 픽셀 동일 — 회귀 없음', () => {
    const html = renderMinimal(1, 1);
    expect(html).toContain(`max-width:${74 * STAMP_MAX_ASPECT}px`);
    expect(html).toContain(`max-width:${64 * 1.02 * STAMP_MAX_ASPECT}px`);
  });
});

const MOODS = [
  ['minimal', MoodMinimal],
  ['35mm', Mood35mm],
  ['criterion', MoodCriterion],
  ['editorial', MoodEditorial],
  ['stub', MoodStub],
  ['35mm-landscape', Mood35mmLandscape],
] as const;

function renderMood(Mood: typeof MoodMinimal, chainScale: number, formatScale: number) {
  return renderToStaticMarkup(
    <Mood
      movieInfo={MOVIE}
      components={{ ...WITH_LOGOS, chainScale, formatScale }}
      croppedImageUrl="blob:test"
    />
  );
}

describe('#441 6개 무드 호출부 배선 — scale이 마크업에 반영(1 ≠ 1.3)', () => {
  test.each(MOODS)('%s: chainScale/formatScale=1.3 마크업이 기본(1)과 다르다', (_layout, Mood) => {
    const base = renderMood(Mood as typeof MoodMinimal, 1, 1);
    const scaled = renderMood(Mood as typeof MoodMinimal, 1.3, 1.3);
    expect(scaled).not.toBe(base);
  });
});

function RailHarness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="chainScale">{photo.state.components.chainScale}</div>
      <div data-testid="formatScale">{photo.state.components.formatScale}</div>
      <DesignRail photo={photo} />
    </>
  );
}

function PanelHarness() {
  const photo = usePhototicket();
  return (
    <>
      <div data-testid="chainScale">{photo.state.components.chainScale}</div>
      <div data-testid="formatScale">{photo.state.components.formatScale}</div>
      <DesktopDesignPanel photo={photo} />
    </>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('#441 DesignRail 슬라이더 배선', () => {
  test('체인/포맷 로고 크기 슬라이더 변경 → components에 반영', async () => {
    const user = userEvent.setup();
    render(<RailHarness />);
    // 크기 탭 안에 있음(PR #485 P2 후속 — 투명도에서 분리) — 먼저 연다.
    await user.click(screen.getByRole('button', { name: '크기' }));

    fireEvent.change(screen.getByLabelText('체인 로고 크기'), { target: { value: '0.6' } });
    fireEvent.change(screen.getByLabelText('포맷 로고 크기'), { target: { value: '1.3' } });

    expect(screen.getByTestId('chainScale').textContent).toBe('0.6');
    expect(screen.getByTestId('formatScale').textContent).toBe('1.3');
  });
});

describe('#441 DesktopDesignPanel 슬라이더 배선', () => {
  test('체인/포맷 로고 크기 슬라이더 변경 → components에 반영(상시 렌더 — 탭 없음)', () => {
    render(<PanelHarness />);
    fireEvent.change(screen.getByLabelText('체인 로고 크기'), { target: { value: '0.6' } });
    fireEvent.change(screen.getByLabelText('포맷 로고 크기'), { target: { value: '1.3' } });

    expect(screen.getByTestId('chainScale').textContent).toBe('0.6');
    expect(screen.getByTestId('formatScale').textContent).toBe('1.3');
  });
});

describe('#441 undo(#356)·임시저장 원자 복원', () => {
  test('restoreSnapshot은 chainScale/formatScale을 다른 필드와 함께 원자 복원한다', () => {
    const { result } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateComponents({ chainScale: 0.6, formatScale: 1.3, themeColor: '#111111' });
    });
    expect(result.current.state.components.chainScale).toBe(0.6);

    const snap: HistorySnapshot = {
      movieInfo: result.current.state.movieInfo,
      components: { ...result.current.state.components, chainScale: 1, formatScale: 1, themeColor: '#FFFFFF' },
      fieldVisibility: result.current.state.fieldVisibility,
    };
    act(() => {
      result.current.restoreSnapshot(snap);
    });

    expect(result.current.state.components.chainScale).toBe(1);
    expect(result.current.state.components.formatScale).toBe(1);
    expect(result.current.state.components.themeColor).toBe('#FFFFFF');
  });

  test('saveDraft()는 chainScale/formatScale을 저장하고, 재마운트 시 복원된다', async () => {
    const { result, unmount } = renderHook(() => usePhototicket());
    act(() => {
      result.current.updateComponents({ chainScale: 0.6, formatScale: 1.3 });
    });
    act(() => {
      result.current.saveDraft();
    });
    unmount();

    const { result: reloaded } = renderHook(() => usePhototicket());
    await waitFor(() => {
      expect(reloaded.current.state.components.chainScale).toBe(0.6);
      expect(reloaded.current.state.components.formatScale).toBe(1.3);
    });
  });
});
