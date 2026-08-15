/**
 * #445 회귀 테스트 — KOBIS 무매칭/다중매칭 시 안내 토스트 대신 제목 검색 UI를 직접 연다.
 *
 * OcrUploadCard의 onNeedManualTitle 콜백이 실제 셸(MobileEditorShell)에
 * 어떻게 배선됐는지 검증한다 — runOcr만 mock하고 KOBIS는 global.fetch 스텁으로 0/다중 매치를
 * 흉내낸다(kobisLookup.ts 실 구현은 그대로 둔다 — bun-mock-module-global-leak 메모와 동일 이유).
 *
 * 성공 케이스(1건 자동보강)는 이 이슈의 대상이 아니라 여기서 건드리지 않는다.
 */
import { describe, expect, test, afterAll, afterEach, mock } from 'bun:test';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
// 스프레드 스냅샷 + afterAll 복원(#611·#618) — `require()`가 주는 건 살아있는 네임스페이스라
// mock.module이 그 객체를 제자리에서 갈아끼운다. 복사본으로 떠 둬야 복원이 진짜 복원이 된다.
// 안 되돌리면 이 runOcr 스텁이 프로세스 끝까지 남아, 뒤 파일이 실제 OCR 호출 대신 이 파일이
// 마지막에 심어둔 ocrImpl을 받는다.
const realOcr = { ...require('@/utils/ocr') };
mock.module('@/utils/ocr', () => ({
  ...realOcr,
  runOcr: (file: File) => ocrImpl(file),
}));

const { clearKobisLookupCache } =
  require('@/utils/kobisLookup') as typeof import('@/utils/kobisLookup');
const { usePhototicket } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { mobileShellProps } = require('./shellHarness') as typeof import('./shellHarness');

// #607에서 데스크톱 셸이 삭제되며 데스크톱 쪽 두 케이스를 정리했다:
// (1) 'chain/format 라벨 세팅 + 안내 토스트 부재'는 마지막 테스트가 모바일 드로어 경로로 이관.
//     라벨 확인은 데스크톱 INFO 탭 텍스트 대신 state(chainLabel)로 본다 — 모바일엔 그 탭이 없다.
// (2) '제목 행이 펼쳐져 자동검색까지 실행된다'는 **이관하지 않았다.** 자동검색(#383)은 데스크톱
//     아코디언이 여는 TitleSheet(role=combobox)의 마운트 동작이고, 모바일이 여는 온-티켓
//     인플레이스 편집기는 role=textbox 단일 입력이라 등가 명제가 없다. 대신 아래 드로어
//     테스트가 "그 편집기가 실제로 떴는가"까지 확인하도록 보강했다.

let captured: import('@/types').PhototicketState;

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

function MobileHarness() {
  const photo = usePhototicket();
  captured = photo.state;
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

afterAll(() => {
  mock.module('@/utils/ocr', () => realOcr);
});

describe('KOBIS 무매칭 → 제목 검색 UI 연결 (#445)', () => {
  test('모바일 드로어: 드로어가 닫히고 온-티켓 제목 편집이 열려 자동검색까지 실행된다(안내 토스트 없음)', async () => {
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
    expect(screen.queryByText('영화 정보를 찾지 못했어요. 제목을 확인하고 다시 검색해 주세요.')).toBeNull();

    // 드로어가 닫히는 것만으로는 "검색 UI를 연다"가 안 지켜질 수 있어 편집기가 실제로 떴는지도 본다.
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: '제목' })).toBeDefined();
    });
  });

  test('chain/format 인식 시 라벨은 세팅되지만 "스탬프를 채웠어요" 안내는 더 이상 뜨지 않는다', async () => {
    const user = userEvent.setup();
    render(<MobileHarness />);
    await user.click(screen.getByText('seed-poster'));

    await user.click(screen.getByRole('button', { name: '티켓 항목 목록 열기' }));
    const dialog = await screen.findByRole('dialog', { name: '티켓 항목' });

    ocrImpl = async () => ({ chain: 'cgv', format: 'IMAX' });
    await user.upload(ocrFileInput(dialog), new File(['x'], 'ticket.png', { type: 'image/png' }));

    // 라벨 자동 세팅은 유지 — 데스크톱은 INFO 탭 텍스트로 봤지만 모바일엔 그 탭이 없어 상태로 본다.
    await waitFor(() => {
      expect(captured.components.chainLabel).toBe('CGV');
    });
    expect(screen.queryByText(/스탬프를 채웠어요/)).toBeNull();
  });
});
