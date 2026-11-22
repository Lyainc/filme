/**
 * #826 S4 — 입력 · 키보드(마스터 K-01 · K-03 · K-08) 상호작용 잠금.
 *
 * Seed docs/specs/826-s4-input-keyboard.yaml의 acceptance-2 · 4 · 5 · 6 · 7을 여기서 잡는다. 순수 함수(acceptance-3)는
 * inputKeyboard.test.ts. happy-dom은 레이아웃이 없어 rect가 0이다 — 키보드는 visualViewport 스텁으로 넣고 패널 자리는
 * style(bottom · paddingBottom)로, 배율은 래퍼 transform 문자열로 본다. 실제 rect(키보드 윗변 차 · 교차 면적 · 넘침)는
 * 헤드리스 표본 scripts/measure-keyboard-panel.mjs가 잰다(acceptance-10).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { usePhototicket } from '@/hooks/usePhototicket';
import { MobileEditorShell } from '@/components/v2/MobileEditorShell';
import Home from '@/pages/index';
import { keyboardPanelStyle } from '@/hooks/useInputKeyboard';
import { mobileShellProps } from './shellHarness';

const FRAME_H = 852;
const KB = 330;

// ── visualViewport 스텁(393×852 프레임) ────────────────────────────────────────
// 셸 안 테스트엔 #phone-frame이 없거나(Harness) rect가 0이라(Home) getFrameRect가 창으로 폴백한다 — 창 높이를 852로 맞춘다.
const realInnerHeight = window.innerHeight;
let vv: (EventTarget & { offsetTop: number; height: number; width: number; scale: number }) | null = null;
function stubKeyboard(kb: number) {
  vv = Object.assign(new EventTarget(), { offsetTop: 0, height: FRAME_H - kb, width: 393, scale: 1 });
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: FRAME_H, configurable: true });
}
function setKeyboard(kb: number) {
  act(() => {
    vv!.height = FRAME_H - kb;
    vv!.dispatchEvent(new Event('resize'));
  });
}

const tick = (ms = 20) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

function Harness({ layout }: { layout?: 'editorial' | 'criterion' } = {}) {
  const photo = usePhototicket();
  const { movieInfo: m } = photo.state;
  return (
    <>
      <div data-testid="probe" data-theater={m.theater} data-title={m.title} />
      <button
        type="button"
        onClick={() => {
          photo.handleImageUpload('blob:test-poster');
          photo.updateMovieInfo({ title: 'TITLE0', theater: 'CGV0', seat: 'H12', releaseDate: '2024-05-01', quote: '파도 소리' });
          if (layout) photo.updateComponents({ layout });
        }}
      >
        seed
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

const dock = () => screen.getByTestId('dock-body');
const panelNamed = (label: string) => screen.queryByRole('group', { name: `${label} 입력` });
const anyPanel = () => screen.queryAllByRole('group', { name: / 입력$/ });
const backdrop = () => document.querySelector('div.fixed.inset-0.z-40[aria-hidden="true"]') as HTMLElement;
const wrapper = () => document.querySelector('.crop-marks') as HTMLElement;
const transformOf = () => wrapper().style.transform;
const liftOf = () => Number(/translateY\((-?[\d.]+)px\)/.exec(transformOf())?.[1] ?? NaN);
const selected = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}`) }).getAttribute('aria-selected');
const openRow = async (label: string) => {
  fireEvent.click(within(dock()).getByRole('button', { name: new RegExp(`^${label} (?!티켓에 표시)`) }));
  return screen.findByRole('group', { name: `${label} 입력` });
};
const historyState = () => window.history.state as Record<string, unknown> | null;
const onPanelEntry = () => !!historyState()?.phototicketInputPanel;
/** 앞 테스트가 남긴 앞으로 항목을 잘라 내고 기준 항목 위에 선다 — happy-dom 창은 파일 안에서 history를 공유한다. */
const baseEntry = () => {
  window.history.pushState({ base: Math.random() }, '');
  return { length: window.history.length, state: historyState() };
};

/** 무대(래퍼의 부모)의 크기를 정한다 — 셸이 이 rect로 min(1.18, 무대 폭 ÷ 맞춤 폭)을 잰다. */
function stubStage(width: number, height: number) {
  const stage = wrapper().parentElement as HTMLElement;
  stage.getBoundingClientRect = () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
}

type Exit = 'close' | 'keyboard' | 'outside' | 'back';
const EXITS: Exit[] = ['close', 'keyboard', 'outside', 'back'];

/** 네 종료 경로(K-08). 키보드 내림은 입력의 blur(relatedTarget 없음, 포인터 없음) — iOS '완료' · 키보드 내리기와 같은 신호다. */
async function exitBy(path: Exit, panel: HTMLElement) {
  if (path === 'close') fireEvent.click(within(panel).getByRole('button', { name: '닫기' }));
  else if (path === 'outside') fireEvent.click(backdrop());
  else if (path === 'keyboard') {
    const input = panel.querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    act(() => input.blur());
  } else await act(async () => { window.history.back(); });
  // 키보드 내림 판정은 한 틱 미뤄지고, 닫기 · 바깥 탭 · 키보드 내림은 history.back()의 popstate가 비동기로 온다.
  await tick();
}

beforeEach(() => {
  window.localStorage.clear();
  stubKeyboard(KB);
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete (window as { visualViewport?: unknown }).visualViewport;
  Object.defineProperty(window, 'innerHeight', { value: realInnerHeight, configurable: true });
});

describe('constraint-3 — 패널은 키보드 윗변(없으면 프레임 바닥 + 안전 영역)에 틈 없이 붙는다 (acceptance-2)', () => {
  // happy-dom은 env()가 든 calc를 style에 못 싣는다 — 여백 규칙은 패널이 쓰는 그 함수로 잠근다.
  test('여백: 키보드가 있으면 8px, 없으면 8px + 아래 안전 영역', () => {
    expect(keyboardPanelStyle(KB)).toEqual({ bottom: KB, paddingBottom: 8 });
    expect(keyboardPanelStyle(0)).toEqual({ bottom: 0, paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' });
  });

  test('텍스트 패널: 키보드 330이면 bottom 330(+12 없음), 키보드 0이면 bottom 0 + 안전 영역 여백', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const panel = await openRow('극장');
    expect(panel.style.bottom).toBe(`${KB}px`);
    setKeyboard(0);
    expect(panel.style.bottom).toBe('0px');
  });

  test('평점 패널(키보드 없는 스테퍼)도 같은 규칙이다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const panel = await openRow('평점');
    setKeyboard(0);
    expect(panel.style.bottom).toBe('0px');
    setKeyboard(KB);
    expect(panel.style.bottom).toBe(`${KB}px`);
  });

  test('글꼴 목록이 열려 키보드가 내려간 동안 목록을 품은 패널 아래 끝이 바닥에 붙는다', async () => {
    render(<Harness layout="criterion" />);
    fireEvent.click(screen.getByText('seed'));
    const panel = await openRow('한줄평');
    fireEvent.click(within(panel).getByRole('button', { name: /^한줄평 글꼴, 지금/ }));
    expect(!!within(panel).queryByRole('listbox')).toBe(true);
    setKeyboard(0);
    expect(panel.style.bottom).toBe('0px');
    setKeyboard(KB);
    expect(panel.style.bottom).toBe(`${KB}px`);
  });
});

describe('constraint-5 — 입력 중 확대 · 리프트 (acceptance-4)', () => {
  test('세로 무드: scale(1.18) · translateY ≤ 0, 타이핑으로 translateY가 안 변하고 닫으면 항등이다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    stubStage(361, 400);
    const panel = await openRow('극장');
    expect(transformOf()).toContain('scale(1.18)');
    const lift = liftOf();
    expect(lift <= 0).toBe(true);
    fireEvent.change(within(panel).getByRole('textbox', { name: '극장' }), { target: { value: 'CGV 용산' } });
    fireEvent.change(within(panel).getByRole('textbox', { name: '극장' }), { target: { value: 'CGV 용산아이파크몰' } });
    expect(liftOf()).toBe(lift);
    fireEvent.click(within(panel).getByRole('button', { name: '닫기' }));
    expect(transformOf()).toBe('translateY(0) scale(1)');
  });

  test('가로 무드(editorial): 맞춤 폭 = 무대 폭이라 scale(1)이다(D17-1 A)', async () => {
    render(<Harness layout="editorial" />);
    fireEvent.click(screen.getByText('seed'));
    stubStage(361, 400);
    const panel = await openRow('극장');
    expect(transformOf()).toContain('scale(1)');
    expect(transformOf()).not.toContain('scale(1.');
    expect(liftOf() <= 0).toBe(true);
    fireEvent.click(within(panel).getByRole('button', { name: '닫기' }));
    expect(transformOf()).toBe('translateY(0) scale(1)');
  });
});

describe('constraint-6 — 종료 경로 4 × 진입 상태 3 (acceptance-5)', () => {
  const ENTRIES = [
    { name: '정보 모드', mode: '정보', tool: null as string | null },
    { name: '사진 모드', mode: '사진', tool: null },
    { name: '디자인 모드 · 투명도 도구', mode: '디자인', tool: '투명도' },
  ];
  for (const entry of ENTRIES) {
    test(`${entry.name}에서 열고 닫기 · 키보드 내림 · 바깥 탭 · 뒤로 모두 같은 모드 · 도구, 항등 transform, 입력값 유지`, async () => {
      render(<Harness />);
      fireEvent.click(screen.getByText('seed'));
      for (const path of EXITS) {
        fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${entry.mode}`) }));
        if (entry.tool) fireEvent.click(screen.getByRole('tab', { name: entry.tool }));
        // 정보 모드는 목록 행으로, 나머지는 티켓 필드 탭으로 들어온다(두 진입 모두 같은 패널).
        if (entry.mode === '정보') await openRow('극장');
        else fireEvent.click(screen.getByRole('button', { name: '극장 편집' }));
        const panel = await screen.findByRole('group', { name: '극장 입력' });
        const value = `CGV-${entry.mode}-${path}`;
        fireEvent.change(within(panel).getByRole('textbox', { name: '극장' }), { target: { value } });

        await exitBy(path, panel);

        expect({ path, open: anyPanel().length }).toEqual({ path, open: 0 });
        expect(selected(entry.mode)).toBe('true');
        if (entry.tool) expect(screen.getByRole('tab', { name: entry.tool }).getAttribute('aria-selected')).toBe('true');
        expect(transformOf()).toBe('translateY(0) scale(1)');
        expect(screen.getByTestId('probe').getAttribute('data-theater')).toBe(value);
      }
    });
  }

  test('#776 — 필수 누락 바로가기로 연 숨긴 개봉일은 네 경로 모두에서 다시 숨는다', async () => {
    window.localStorage.setItem(
      'filme:phototicket:v1',
      JSON.stringify({ movieInfo: { title: '영화', releaseDate: '' }, fieldVisibility: { releaseDate: false } })
    );
    render(<Home />);
    fireEvent.click(await screen.findByTestId('landing-restore'));
    await tick(350);
    const releaseShown = () => within(dock()).getByRole('button', { name: '개봉일 티켓에 표시' }).getAttribute('aria-pressed');
    const topDone = () => within(document.querySelector('header') as HTMLElement).getByRole('button', { name: '완료' });
    for (const path of EXITS) {
      fireEvent.click(topDone()); // 미완료 완료 → 정보 모드 · 누락 행 강조
      fireEvent.click(within(dock()).getByRole('button', { name: /^개봉일 (?!티켓에 표시)/ }));
      const panel = await screen.findByRole('group', { name: '개봉일 입력' });
      expect(releaseShown()).toBe('true');
      await exitBy(path, panel);
      expect({ path, open: anyPanel().length }).toEqual({ path, open: 0 });
      expect(releaseShown()).toBe('false');
    }
  });
});

describe('constraint-6 history — 뒤로 = 닫기, 다른 경로는 항목을 소비한다 (acceptance-6)', () => {
  test('열면 항목이 하나 늘고, 뒤로로 닫으면 편집 화면에 남는다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const before = baseEntry().length;
    const panel = await openRow('극장');
    expect(window.history.length).toBe(before + 1);
    expect(onPanelEntry()).toBe(true);
    await exitBy('back', panel);
    expect(anyPanel().length).toBe(0);
    expect(!!screen.queryByTestId('editor-dock')).toBe(true);
    expect(onPanelEntry()).toBe(false);
  });

  test('닫기 · 키보드 내림 · 바깥 탭으로 닫으면 열기 전 항목으로 돌아가고, 열기 → 닫기를 반복해도 길이가 늘지 않는다', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('seed'));
    const { length: before, state: stateBefore } = baseEntry();
    for (const path of ['close', 'keyboard', 'outside', 'close', 'keyboard', 'outside'] as Exit[]) {
      const panel = await openRow('극장');
      expect(onPanelEntry()).toBe(true);
      await exitBy(path, panel);
      expect(anyPanel().length).toBe(0);
      // 현재 위치가 열기 전 항목이다 — 뒤로를 한 번 더 눌러야 하는 빈 항목이 없다. back()은 앞으로 항목을 남겨
      // history.length 자체는 줄지 않지만, 다음 열기의 push가 그 항목을 갈아 끼워 길이가 쌓이지 않는다.
      expect(historyState()).toEqual(stateBefore);
      expect(window.history.length <= before + 1).toBe(true);
    }
  });
});

describe('constraint-7 — 종료가 아닌 것 (acceptance-7)', () => {
  async function openKept(layout?: 'criterion') {
    render(<Harness layout={layout} />);
    fireEvent.click(screen.getByText('seed'));
    await openRow('극장');
    return window.history.length;
  }
  const stillOpen = (len: number) => {
    expect(anyPanel().length).toBe(1);
    expect(window.history.length).toBe(len);
    expect(onPanelEntry()).toBe(true);
  };

  test('‹ › · Return 이동', async () => {
    const len = await openKept();
    fireEvent.click(within(anyPanel()[0]).getByRole('button', { name: '다음 항목' }));
    await tick();
    stillOpen(len);
    fireEvent.click(within(anyPanel()[0]).getByRole('button', { name: '이전 항목' }));
    await tick();
    stillOpen(len);
    // Return — 입력이 다시 마운트되며 잠깐 포커스가 비어도 종료가 아니다.
    const input = anyPanel()[0].querySelector('input') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    stillOpen(len);
  });

  test('티켓의 다른 필드 탭', async () => {
    const len = await openKept();
    fireEvent.click(screen.getByRole('button', { name: '제목 편집' }));
    await tick();
    stillOpen(len);
    expect(!!panelNamed('제목')).toBe(true);
  });

  test('글꼴 목록 열기(입력 blur 포함)와 패널 칩 조작', async () => {
    const len = await openKept('criterion');
    fireEvent.click(within(dock()).getByRole('button', { name: /^한줄평 (?!티켓에 표시)/ }));
    const quote = await screen.findByRole('group', { name: '한줄평 입력' });
    const input = within(quote).getByRole('textbox', { name: '한줄평' });
    act(() => input.focus());
    fireEvent.click(within(quote).getByRole('button', { name: /^한줄평 글꼴, 지금/ }));
    await tick();
    expect(!!within(quote).queryByRole('listbox')).toBe(true);
    stillOpen(len);
    // 칩(다음 글꼴)
    fireEvent.click(within(quote).getByRole('button', { name: '다음 글꼴' }));
    await tick();
    stillOpen(len);
  });
});
