/**
 * #826 S2 I-01 · E-02 — 도크 정보 모드. 옛 FieldDrawer의 목록(영화 / 관람 / 기록)을 도크 본문으로 옮기며 생긴
 * 계약: 무드가 안 그리는 행은 빠지고, 값이 없으면 '비어 있음', 필수 누락은 앰버, 눈 토글(title은 비활성),
 * 행 탭이 인플레이스 입력 진입, '스크린샷으로 자동입력' 버튼, 끝의 '전체 표시' 스위치.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { launcherGroupsFor } from '@/constants/fields';
import type { LayoutId } from '@/types';
import { DockHarness, dockProbe, resetDockProbe } from './dockHarness';

beforeEach(() => {
  window.localStorage.clear();
  resetDockProbe();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const body = () => screen.getByTestId('dock-body');
const row = (field: string) => body().querySelector(`[data-field-row="${field}"]`) as HTMLElement;
const rowFields = () => Array.from(body().querySelectorAll('[data-field-row]')).map((r) => r.getAttribute('data-field-row'));
const rowButton = (field: string) => row(field).querySelector('button') as HTMLButtonElement;

describe('정보 목록 구성', () => {
  test('영화 · 관람 · 기록 세 묶음이고 minimal은 bookingNo · quote가 빠진다 (MOOD_EXCLUDED_FIELDS)', () => {
    render(<DockHarness mode="info" />);
    expect(Array.from(body().querySelectorAll('section')).map((s) => s.getAttribute('aria-label'))).toEqual(['영화', '관람', '기록']);
    expect(rowFields()).toEqual(['title', 'releaseDate', 'titleOg', 'actors', 'runtime', 'watchDate', 'watchTime', 'theater', 'screen', 'seat', 'rating', 'signature']);
  });

  test('행 목록은 무드별 launcherGroupsFor와 정확히 일치한다 — 죽은 행도 빠진 행도 없다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="design" />);
    for (const layout of ['criterion', 'editorial', 'stub', '35mm', '35mm-landscape', 'minimal'] as LayoutId[]) {
      await act(async () => {
        dockProbe.photo!.updateComponents({ layout });
      });
      await user.click(screen.getByRole('tab', { name: /^정보/ }));
      expect(rowFields()).toEqual(launcherGroupsFor(layout).flatMap((g) => g.fields));
      await user.click(screen.getByRole('tab', { name: '디자인' }));
    }
  });

  test('criterion은 한줄평 행이 있고 bookingNo만 빠진다 (#777)', async () => {
    render(<DockHarness mode="design" />);
    await act(async () => {
      dockProbe.photo!.updateComponents({ layout: 'criterion' });
    });
    await userEvent.setup().click(screen.getByRole('tab', { name: /^정보/ }));
    expect(rowFields()).toContain('quote');
    expect(rowFields()).not.toContain('bookingNo');
  });
});

describe('값 표시', () => {
  test("값이 없으면 '비어 있음', 있으면 그 값이고 접근명은 이름 + 값이다", async () => {
    render(<DockHarness mode="info" />);
    expect(row('theater').textContent).toContain('비어 있음');
    await act(async () => {
      dockProbe.photo!.updateMovieInfo({ theater: 'CGV 용산' });
    });
    expect(row('theater').textContent).toContain('CGV 용산');
    expect(screen.getByRole('button', { name: '극장 CGV 용산' })).not.toBeNull();
  });

  test("필수(제목·개봉일)가 비면 이름에 앰버 점, 값 자리에 앰버 '필수'가 서고 접근 설명에 '필수 미입력'이 붙는다", () => {
    render(<DockHarness mode="info" />);
    for (const f of ['title', 'releaseDate']) {
      expect(row(f).getAttribute('data-missing')).toBe('true');
      expect(within(row(f)).getByTestId('missing-dot')).not.toBeNull();
      expect(row(f).textContent).toContain('필수');
      const describedBy = rowButton(f).getAttribute('aria-describedby')!;
      expect(document.getElementById(describedBy)?.textContent).toBe('필수 미입력');
      expect(rowButton(f).querySelector('.text-warn')).not.toBeNull();
    }
    // 선택 항목은 비어도 앰버가 아니다.
    expect(row('actors').getAttribute('data-missing')).toBeNull();
    expect(row('actors').querySelector('.text-warn') === null).toBe(true);
  });

  test('필수를 채우면 앰버가 걷힌다', async () => {
    render(<DockHarness mode="info" />);
    await act(async () => {
      dockProbe.photo!.updateMovieInfo({ title: '영화', releaseDate: '2026' });
    });
    expect(row('title').getAttribute('data-missing')).toBeNull();
    expect(row('releaseDate').getAttribute('data-missing')).toBeNull();
    expect(screen.queryByTestId('info-missing-dot') === null).toBe(true);
  });
});

describe('행 탭과 표시 토글', () => {
  test('행 탭은 그 필드의 인플레이스 입력으로 간다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="info" />);
    await act(async () => {
      dockProbe.photo!.updateMovieInfo({ title: '영화', releaseDate: '2026' });
    });
    await user.click(rowButton('theater'));
    await user.click(rowButton('seat'));
    expect(dockProbe.field).toEqual(['theater', 'seat']);
    expect(dockProbe.missing).toEqual([]);
  });

  test('필수 누락 행 탭은 openMissingField 경로(#776 재숨김)로 간다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="info" />);
    await user.click(rowButton('title'));
    await user.click(rowButton('releaseDate'));
    await user.click(rowButton('theater'));
    expect(dockProbe.missing).toEqual(['title', 'releaseDate']);
    expect(dockProbe.field).toEqual(['theater']);
  });

  test('눈 토글은 티켓 표시를 뒤집고 aria-pressed·취소선으로 상태를 보인다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="info" />);
    await act(async () => {
      dockProbe.photo!.updateMovieInfo({ theater: 'CGV 용산' });
    });
    const eye = screen.getByRole('button', { name: '극장 티켓에 표시' });
    expect(eye.getAttribute('aria-pressed')).toBe('true');
    await user.click(eye);
    expect(dockProbe.photo!.state.fieldVisibility.theater).toBe(false);
    expect(eye.getAttribute('aria-pressed')).toBe('false');
    expect(row('theater').querySelector('.line-through')).not.toBeNull();
    await user.click(eye);
    expect(dockProbe.photo!.state.fieldVisibility.theater).toBe(true);
    // 눈 토글은 행 탭(인플레이스 입력)을 열지 않는다.
    expect(dockProbe.field).toEqual([]);
  });

  test('제목 행의 눈 토글은 비활성이다 (#260)', () => {
    render(<DockHarness mode="info" />);
    const eye = screen.getByRole('button', { name: '제목 티켓에 표시' }) as HTMLButtonElement;
    expect(eye.disabled).toBe(true);
    expect((screen.getByRole('button', { name: '극장 티켓에 표시' }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("끝의 '전체 표시' 스위치는 켜져 있으면 끄며 제목만 남기고, 다시 켜면 전부 켠다 (#260 · #424 → #826 S2)", async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="info" />);
    const all = screen.getByRole('switch', { name: '전체 표시' });
    // 기본은 전 필드 표시 — 스위치가 켜져 있다.
    expect(all.getAttribute('aria-checked')).toBe('true');
    await user.click(all);
    expect(dockProbe.photo!.state.fieldVisibility.title).toBe(true);
    expect(dockProbe.photo!.state.fieldVisibility.theater).toBe(false);
    expect(all.getAttribute('aria-checked')).toBe('false');
    await user.click(all);
    expect(Object.values(dockProbe.photo!.state.fieldVisibility).every(Boolean)).toBe(true);
    expect(all.getAttribute('aria-checked')).toBe('true');
  });
});

describe('스크린샷으로 자동입력 버튼 (constraint-17)', () => {
  test('목록 맨 위에 있고 누르면 셸의 OCR 열기를 부른다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="info" />);
    const button = screen.getByRole('button', { name: '스크린샷으로 자동입력' });
    expect(body().querySelector('button') === button).toBe(true);
    await user.click(button);
    expect(dockProbe.ocr).toBe(1);
  });

  test("인식 중이면 '티켓 인식 중…'(aria-busy)이고 다른 편집은 계속된다", async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="info" ocrBusy />);
    const button = screen.getByRole('button', { name: '티켓 인식 중…' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    // 행은 그대로 눌린다.
    await user.click(rowButton('theater'));
    expect(dockProbe.field).toEqual(['theater']);
  });
});
