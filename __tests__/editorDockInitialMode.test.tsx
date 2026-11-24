/**
 * #826 S2 E-01 — 도크의 처음 모드: 스크린샷으로 채웠으면 디자인, 아니면 정보. 스크린샷 인식(랜딩 OCR)이 새 문서를
 * 채우는 경우만 디자인이고, 포스터 없이 시작 · 이어서 만들기 · 무드 탭 · 편집 중 다시 인식(정보 모드 버튼)은
 * 정보 모드를 건드리지 않는다. 랜딩 OCR은 첨부 시트(스크린샷 행 → 만들기)로만 열린다(#826 S9). 실제 셸 배선(onOcrApply → setDockMode)을 거치며 OCR은 fetch 스텁이다.
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mobileShellProps } from './shellHarness';
import { enterDirect, enterWithOcrViaSheet, makeFromSheet, uploadScreenshotViaSheet } from './helpers/landingAttach';

// 이미지 디코드만 생략하고 FileReader → runOcr → 셸의 실제 상태 갱신 경로를 탄다(ocrFailureFlow와 같은 방식).
const realPreprocess = { ...require('@/utils/ocrPreprocess') };
mock.module('@/utils/ocrPreprocess', () => ({
  ...realPreprocess,
  preprocessForOcr: async (file: File) => file,
}));
const { usePhototicket } = require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } = require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');

function Harness() {
  const photo = usePhototicket();
  return <MobileEditorShell {...mobileShellProps(photo)} />;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  mock.restore();
  window.localStorage.clear();
});
afterAll(() => mock.module('@/utils/ocrPreprocess', () => realPreprocess));

const selectedMode = () =>
  screen.getAllByRole('tab').filter((t) => ['사진', '정보', '디자인'].some((m) => (t.textContent ?? '').startsWith(m)) && t.getAttribute('aria-selected') === 'true')
    .map((t) => (t.textContent ?? '').replace('필수 미입력', ''));

function stubOcr(result: Record<string, unknown>) {
  return spyOn(globalThis, 'fetch').mockImplementation((async () => Response.json(result)) as unknown as typeof fetch);
}
const ticket = () => new File(['t'], 'ticket.png', { type: 'image/png' });
const ocrInput = () => document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;

describe('도크 처음 모드 (E-01)', () => {
  test('직접 입력으로 시작하면 정보 모드다', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await enterDirect(user);
    expect(selectedMode()).toEqual(['정보']);
  });

  test('랜딩 시트에서 스크린샷으로 새 문서를 채우고 만들기를 누르면 디자인 모드다', async () => {
    stubOcr({ theater: 'CGV 용산' });
    const user = userEvent.setup();
    render(<Harness />);
    await uploadScreenshotViaSheet(user, ticket());
    await waitFor(() => expect(screen.getByTestId('landing-sheet-screenshot').textContent).toContain('인식했어요'));
    // 만들기 전엔 랜딩이 그대로다 — 편집 화면으로 들어가는 건 만들기다.
    expect(screen.getByTestId('landing').classList.contains('fixed')).toBe(true);
    await makeFromSheet(user);
    expect(screen.getByTestId('landing').classList.contains('fixed')).toBe(false);
    await waitFor(() => expect(selectedMode()).toEqual(['디자인']));
    // 도구 줄이 선 디자인 본문이다.
    expect(screen.getByRole('tablist', { name: '디자인 도구' })).not.toBeNull();
  });

  test('이어서 만들기로 들어오면 정보 모드다 — 저장분은 스크린샷으로 시작했더라도 처음 모드를 다시 정한다', async () => {
    window.localStorage.setItem('filme:phototicket:v1', JSON.stringify({ movieInfo: { title: '영화', releaseDate: '2026' } }));
    render(<Harness />);
    fireEvent.click(await screen.findByTestId('landing-restore'));
    expect(selectedMode()).toEqual(['정보']);
  });

  test('편집 중 정보 모드 버튼으로 다시 인식해도 모드를 바꾸지 않는다 (랜딩 OCR만 디자인)', async () => {
    const user = userEvent.setup();
    stubOcr({ theater: 'CGV 왕십리' });
    render(<Harness />);
    await enterDirect(user);
    expect(selectedMode()).toEqual(['정보']);

    await user.click(screen.getByRole('button', { name: '스크린샷으로 자동입력' }));
    fireEvent.change(ocrInput(), { target: { files: [ticket()] } });
    await waitFor(() => expect(screen.getByRole('button', { name: '스크린샷으로 자동입력' }).getAttribute('aria-busy')).toBe('false'));
    await waitFor(() => expect(screen.getByRole('button', { name: /^극장 CGV 왕십리/ })).not.toBeNull());
    expect(selectedMode()).toEqual(['정보']);
  });

  test('디자인 모드로 열린 뒤 초기화하고 다시 시작하면 정보 모드로 돌아온다', async () => {
    const user = userEvent.setup();
    stubOcr({ theater: 'CGV 용산' });
    render(<Harness />);
    await enterWithOcrViaSheet(user, ticket());
    await waitFor(() => expect(selectedMode()).toEqual(['디자인']));

    await user.click(screen.getByRole('button', { name: '편집 메뉴' }));
    await user.click(screen.getByRole('button', { name: '초기화' }));
    await new Promise((r) => setTimeout(r, 400));
    await user.click(screen.getByRole('button', { name: '한 번 더 눌러 전체 삭제' }));

    await enterDirect(user);
    expect(selectedMode()).toEqual(['정보']);
  });
});
