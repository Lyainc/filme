/**
 * #826 S2 D-01~D-05 — 도크 디자인 모드. 옛 DesignRail 아이콘 레일(designRail*.test)의 무드·색상·투명도·크기
 * 계약을 도구 줄(tablist)로 옮겨 잠근다. 질감은 재질/코팅 두 도구로 갈렸고(D-03), 포스터 재크롭은 사진 모드로
 * 갔으며(G-01), 스탬프·커스텀은 디자인 도구가 아니다.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { MoodMinimal } from '@/components/moods/MoodMinimal';
import type { MovieInfo } from '@/types';
import { DockHarness, dockProbe, resetDockProbe } from './dockHarness';
import { assertNoShrink, expectMeetsAA } from './tapTargets';

beforeEach(() => {
  window.localStorage.clear();
  resetDockProbe();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const tools = () => screen.getAllByRole('tab', { name: /^(무드|색상|재질|코팅|투명도|크기)$/ });

describe('디자인 도구 줄 (C-TOOLS)', () => {
  test('도구는 무드 · 색상 · 재질 · 코팅 · 투명도 · 크기 순이고 첫 도구(무드)가 선택돼 있다', () => {
    render(<DockHarness />);
    expect(screen.getByRole('tablist', { name: '디자인 도구' })).not.toBeNull();
    expect(tools().map((t) => t.textContent)).toEqual(['무드', '색상', '재질', '코팅', '투명도', '크기']);
    expect(tools().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false']);
    // 옛 레일 항목 '커스텀'(폰트)·'스탬프'는 디자인 도구가 아니다.
    expect(screen.queryByRole('tab', { name: '커스텀' }) === null).toBe(true);
    expect(screen.queryByRole('tab', { name: '스탬프' }) === null).toBe(true);
  });

  test('도구는 탭을 눌러 고르고, 한 번에 하나만 선택된다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    await user.click(screen.getByRole('tab', { name: '투명도' }));
    expect(tools().filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.textContent)).toEqual(['투명도']);
    expect(screen.getByRole('tabpanel', { name: '투명도' })).not.toBeNull();
  });

  test('방향키가 이웃 도구로 포커스와 선택을 옮긴다 (APG tabs)', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    const first = screen.getByRole('tab', { name: '무드' });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: '색상' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: '색상' }));
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: '크기' }).getAttribute('aria-selected')).toBe('true');
    await user.keyboard('{ArrowRight}'); // 끝에서 처음으로 순환
    expect(screen.getByRole('tab', { name: '무드' }).getAttribute('aria-selected')).toBe('true');
  });

  test('선택된 탭만 tab 순서에 든다(roving tabindex)', () => {
    render(<DockHarness />);
    expect(tools().map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1', '-1']);
  });

  test('도구 탭이 44px 타깃이다 (SC 2.5.8)', () => {
    render(<DockHarness />);
    // 폭은 라벨 내용이 정하므로(파서가 못 읽는다) 높이 선언만 고정하고 축소 우회를 막는다.
    for (const t of tools()) {
      assertNoShrink(t, `도구 탭 ${t.textContent}`);
      expect((t.getAttribute('class') ?? '').split(/\s+/)).toContain('h-touch');
    }
  });
});

describe('무드 (D-01)', () => {
  test('무드 카드를 고르면 photo.state.components.layout에 반영된다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    expect(dockProbe.photo!.state.components.layout).toBe('minimal');
    await user.click(screen.getByRole('radio', { name: /크라이테리언/ }));
    expect(dockProbe.photo!.state.components.layout).toBe('criterion');
  });

  test('선택된 무드 카드만 aria-checked다', async () => {
    render(<DockHarness />);
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked.length).toBe(1);
    expect(checked[0]).toBe(screen.getByRole('radio', { name: /미니멀/ }));
  });
});

describe('색상 (D-02)', () => {
  test('색 고정 무드(criterion)는 견본이 비활성이고 한 줄 사유가 선다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    await user.click(screen.getByRole('radio', { name: /크라이테리언/ }));
    await user.click(screen.getByRole('tab', { name: '색상' }));
    expect(screen.getByText('이 무드는 색이 고정돼요')).not.toBeNull();
    // 색상 탭 자체는 그대로 있다 — 잠금은 숨김이 아니다.
    expect(screen.getByRole('tab', { name: '색상' })).not.toBeNull();
  });

  test('색을 바꿀 수 있는 무드엔 고정 사유가 없다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    await user.click(screen.getByRole('tab', { name: '색상' }));
    expect(screen.queryByText('이 무드는 색이 고정돼요') === null).toBe(true);
  });
});

describe('재질 · 코팅 (D-03)', () => {
  test('재질 도구는 재질 피커만, 코팅 도구는 코팅 피커만 그리고 각자 강도 슬라이더를 든다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    await user.click(screen.getByRole('tab', { name: '재질' }));
    expect(screen.queryByRole('radiogroup', { name: '재질' })).not.toBeNull();
    expect(screen.queryByRole('radiogroup', { name: '코팅' }) === null).toBe(true);
    // 기본 재질은 원본이라 강도 슬라이더가 없다.
    expect(screen.queryByLabelText('재질 강도') === null).toBe(true);

    await user.click(screen.getByRole('tab', { name: '코팅' }));
    expect(screen.queryByRole('radiogroup', { name: '재질' }) === null).toBe(true);
    expect(screen.queryByRole('radiogroup', { name: '코팅' })).not.toBeNull();
    // 기본 코팅(유광)은 레시피가 있어 강도 슬라이더가 선다.
    expect(screen.queryByLabelText('코팅 강도')).not.toBeNull();
  });

  test('옛 후보정 축 세그먼트는 없다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    await user.click(screen.getByRole('tab', { name: '재질' }));
    expect(screen.queryByRole('radiogroup', { name: '후보정 축' }) === null).toBe(true);
  });

  test('재질 칩(TexturePicker 46×46)이 24px 하한을 넘는다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    await user.click(screen.getByRole('tab', { name: '재질' }));
    const chips = Array.from(screen.getByRole('radiogroup', { name: '재질' }).querySelectorAll('[role=radio]'));
    expect(chips.length).toBeGreaterThan(1);
    for (const chip of chips) {
      for (const el of [chip, ...Array.from(chip.querySelectorAll('*'))]) assertNoShrink(el, '재질 칩 서브트리');
      const swatch = chip.querySelector('[style*="width"]');
      expect(swatch).not.toBeNull();
      expect(expectMeetsAA(swatch!, `재질 칩 ${chip.textContent}`)).toEqual({ w: 46, h: 46 });
    }
  });
});

describe('투명도 (D-04)', () => {
  test('컴포넌트 슬라이더 변경이 components.componentOpacity에 반영된다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    await user.click(screen.getByRole('tab', { name: '투명도' }));
    const slider = screen.getByLabelText('컴포넌트') as HTMLInputElement;
    slider.focus();
    await user.keyboard('{ArrowLeft}');
    expect(dockProbe.photo!.state.components.componentOpacity).toBeLessThan(1);
  });
});

describe('크기 (D-05)', () => {
  const MOVIE: MovieInfo = {
    title: 'TITLE', titleOg: 'ORIGINAL', releaseDate: '2026-05-01',
    releaseDateGranularity: 'date', releaseDateFormat: 'kr-compact',
    reissueDate: '', isReissue: false, watchDate: '2026-05-03',
    watchDateFormat: 'kr-compact', watchTime: '20:30', theater: 'CGV',
    screen: 'IMAX', seat: 'G14', actors: 'Actor', rating: 4.5,
    runtime: '150 MIN', bookingNumber: 'BOOK-1234', signature: '@x',
  };

  test('포스터 채우기는 POSTER_FILL_MOODS(minimal)에서만 서고, 한 스크롤 본문에 로고 크기와 함께 쌓인다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    await user.click(screen.getByRole('tab', { name: '크기' }));
    const fit = Array.from(screen.getByRole('radiogroup', { name: '포스터 채우기' }).querySelectorAll('[role=radio]'));
    expect(fit.map((t) => t.textContent)).toEqual(['원본 비율', '꽉 채우기']);
    for (const t of fit) expect(expectMeetsAA(t, `채우기 라디오 ${t.textContent}`).h).toBe(36);
    // 축 전환 없이 로고 크기도 같은 본문에 있다.
    expect(screen.queryByRole('radiogroup', { name: '크기 축' }) === null).toBe(true);
    expect(screen.queryByLabelText('극장 로고 크기')).not.toBeNull();
    expect(screen.queryByLabelText('포맷 로고 크기')).not.toBeNull();
    // 포스터 재크롭은 사진 모드로 갔다.
    expect(screen.queryByRole('button', { name: '포스터 다시 크롭' }) === null).toBe(true);

    await user.click(screen.getByRole('tab', { name: '무드' }));
    await user.click(screen.getByRole('radio', { name: /크라이테리언/ }));
    await user.click(screen.getByRole('tab', { name: '크기' }));
    expect(screen.queryByRole('radiogroup', { name: '포스터 채우기' }) === null).toBe(true);
    expect(screen.queryByLabelText('극장 로고 크기')).not.toBeNull();
  });

  test('꽉 채우기 토글이 만든 상태는 posterFit을 직접 넣은 경로와 무드 마크업까지 같다', async () => {
    const user = userEvent.setup();
    render(<DockHarness />);
    await user.click(screen.getByRole('tab', { name: '크기' }));
    const before = dockProbe.photo!.state.components;
    expect(before.posterFit ?? 'contain').toBe('contain');

    await user.click(screen.getByRole('radio', { name: '꽉 채우기' }));
    const after = dockProbe.photo!.state.components;
    // ① 상태 층 — UI가 건드린 필드는 posterFit 하나뿐이어야 한다.
    expect(after).toEqual({ ...before, posterFit: 'cover' });

    const draw = (c: typeof after) =>
      renderToStaticMarkup(<MoodMinimal movieInfo={MOVIE} components={c} croppedImageUrl="blob:test" />);
    // ② 렌더 층 + ③ 비교가 공허하지 않다는 확인.
    expect(draw(after)).toBe(draw({ ...before, posterFit: 'cover' }));
    expect(draw(after)).not.toBe(draw({ ...before, posterFit: 'contain' }));
  });
});
