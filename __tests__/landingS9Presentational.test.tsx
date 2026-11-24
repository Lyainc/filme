/**
 * #826 S9 랜딩 표현층(D25-12) — Landing · LandingAttachSheet · LandingNoticeSheet를 셸 없이 stub props로 단독 렌더한다.
 * 문서 수명 · 스냅샷 · OCR 배선은 셸 쪽 테스트의 몫이고, 여기는 DOM · 접근성 · 타이밍만 잠근다(S9 constraint-3~8 · 10~12).
 * `received`에 DOM 엘리먼트를 넣지 않는다(docs/TESTING.md 8절).
 */
import { describe, expect, test, afterEach, mock, jest } from 'bun:test';
import { render, screen, cleanup, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext, useEffect } from 'react';
import type { ComponentProps } from 'react';
import { Landing, LandingSlotContext, GALLERY_LAYOUTS } from '@/components/v2/Landing';
import type { LayoutId } from '@/types';

type Props = ComponentProps<typeof Landing>;

function setup(over: Partial<Props> = {}) {
  const fns = {
    onRestore: mock(() => {}),
    onDirect: mock((_l: LayoutId) => {}),
    onOpenSheet: mock((_l: LayoutId) => {}),
    onPickScreenshot: mock(() => {}),
    onPickPoster: mock(() => {}),
    onMake: mock(() => {}),
    onCloseSheet: mock(() => {}),
  };
  const props: Props = {
    mode: 'overlay',
    restoreTitle: '',
    sheet: null,
    livePreview: null,
    ...fns,
    children: <span data-testid="ocr-slot" />,
    ...over,
  };
  const r = render(<Landing {...props} />);
  return { fns, props, ...r };
}

const sheetOf = (o: Partial<NonNullable<Props['sheet']>> = {}): NonNullable<Props['sheet']> => ({
  screenshot: { kind: 'empty' },
  posterThumb: null,
  canMake: false,
  ...o,
});

function stubReducedMotion(matches: boolean) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

const card = (label: string) => screen.getByRole('button', { name: label });
const active = () =>
  GALLERY_LAYOUTS.findIndex((l) => card(l.label).getAttribute('aria-pressed') === 'true');

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe('랜딩 레이아웃 (constraint-3)', () => {
  test('헤드라인 · 빔 · details · 인덱스 · 링크 쌍이 없고 진행 막대는 aria-hidden', () => {
    setup();
    expect(screen.queryByRole('heading', { level: 1 }) === null).toBe(true);
    expect(screen.queryByTestId('mood-gallery-beam') === null).toBe(true);
    expect(screen.queryByTestId('mood-gallery-index') === null).toBe(true);
    expect(screen.queryByTestId('landing-exit-paths') === null).toBe(true);
    expect(screen.queryByTestId('legal-notice') === null).toBe(true);
    expect(screen.queryByTestId('landing-panel') === null).toBe(true);
    expect(screen.queryByText('포스터 업로드') === null).toBe(true);
    expect(screen.getByTestId('mood-gallery-progress').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('mood-gallery-progress').children.length).toBe(GALLERY_LAYOUTS.length);
  });

  test('주 버튼 · 직접 입력 · 이용 고지 · OCR 슬롯', () => {
    setup();
    expect(screen.getByTestId('landing-cta').textContent).toContain('티켓 스크린샷으로 자동입력');
    expect(screen.getByTestId('landing-skip-poster').textContent).toBe('직접 입력');
    expect(!!screen.getByRole('button', { name: '이용 고지' })).toBe(true);
    expect(!!within(screen.getByTestId('landing-card-slot')).getByTestId('ocr-slot')).toBe(true);
  });

  test('이용 고지는 작은 시트로 열리고 닫힌다', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: '이용 고지' }));
    const dlg = screen.getByRole('dialog', { name: '이용 고지' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.textContent).toContain('© FILME');
    expect(!!within(dlg).getByRole('link', { name: 'GitHub 저장소' })).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog') === null).toBe(true);
    expect(document.activeElement === screen.getByRole('button', { name: '이용 고지' })).toBe(true);
    await user.click(screen.getByRole('button', { name: '이용 고지' }));
    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog') === null).toBe(true);
  });
});

describe('고르기 (constraint-5 · 7)', () => {
  test('옆 카드 탭은 고르기만 하고 진입하지 않는다 · 가운데 탭은 no-op', async () => {
    const user = userEvent.setup();
    const { fns } = setup();
    const names = GALLERY_LAYOUTS.map((l) => l.label);
    expect(card(names[0]).getAttribute('aria-pressed')).toBe('true');
    await user.click(card(names[1]));
    expect(card(names[1]).getAttribute('aria-pressed')).toBe('true');
    expect(card(names[0]).getAttribute('aria-pressed')).toBe('false');
    await user.click(card(names[1]));
    expect(card(names[1]).getAttribute('aria-pressed')).toBe('true');
    expect(fns.onDirect).not.toHaveBeenCalled();
    expect(fns.onOpenSheet).not.toHaveBeenCalled();
    expect(!!screen.getByTestId('landing')).toBe(true);
  });

  test('재단 표시는 가운데 카드에만 있다', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getAllByTestId('mood-crop-marks').length).toBe(1);
    await user.click(card(GALLERY_LAYOUTS[4].label)); // 두 칸 밖 카드는 pointer-events none이라 한 칸 옆(원형)을 고른다
    const marks = screen.getAllByTestId('mood-crop-marks');
    expect(marks.length).toBe(1);
    expect(marks[0].closest('button')?.getAttribute('aria-label')).toBe(GALLERY_LAYOUTS[4].label);
  });

  test('키보드 포커스가 간 카드가 가운데로 온다', () => {
    setup();
    act(() => card(GALLERY_LAYOUTS[3].label).focus());
    expect(card(GALLERY_LAYOUTS[3].label).getAttribute('aria-pressed')).toBe('true');
  });

  test('직접 입력과 주 버튼이 고른 무드를 넘긴다 (기본은 첫 카드)', async () => {
    const user = userEvent.setup();
    const { fns } = setup();
    await user.click(screen.getByTestId('landing-skip-poster'));
    expect(fns.onDirect).toHaveBeenLastCalledWith(GALLERY_LAYOUTS[0].id);
    await user.click(card(GALLERY_LAYOUTS[1].label));
    await user.click(screen.getByTestId('landing-skip-poster'));
    expect(fns.onDirect).toHaveBeenLastCalledWith(GALLERY_LAYOUTS[1].id);
    await user.click(screen.getByTestId('landing-cta'));
    expect(fns.onOpenSheet).toHaveBeenLastCalledWith(GALLERY_LAYOUTS[1].id);
  });
});

describe('동작 줄이기 격자 (constraint-6)', () => {
  test('3열 격자에서 탭이 고르기이고 고른 카드만 aria-pressed · 재단 표시', async () => {
    const restore = stubReducedMotion(true);
    try {
      const user = userEvent.setup();
      const { fns } = setup();
      expect(!!screen.getByRole('region', { name: '무드 전시(동작 줄이기)' })).toBe(true);
      expect(screen.queryByTestId('mood-gallery-progress') === null).toBe(true);
      await user.click(card(GALLERY_LAYOUTS[2].label));
      const pressed = GALLERY_LAYOUTS.filter((l) => card(l.label).getAttribute('aria-pressed') === 'true');
      expect(pressed.map((l) => l.id)).toEqual([GALLERY_LAYOUTS[2].id]);
      expect(screen.getAllByTestId('mood-crop-marks').length).toBe(1);
      expect(fns.onDirect).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});

describe('자동 전환 (constraint-4)', () => {
  test('4000ms마다 한 칸, 시트가 열린 동안은 8000ms가 지나도 안 넘어가고 닫으면 4000ms 뒤 넘어간다', () => {
    jest.useFakeTimers();
    const { rerender, props } = setup();
    expect(active()).toBe(0);
    act(() => jest.advanceTimersByTime(4000));
    expect(active()).toBe(1);
    rerender(<Landing {...props} sheet={sheetOf()} />);
    act(() => jest.advanceTimersByTime(8000));
    expect(active()).toBe(1);
    rerender(<Landing {...props} sheet={null} />);
    act(() => jest.advanceTimersByTime(4000));
    expect(active()).toBe(2);
  });

  test('이용 고지 시트가 열린 동안에도 멈춘다', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    setup();
    await user.click(screen.getByRole('button', { name: '이용 고지' }));
    act(() => jest.advanceTimersByTime(8000));
    expect(active()).toBe(0);
  });
});

describe('첨부 시트 (constraint-8 · 10 · 11)', () => {
  test('dialog 의미 · 포커스 안 · Escape · 닫기 · 시트 밖 탭', async () => {
    const user = userEvent.setup();
    const { fns } = setup({ sheet: sheetOf() });
    const dlg = screen.getByRole('dialog', { name: '티켓과 포스터' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(fns.onCloseSheet).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(fns.onCloseSheet).toHaveBeenCalledTimes(2);
    await user.click(screen.getByTestId('landing-sheet-catcher'));
    expect(fns.onCloseSheet).toHaveBeenCalledTimes(3);
  });

  test('Tab은 시트 안에서 순환한다', async () => {
    const user = userEvent.setup();
    setup({ sheet: sheetOf({ canMake: true }) });
    const dlg = screen.getByRole('dialog');
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dlg.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dlg.contains(document.activeElement)).toBe(true);
  });

  test('닫히면 주 버튼으로 포커스가 돌아온다', () => {
    const { rerender, props } = setup({ sheet: sheetOf() });
    rerender(<Landing {...props} sheet={null} />);
    expect(document.activeElement === screen.getByTestId('landing-cta')).toBe(true);
  });

  test('시트가 열린 동안 아래 버튼은 숨고 옆 카드는 투명해진다', () => {
    setup({ sheet: sheetOf() });
    expect(screen.getByTestId('landing-bottom').className).toContain('hidden');
    expect(card(GALLERY_LAYOUTS[1].label).style.opacity).toBe('0');
  });

  test('만들기는 canMake가 아니면 aria-disabled이고 눌러도 아무 일이 없다', async () => {
    const user = userEvent.setup();
    const { fns, rerender, props } = setup({ sheet: sheetOf({ canMake: false }) });
    const make = screen.getByRole('button', { name: '만들기' });
    expect(make.getAttribute('aria-disabled')).toBe('true');
    await user.click(make);
    expect(fns.onMake).not.toHaveBeenCalled();
    rerender(<Landing {...props} sheet={sheetOf({ canMake: true })} />);
    const on = screen.getByRole('button', { name: '만들기' });
    expect(on.getAttribute('aria-disabled') === null).toBe(true);
    await user.click(on);
    expect(fns.onMake).toHaveBeenCalledTimes(1);
  });

  test('행 버튼이 각 입력을 연다', async () => {
    const user = userEvent.setup();
    const { fns } = setup({ sheet: sheetOf() });
    await user.click(screen.getByTestId('landing-sheet-screenshot'));
    expect(fns.onPickScreenshot).toHaveBeenCalledTimes(1);
    await user.click(screen.getByTestId('landing-sheet-poster'));
    expect(fns.onPickPoster).toHaveBeenCalledTimes(1);
  });

  test('스크린샷 행 상태: 없음 · 인식 중 · 인식했어요 · 오류(warn)', () => {
    const shot = () => screen.getByTestId('landing-sheet-screenshot');
    const { rerender, props } = setup({ sheet: sheetOf() });
    expect(shot().textContent).not.toMatch(/인식/);
    rerender(<Landing {...props} sheet={sheetOf({ screenshot: { kind: 'busy' } })} />);
    expect(shot().textContent).toContain('인식 중');
    rerender(<Landing {...props} sheet={sheetOf({ screenshot: { kind: 'done' } })} />);
    expect(shot().textContent).toContain('인식했어요');
    rerender(
      <Landing {...props} sheet={sheetOf({ screenshot: { kind: 'error', message: '정보를 못 찾았어요' } })} />,
    );
    const err = screen.getByTestId('landing-sheet-screenshot-error');
    expect(err.textContent).toBe('정보를 못 찾았어요');
    expect(err.className).toContain('text-warn');
  });

  test('포스터 행: 비면 선택, 넣으면 썸네일', () => {
    const { rerender, props } = setup({ sheet: sheetOf() });
    expect(screen.getByTestId('landing-sheet-poster').textContent).toContain('선택');
    expect(screen.queryByTestId('landing-sheet-poster-thumb') === null).toBe(true);
    rerender(<Landing {...props} sheet={sheetOf({ posterThumb: 'blob:thumb' })} />);
    expect(screen.getByTestId('landing-sheet-poster-thumb').getAttribute('src')).toBe('blob:thumb');
    expect(screen.getByTestId('landing-sheet-poster').textContent).not.toContain('선택');
  });

  test('livePreview는 시트가 열린 동안 가운데 카드 자리에 서고 정적 견본을 대신한다', () => {
    const { rerender, props } = setup({ sheet: null, livePreview: <div data-testid="live-ticket" /> });
    expect(screen.queryByTestId('live-ticket') === null).toBe(true);
    expect(card(GALLERY_LAYOUTS[0].label).querySelector('img') !== null).toBe(true);
    rerender(<Landing {...props} sheet={sheetOf()} />);
    const centre = card(GALLERY_LAYOUTS[0].label);
    expect(!!within(centre).getByTestId('live-ticket')).toBe(true);
    expect(centre.querySelector('img') === null).toBe(true);
    expect(!!within(centre).getByTestId('mood-crop-marks')).toBe(true);
  });

  test('LandingSlotContext 안내가 스크린샷 행에 오류로, busy가 인식 중으로 뜬다', () => {
    let ctx: React.ContextType<typeof LandingSlotContext> = null;
    const Probe = () => {
      const c = useContext(LandingSlotContext);
      useEffect(() => {
        ctx = c;
      }, [c]);
      return null;
    };
    setup({ sheet: sheetOf(), children: <Probe /> });
    act(() => ctx!.setBusy(true));
    expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('인식 중');
    act(() => ctx!.setNotice('잠시 뒤에 다시 해 주세요'));
    expect(screen.getByTestId('landing-sheet-screenshot-error').textContent).toBe('잠시 뒤에 다시 해 주세요');
    expect(screen.queryByTestId('landing-notice') === null).toBe(true);
  });
});
