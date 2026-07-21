/**
 * #445 회귀 테스트 — KOBIS 무매칭/다중매칭 시 안내 토스트 대신 제목 검색 UI를 직접 연다.
 *
 * OcrUploadCard의 onNeedManualTitle 콜백이 실제 셸(DesktopStudioShell/MobileEditorShell)에
 * 어떻게 배선됐는지 검증한다 — runOcr만 mock하고 KOBIS는 global.fetch 스텁으로 0/다중 매치를
 * 흉내낸다(kobisLookup.ts 실 구현은 그대로 둔다 — bun-mock-module-global-leak 메모와 동일 이유).
 *
 * 성공 케이스(1건 자동보강)는 이 이슈의 대상이 아니라 여기서 건드리지 않는다.
 */
import { describe, expect, test, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
mock.module('@/utils/ocr', () => ({
  runOcr: (file: File) => ocrImpl(file),
}));

const { clearKobisLookupCache } =
  require('@/utils/kobisLookup') as typeof import('@/utils/kobisLookup');
const { usePhototicket } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { DesktopStudioShell } =
  require('@/components/v2/DesktopStudioShell') as typeof import('@/components/v2/DesktopStudioShell');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { desktopShellProps, mobileShellProps } =
  require('./shellHarness') as typeof import('./shellHarness');

// 무매칭/다중매칭 — fetchKobisLookup이 { title }만 반환하도록 항상 빈 리스트.
function stubNoMatchFetch() {
  return (async (url: string) => {
    if (url.includes('/api/kobis/search')) {
      return { ok: true, json: async () => ({ movieListResult: { movieList: [] } }) };
    }
    throw new Error(`unexpected url: ${url}`);
  }) as unknown as typeof fetch;
}

function ocrFileInput(container: ParentNode = document): HTMLInputElement {
  const inputs = Array.from(
    container.querySelectorAll('input[type="file"]')
  ) as HTMLInputElement[];
  const input = inputs.find((i) => i.getAttribute('accept') === 'image/*');
  if (!input) throw new Error('OcrUploadCard file input not found');
  return input;
}

function DesktopHarness() {
  const photo = usePhototicket();
  return <DesktopStudioShell {...desktopShellProps(photo)} />;
}

function MobileHarness() {
  const photo = usePhototicket();
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <MobileEditorShell {...mobileShellProps(photo)} />
    </>
  );
}

afterEach(() => {
  cleanup();
  ocrImpl = async () => ({});
  clearKobisLookupCache();
  mock.restore();
});

describe('KOBIS 무매칭 → 제목 검색 UI 연결 (#445)', () => {
  test('데스크톱: INFO 탭으로 전환되고 제목 행이 펼쳐져 자동검색까지 실행된다', async () => {
    const user = userEvent.setup();
    global.fetch = stubNoMatchFetch();
    render(<DesktopHarness />);

    // 기본 POSTER 탭 — OCR 카드가 있다.
    ocrImpl = async () => ({ title: '알수없는영화' });
    await user.upload(ocrFileInput(), new File(['x'], 'ticket.png', { type: 'image/png' }));

    // 콜백이 INFO 탭 전환 + 제목 행 확장을 대신 처리 — 기존 안내 토스트는 더는 안 뜬다.
    // role=combobox(#198 재구현) — textbox가 아니다.
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '제목' })).toBeDefined();
    });
    expect(screen.queryByText('영화 제목을 확인 후 검색해 주세요.')).toBeNull();

    // TitleSheet가 마운트 시 seed된 title로 자동검색(#383) — 무매칭이라 결과 없음 문구.
    await waitFor(
      () => {
        expect(screen.getByText('검색 결과가 없어요.')).toBeDefined();
      },
      { timeout: 2000 }
    );
  });

  test('모바일 드로어: 드로어가 닫히고 온-티켓 제목 편집이 열린다(안내 토스트 없음)', async () => {
    const user = userEvent.setup();
    global.fetch = stubNoMatchFetch();
    render(<MobileHarness />);
    await user.click(screen.getByText('seed-poster'));

    // 필드 목록 드로어 열기.
    await user.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
    const dialog = await screen.findByRole('dialog', { name: '티켓 항목' });

    ocrImpl = async () => ({ title: '알수없는영화' });
    await user.upload(ocrFileInput(dialog), new File(['x'], 'ticket.png', { type: 'image/png' }));

    // 드로어가 닫힌다(onNeedManualTitle이 setDrawerOpen(false) + handleField('title') 호출).
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '티켓 항목' })).toBeNull();
    });
    expect(screen.queryByText('영화 제목을 확인 후 검색해 주세요.')).toBeNull();
  });

  test('chain/format 인식 시 라벨은 세팅되지만 "스탬프를 채웠어요" 안내는 더 이상 뜨지 않는다', async () => {
    const user = userEvent.setup();
    render(<DesktopHarness />);

    ocrImpl = async () => ({ chain: 'cgv', format: 'IMAX' });
    await user.upload(ocrFileInput(), new File(['x'], 'ticket.png', { type: 'image/png' }));

    await user.click(screen.getByRole('button', { name: 'INFO' }));
    await waitFor(() => {
      expect(screen.getByText('CGV')).toBeDefined(); // 라벨 자동 세팅은 유지
    });
    expect(screen.queryByText(/스탬프를 채웠어요/)).toBeNull();
  });
});
