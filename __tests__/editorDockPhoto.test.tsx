/**
 * #826 S2 G-01 — 도크 사진 모드. 이미지 자산 행: 포스터 · 극장 로고 · 포맷 로고, 스탬프 무드(editorial · criterion ·
 * stub)에서만 배경 스탬프. 옛 FieldDrawer 로고 행 · 헤더 메뉴의 포스터 교체/재크롭 · 스탬프 레일 항목이 이 모드로 왔다.
 * 배경 스탬프 행의 업로드·제거·노출 게이팅은 dockBackgroundStamp.test.tsx가 맡는다.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const rows = () => Array.from(screen.getByTestId('dock-body').querySelectorAll('[data-asset-row]')).map((r) => r.getAttribute('data-asset-row'));
const row = (name: string) => within(document.querySelector(`[data-asset-row="${name}"]`) as HTMLElement);
const rowEl = (name: string) => document.querySelector(`[data-asset-row="${name}"]`) as HTMLElement;
const set = (fn: (p: NonNullable<typeof dockProbe.photo>) => void) =>
  act(async () => {
    fn(dockProbe.photo!);
  });

describe('행 구성', () => {
  test('스탬프 행은 editorial · criterion · stub에만 있다', async () => {
    render(<DockHarness mode="photo" />);
    const stampMoods = new Set<LayoutId>(['editorial', 'criterion', 'stub']);
    for (const layout of ['minimal', 'criterion', 'editorial', 'stub', '35mm', '35mm-landscape'] as LayoutId[]) {
      await set((p) => p.updateComponents({ layout }));
      expect(rows()).toEqual(stampMoods.has(layout) ? ['포스터', '극장 로고', '포맷 로고', '배경 스탬프'] : ['포스터', '극장 로고', '포맷 로고']);
    }
  });
});

describe('포스터 행', () => {
  test("포스터가 없으면 '없음' + '추가'만 있고 자르기는 없다", () => {
    render(<DockHarness mode="photo" />);
    expect(rowEl('포스터').textContent).toContain('없음');
    expect(row('포스터').getByRole('button', { name: '추가' })).not.toBeNull();
    expect(row('포스터').queryByRole('button', { name: '자르기' }) === null).toBe(true);
  });

  test("추가는 셸의 포스터 파일 선택을 연다", async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="photo" />);
    await user.click(row('포스터').getByRole('button', { name: '추가' }));
    expect(dockProbe.picks).toBe(1);
  });

  test("포스터는 있는데 원본이 없으면 '원본 없음'이고 자르기가 비활성이다", async () => {
    render(<DockHarness mode="photo" />);
    await set((p) => p.handleImageUpload('blob:poster'));
    expect(rowEl('포스터').textContent).toContain('원본 없음');
    const crop = row('포스터').getByRole('button', { name: '자르기' }) as HTMLButtonElement;
    expect(crop.disabled).toBe(true);
    expect(row('포스터').getByRole('button', { name: '교체' })).not.toBeNull();
  });

  test('원본이 있으면 자르기가 셸의 재크롭을 부르고, 교체는 파일 선택을 연다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="photo" withOriginal />);
    await set((p) => p.handleImageUpload('blob:poster'));
    const crop = row('포스터').getByRole('button', { name: '자르기' }) as HTMLButtonElement;
    expect(crop.disabled).toBe(false);
    await user.click(crop);
    await user.click(row('포스터').getByRole('button', { name: '교체' }));
    expect(dockProbe.recrops).toBe(1);
    expect(dockProbe.picks).toBe(1);
  });

  test('썸네일은 포스터 이미지다', async () => {
    render(<DockHarness mode="photo" />);
    await set((p) => p.handleImageUpload('blob:poster'));
    expect(rowEl('포스터').querySelector('img')?.getAttribute('src')).toBe('blob:poster');
  });
});

describe.each([
  ['극장 로고', 'chain', 'chainLabel', 'chainVisible'],
  ['포맷 로고', 'format', 'formatLabel', 'formatVisible'],
] as const)('%s 행', (name, imageKey, labelKey, visibleKey) => {
  test("비어 있으면 '비어 있음' + '추가'(인플레이스 입력)다", async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="photo" />);
    await set((p) => p.updateComponents({ [imageKey]: '', [labelKey]: '' }));
    expect(rowEl(name).textContent).toContain('비어 있음');
    await user.click(row(name).getByRole('button', { name: '추가' }));
    expect(dockProbe.field).toEqual([imageKey]);
  });

  test("텍스트면 '텍스트 · 라벨' + '이미지로'고, 이름 영역은 텍스트 입력을 연다", async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="photo" />);
    await set((p) => p.updateComponents({ [imageKey]: '', [labelKey]: 'CGV' }));
    expect(rowEl(name).textContent).toContain('텍스트 · CGV');
    expect(row(name).getByRole('button', { name: '이미지로' })).not.toBeNull();
    await user.click(row(name).getByRole('button', { name: `${name} 편집` }));
    expect(dockProbe.field).toEqual([imageKey]);
  });

  test("이미지면 '이미지' + '교체' · '제거'고, 제거는 이미지를 비워 텍스트 상태로 돌린다", async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="photo" />);
    await set((p) => p.updateComponents({ [imageKey]: 'blob:logo', [labelKey]: 'CGV' }));
    expect(rowEl(name).textContent).toContain('이미지');
    expect(rowEl(name).querySelector('img')?.getAttribute('src')).toBe('blob:logo');
    expect(row(name).getByRole('button', { name: '교체' })).not.toBeNull();
    await user.click(row(name).getByRole('button', { name: '제거' }));
    expect(String(dockProbe.photo!.state.components[imageKey] ?? '')).toBe('');
    expect(rowEl(name).textContent).toContain('텍스트 · CGV');
  });

  test('교체 · 이미지로는 로고 파일 input을 연다 — 사진 모드가 로고 업로드의 자리다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="photo" />);
    await set((p) => p.updateComponents({ [imageKey]: '', [labelKey]: 'CGV' }));
    const input = screen.getByLabelText(`${name} 이미지 파일`) as HTMLInputElement;
    let clicks = 0;
    input.addEventListener('click', () => { clicks += 1; });
    await user.click(row(name).getByRole('button', { name: '이미지로' }));
    expect(clicks).toBe(1);
  });

  test('눈 토글은 티켓 표시를 뒤집는다 — aria-label은 이름 + 티켓에 표시, aria-pressed가 상태다', async () => {
    const user = userEvent.setup();
    render(<DockHarness mode="photo" />);
    await set((p) => p.updateComponents({ [visibleKey]: true }));
    const eye = screen.getByRole('button', { name: `${name} 티켓에 표시` });
    expect(eye.getAttribute('aria-pressed')).toBe('true');
    await user.click(eye);
    expect(dockProbe.photo!.state.components[visibleKey]).toBe(false);
    expect(eye.getAttribute('aria-pressed')).toBe('false');
    // 눈 토글은 인플레이스 입력을 열지 않는다.
    expect(dockProbe.field).toEqual([]);
  });
});

describe('로고 이미지 업로드는 크롭 모달을 거친다', () => {
  test('파일을 고르면 로고 자르기 화면이 서고, 취소하면 이미지는 그대로다', async () => {
    render(<DockHarness mode="photo" />);
    await set((p) => p.updateComponents({ chain: '', chainLabel: 'CGV' }));
    const input = screen.getByLabelText('극장 로고 이미지 파일') as HTMLInputElement;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    // 크롭 모달은 dynamic(ssr:false)라 비동기로 선다 — 열리는 대로 '로고 자르기'가 이름이다.
    const dialog = await screen.findByRole('dialog', { name: '로고 자르기' });
    expect(dialog).not.toBeNull();
    expect(String(dockProbe.photo!.state.components.chain ?? '')).toBe('');
  });
});
