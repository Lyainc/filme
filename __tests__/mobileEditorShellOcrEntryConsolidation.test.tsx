/**
 * #388 회귀 테스트 — 본문 OCR 카드를 업로드 후 CSS hidden으로 바꾸고 드로어로 일원화하면서,
 * #363(커밋 514baab)·PR #372 리뷰 P1이 고친 "랜딩↔업로드 전환에서 in-flight KOBIS 보강이
 * mountedRef 가드에 조용히 버려지는" 회귀가 재현되지 않는지 실제 타이밍으로 검증한다.
 *
 * 시나리오: 랜딩(포스터 업로드 전)에서 OCR로 title을 인식 → 비동기 KOBIS 검색이 in-flight인 동안
 * 포스터를 업로드(croppedImageUrl true) → 본문 OcrUploadCard가 CSS hidden으로 전환(unmount 아님,
 * #388) → 그 이후 KOBIS 응답 도착. hidden 전환이 실제로 unmount가 아니라면 titleOg·releaseDate
 * (완료 게이트 필수 필드)가 폼에 그대로 반영돼야 한다. 만약 누군가 이 섹션을
 * `{!croppedImageUrl && <OcrUploadCard .../>}` 식 조건부 마운트로 되돌리면 이 테스트가 깨진다.
 */
import { describe, expect, test, afterEach, mock, spyOn } from 'bun:test';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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

afterEach(() => {
  cleanup();
  ocrImpl = async () => ({});
  clearKobisLookupCache();
  mock.restore();
});

describe('본문 OCR 카드 hidden 전환 중 in-flight KOBIS 보강 (#388)', () => {
  test('랜딩에서 OCR 시작 → KOBIS 응답 전에 포스터 업로드(hidden 전환) → 응답 도착 시 titleOg/releaseDate가 폼에 반영된다', async () => {
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
    // 이 시점에도 노드가 여전히 DOM에 존재(=unmount 아님)해야 mountedRef가 살아있다는 것.
    fireEvent.click(screen.getByText('seed-poster'));
    const ocrCard = screen.getByRole('button', { name: '티켓 스크린샷으로 자동입력' });
    expect(ocrCard.closest('.hidden')).not.toBeNull();

    // hidden 전환이 unmount였다면 이 resolve들이 도착해도 mountedRef 가드가 setInfo를 버린다.
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

    await waitFor(() => {
      expect(captured.movieInfo.title).toBe('그랜드 부다페스트 호텔');
      expect(captured.movieInfo.titleOg).toBe('The Grand Budapest Hotel');
      expect(captured.movieInfo.releaseDate).toBe('2014-03-20');
    });
  });
});
