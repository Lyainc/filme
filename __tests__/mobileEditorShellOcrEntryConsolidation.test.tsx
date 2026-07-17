/**
 * #388 회귀 테스트 — 본문 OCR 카드를 업로드 후 CSS hidden으로 바꾸고 드로어로 일원화하면서,
 * #363(커밋 514baab)·PR #372 리뷰 P1이 고친 "in-flight KOBIS 보강이 mountedRef 가드에 조용히
 * 버려지는" 회귀가 재현되지 않는지 실제 타이밍으로 검증한다.
 *
 * 두 시나리오를 모두 다룬다:
 *  1. 랜딩→업로드 전환(본문 카드 hidden화, unmount 아님) 중 in-flight KOBIS 응답 도착.
 *  2. 드로어에서 OCR 시작 → 응답 전에 드로어를 닫음(FieldDrawer는 "닫힘 = 즉시 unmount") — 업로드
 *     후 유일한 접근 가능 OCR 진입점이 드로어이므로, 이 경로가 안전하지 않으면 #388 자체가 같은
 *     클래스의 리그레션을 새로 만든 것이다(claude-review PR #413 P0 지적).
 *
 * 두 경우 모두 setInfo(kobisInfo)는 OcrUploadCard 인스턴스가 아니라 셸이 쥔 photo 상태를
 * 갱신하므로, 그 인스턴스가 사라져도 응답이 여전히 최신이면(ocrEpochRef, #388 useOcrUndo.ts)
 * 반영돼야 한다.
 */
import { describe, expect, test, afterEach, mock, spyOn } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import type { PhototicketState } from '@/types';

// runOcr must be mocked BEFORE MobileEditorShell (which transitively imports it via
// OcrUploadCard) is loaded — bun's mock.module is not hoisted, so the shell is
// pulled in via require below, after this registration (ocrUndoRestore.test.tsx와 동일 패턴).
let ocrImpl: (file: File) => Promise<Record<string, unknown>> = async () => ({});
mock.module('@/utils/ocr', () => ({
  runOcr: (file: File) => ocrImpl(file),
}));

// @/utils/kobisLookup은 mock.module하지 않고 global.fetch만 스텁한다 — mock.module하면
// kobisLookup.test.ts가 같은 프로세스에서 이 mock을 받아버린다(bun mock.module 전역 누수,
// ocrUndoRestore.test.tsx와 동일 근거).
const { clearKobisLookupCache } =
  require('@/utils/kobisLookup') as typeof import('@/utils/kobisLookup');
const { MobileEditorShell } =
  require('@/components/v2/MobileEditorShell') as typeof import('@/components/v2/MobileEditorShell');
const { usePhototicket } =
  require('@/hooks/usePhototicket') as typeof import('@/hooks/usePhototicket');

let captured: PhototicketState;

function MobileHarness() {
  const photo = usePhototicket();
  captured = photo.state;
  return (
    <>
      <button type="button" onClick={() => photo.handleImageUpload('blob:test-poster')}>
        seed-poster
      </button>
      <MobileEditorShell
        photo={photo}
        canExport
        theme="light"
        onThemeChange={() => {}}
        onDone={() => {}}
        disabledReason=""
        previewMovieInfo={photo.state.movieInfo}
        previewComponents={{ ...photo.state.components, layout: 'stub' }}
        fieldVisibility={photo.state.fieldVisibility}
      />
    </>
  );
}

/** The shell mounts multiple file inputs; the OCR card's is the only `image/*` one. */
function ocrFileInput(): HTMLInputElement {
  const inputs = Array.from(
    document.querySelectorAll('input[type="file"]'),
  ) as HTMLInputElement[];
  const input = inputs.find((i) => i.getAttribute('accept') === 'image/*');
  if (!input) throw new Error('OcrUploadCard file input not found');
  return input;
}

/** 드로어가 열려 있으면 본문(hidden) 인스턴스와 드로어 인스턴스 둘 다 image/* input을 갖는다 —
 *  드로어 안으로 스코프해 특정한다. */
function ocrFileInputWithin(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement | null;
  if (!input) throw new Error('OcrUploadCard file input not found within container');
  return input;
}

/** KOBIS search+detail fetch를 수동으로 resolve 가능한 상태로 스텁 — in-flight 타이밍을 테스트가 직접 제어한다. */
function mockPendingKobisFetch() {
  let resolveSearch!: (value: unknown) => void;
  let resolveDetail!: (value: unknown) => void;
  const searchPromise = new Promise((resolve) => {
    resolveSearch = resolve;
  });
  const detailPromise = new Promise((resolve) => {
    resolveDetail = resolve;
  });

  spyOn(global, 'fetch').mockImplementation((async (url: string) => {
    if (url.includes('/api/kobis/search')) return searchPromise;
    if (url.includes('/api/kobis/detail')) return detailPromise;
    throw new Error(`unexpected url: ${url}`);
  }) as unknown as typeof fetch);

  return {
    resolveWithGrandBudapest() {
      resolveSearch({
        ok: true,
        json: async () => ({
          movieListResult: {
            movieList: [
              {
                movieCd: '20147727',
                movieNm: '그랜드 부다페스트 호텔',
                movieNmEn: 'The Grand Budapest Hotel',
                openDt: '20140320',
              },
            ],
          },
        }),
      });
      resolveDetail({ ok: true, json: async () => ({ movieInfoResult: { movieInfo: {} } }) });
    },
  };
}

afterEach(() => {
  cleanup();
  ocrImpl = async () => ({});
  clearKobisLookupCache();
  mock.restore();
});

describe('in-flight KOBIS 보강이 OCR 카드 인스턴스 소멸 이후에도 반영된다 (#388)', () => {
  test('랜딩에서 OCR 시작 → KOBIS 응답 전에 포스터 업로드(본문 카드 hidden 전환) → 응답 도착 시 titleOg/releaseDate가 폼에 반영된다', async () => {
    const { resolveWithGrandBudapest } = mockPendingKobisFetch();

    render(<MobileHarness />);
    expect(captured.movieInfo.titleOg).toBe('');

    ocrImpl = async () => ({ title: '그랜드 부다페스트 호텔' });

    // 랜딩(포스터 업로드 전) 상태에서 OCR 트리거 — title만 인식되면 직접 필드는 없어
    // "제목으로 영화 정보를 검색할게요" 토스트가 뜬다. 이 시점에 KOBIS search fetch가 이미
    // 호출된 상태(searchPromise가 아직 pending).
    fireEvent.change(ocrFileInput(), {
      target: { files: [new File(['x'], 'ticket.png', { type: 'image/png' })] },
    });
    // OcrUploadCard는 토스트를 시각 div + sr-only 라이브리전 두 곳에 동시 렌더하므로(#199) 텍스트가
    // 항상 2곳에 잡힌다 — findByText(단일 매치 기대)가 아니라 findAllByText로 대기(mobileEditorShellMenu.test.tsx와 동일 컨벤션).
    await waitFor(() => {
      expect(screen.getAllByText('제목으로 영화 정보를 검색할게요.').length).toBeGreaterThan(0);
    });

    // KOBIS 검색이 아직 in-flight인 동안 포스터를 업로드 — 본문 OcrUploadCard가 CSS hidden으로
    // 전환된다(#388). 테스트 환경엔 Tailwind CSS가 없어 getByRole은 여전히 노드를 찾으므로(값
    // 자체는 mobileChromeOrder.test.tsx와 동일 이유), .hidden 조상 존재로 직접 확인한다 — 핵심은
    // 이 시점에도 노드가 여전히 DOM에 존재(=unmount 아님)해야 한다는 것.
    fireEvent.click(screen.getByText('seed-poster'));
    const ocrCard = screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' });
    expect(ocrCard.closest('.hidden')).not.toBeNull();

    resolveWithGrandBudapest();

    await waitFor(() => {
      expect(captured.movieInfo.title).toBe('그랜드 부다페스트 호텔');
      expect(captured.movieInfo.titleOg).toBe('The Grand Budapest Hotel');
      expect(captured.movieInfo.releaseDate).toBe('2014-03-20');
    });
  });

  test('드로어에서 OCR 시작 → KOBIS 응답 전에 드로어를 닫아도(unmount) 응답 도착 시 titleOg/releaseDate가 폼에 반영된다 (claude-review PR #413 P0)', async () => {
    const { resolveWithGrandBudapest } = mockPendingKobisFetch();

    render(<MobileHarness />);
    fireEvent.click(screen.getByText('seed-poster')); // 드로어는 croppedImageUrl이 있어야 열린다.
    expect(captured.movieInfo.titleOg).toBe('');

    ocrImpl = async () => ({ title: '그랜드 부다페스트 호텔' });

    fireEvent.click(screen.getByRole('button', { name: '티켓 항목 목록' }));
    const drawer = await screen.findByRole('dialog', { name: '티켓 항목' });

    fireEvent.change(ocrFileInputWithin(drawer), {
      target: { files: [new File(['x'], 'ticket.png', { type: 'image/png' })] },
    });
    await waitFor(() => {
      expect(within(drawer).getAllByText('제목으로 영화 정보를 검색할게요.').length).toBeGreaterThan(0);
    });

    // Escape로 드로어를 닫는다 — FieldDrawer는 "마운트 = 열림, 닫힘은 즉시 unmount"라(FieldDrawer.tsx)
    // 이 드로어 인스턴스의 OcrUploadCard는 이 시점에 정말로 사라진다(hidden이 아니라 unmount).
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '티켓 항목' })).toBeNull();

    // 드로어(및 그 안의 OcrUploadCard 인스턴스)가 사라진 뒤에 KOBIS 응답이 도착한다 — ocrEpochRef가
    // 셸 레벨에서 "이 실행이 여전히 최신"임을 판단하므로, 인스턴스 소멸과 무관하게 반영돼야 한다.
    resolveWithGrandBudapest();

    await waitFor(() => {
      expect(captured.movieInfo.title).toBe('그랜드 부다페스트 호텔');
      expect(captured.movieInfo.titleOg).toBe('The Grand Budapest Hotel');
      expect(captured.movieInfo.releaseDate).toBe('2014-03-20');
    });
  });
});
